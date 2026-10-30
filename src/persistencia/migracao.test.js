import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Módulo de ligação simulado: nenhum teste liga à base de dados.
const ligacaoSimulada = vi.hoisted(() => ({
  criarLigacao: vi.fn(() => ({ consultar: vi.fn(), fechar: vi.fn() })),
}));
vi.mock("./ligacao.js", () => ligacaoSimulada);

import { SQL_MIGRACAO, criarLigacaoAdmin, executarMigracao } from "./migracao";

// SQL sem comentários e com os espaços normalizados, para procurar instruções.
const sql = SQL_MIGRACAO.replace(/--[^\n]*/g, "").replace(/\s+/g, " ");

let adminOriginal;

beforeEach(() => {
  adminOriginal = process.env.DATABASE_ADMIN_URL;
  delete process.env.DATABASE_ADMIN_URL;
  ligacaoSimulada.criarLigacao.mockClear();
});

afterEach(() => {
  if (adminOriginal === undefined) delete process.env.DATABASE_ADMIN_URL;
  else process.env.DATABASE_ADMIN_URL = adminOriginal;
});

describe("criarLigacaoAdmin", () => {
  it("sem DATABASE_ADMIN_URL dá uma mensagem clara e não liga", () => {
    expect(() => criarLigacaoAdmin()).toThrow(
      "DATABASE_ADMIN_URL não está definido: não é possível correr a migração."
    );
    expect(ligacaoSimulada.criarLigacao).not.toHaveBeenCalled();
  });

  it("com DATABASE_ADMIN_URL usa o módulo de ligação com esse endereço", () => {
    process.env.DATABASE_ADMIN_URL = "postgres://admin:segredo@bd.exemplo.com:1/bd";

    criarLigacaoAdmin();

    expect(ligacaoSimulada.criarLigacao).toHaveBeenCalledWith({
      databaseUrl: "postgres://admin:segredo@bd.exemplo.com:1/bd",
    });
  });
});

describe("SQL_MIGRACAO", () => {
  it("é uma única transação, entre BEGIN e COMMIT", () => {
    expect(sql.trim().startsWith("BEGIN;")).toBe(true);
    expect(sql.trim().endsWith("COMMIT;")).toBe(true);
  });

  it("cria as tabelas só se não existirem, com UUID gerado pela base de dados e TIMESTAMPTZ", () => {
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS salas \( id UUID PRIMARY KEY DEFAULT gen_random_uuid\(\)/);
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS reservas \( id UUID PRIMARY KEY DEFAULT gen_random_uuid\(\)/);
    expect(sql).toMatch(/sala_id UUID NOT NULL REFERENCES salas\(id\)/);
    expect(sql).toMatch(/inicio TIMESTAMPTZ NOT NULL/);
    expect(sql).toMatch(/fim TIMESTAMPTZ NOT NULL/);
  });

  it("insere as salas A, B e C sem as repetir", () => {
    expect(sql).toMatch(/nome TEXT NOT NULL UNIQUE/);
    expect(sql).toContain(
      "INSERT INTO salas (nome, capacidade) VALUES ('Sala A', 12), ('Sala B', 6), ('Sala C', 20) ON CONFLICT (nome) DO NOTHING;"
    );
  });

  describe("permissões do app_reservas", () => {
    it("diretas: só ler, inserir, alterar e apagar nas duas tabelas, mais os mínimos para lá chegar", () => {
      expect(sql).toContain("REVOKE ALL ON ALL TABLES IN SCHEMA public FROM app_reservas;");
      expect(sql).toContain("GRANT SELECT, INSERT, UPDATE, DELETE ON salas, reservas TO app_reservas;");
      expect(sql).toContain("REVOKE CREATE ON SCHEMA public FROM app_reservas;");
      expect(sql).toContain("GRANT USAGE ON SCHEMA public TO app_reservas;");
      expect(sql).toContain("REVOKE CREATE, TEMPORARY ON DATABASE %I FROM app_reservas");
      expect(sql).toContain("GRANT CONNECT ON DATABASE %I TO app_reservas");
    });

    it("não dá mais nenhum GRANT", () => {
      const grants = sql.match(/GRANT [^;']+/g) ?? [];
      expect(grants.map((g) => g.trim())).toEqual([
        "GRANT SELECT, INSERT, UPDATE, DELETE ON salas, reservas TO app_reservas",
        "GRANT USAGE ON SCHEMA public TO app_reservas",
        "GRANT CONNECT ON DATABASE %I TO app_reservas",
      ]);
    });

    it("não altera permissões globais (nada FROM/TO PUBLIC)", () => {
      expect(sql).not.toMatch(/(FROM|TO) PUBLIC/i);
    });

    it("verifica atributos, papéis e posse das tabelas", () => {
      expect(sql).toMatch(/rolsuper OR rolcreatedb OR rolcreaterole OR rolbypassrls OR rolreplication/);
      expect(sql).toMatch(/pg_auth_members/);
      expect(sql).toMatch(/tableowner = 'app_reservas'/);
    });

    it("falha se herdar mais nas tabelas ou CREATE no esquema public", () => {
      expect(sql).toMatch(/ARRAY\['TRUNCATE', 'REFERENCES', 'TRIGGER'\]/);
      expect(sql).toMatch(/has_table_privilege\('app_reservas', tabela, permissao\)/);
      expect(sql).toMatch(
        /IF has_schema_privilege\('app_reservas', 'public', 'CREATE'\) THEN RAISE EXCEPTION/
      );
    });
  });
});

describe("executarMigracao", () => {
  it("envia o SQL numa só consulta e devolve o TEMPORARY herdado de PUBLIC do último SELECT", async () => {
    const ligacao = {
      consultar: vi.fn(async () => [
        { command: "BEGIN", rows: [] },
        { command: "CREATE", rows: [] },
        { command: "DO", rows: [] },
        { command: "SELECT", rows: [{ temporary_herdado_de_public: true }] },
        { command: "COMMIT", rows: [] },
      ]),
    };

    const resultado = await executarMigracao(ligacao);

    expect(ligacao.consultar).toHaveBeenCalledTimes(1);
    expect(ligacao.consultar).toHaveBeenCalledWith(SQL_MIGRACAO);
    expect(resultado).toEqual({ temporaryHerdadoDePublic: true });
  });

  it("dá uma mensagem clara se o app_reservas não existir", async () => {
    const erro = Object.assign(new Error('role "app_reservas" does not exist'), {
      code: "42704",
    });
    const ligacao = { consultar: vi.fn(async () => Promise.reject(erro)) };

    await expect(executarMigracao(ligacao)).rejects.toThrow(
      "O utilizador app_reservas não existe no Aiven: crie-o na consola antes de correr a migração."
    );
  });
});
