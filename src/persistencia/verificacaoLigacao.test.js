import { describe, it, expect, vi, beforeEach } from "vitest";
import tls from "node:tls";

// pg simulado: o pool entrega um cliente cujas respostas cada teste define.
const pgSimulado = vi.hoisted(() => {
  const estado = { cliente: null };
  const Pool = vi.fn(function () {
    this.on = vi.fn();
    this.query = vi.fn();
    this.end = vi.fn(async () => {});
    this.connect = vi.fn(async () => estado.cliente);
  });
  return { Pool, estado };
});

vi.mock("pg", () => ({
  default: { Pool: pgSimulado.Pool },
  Pool: pgSimulado.Pool,
}));

import { criarLigacao } from "./ligacao";
import { verificarLigacao, formatarRelatorio } from "./verificacaoLigacao";

const UTILIZADOR = "app_reservas";
const PALAVRA_PASSE = "SegredoXYZ#1";
const SERVIDOR = "servidor-falso.exemplo.com";
const ENDERECO = `postgres://${UTILIZADOR}:${encodeURIComponent(PALAVRA_PASSE)}@${SERVIDOR}:12345/bdfalsa`;
const CERTIFICADO = "-----BEGIN CERTIFICATE-----\nFALSO\n-----END CERTIFICATE-----";

function erro(mensagem, code) {
  return Object.assign(new Error(mensagem), { code });
}

// Cliente PostgreSQL falso que responde conforme o cenário e regista o SQL.
function cenario({ gravar = "ok", apagar = "recusado", savepointFalha = false } = {}) {
  const sqls = [];
  const cliente = {
    release: vi.fn(),
    connection: {
      stream: Object.assign(Object.create(tls.TLSSocket.prototype), {
        authorized: true,
        getProtocol: () => "TLSv1.3",
        getCipher: () => ({ name: "TLS_AES_256_GCM_SHA384" }),
      }),
    },
    query: vi.fn(async (sql) => {
      const texto = sql.trim();
      sqls.push(texto.split(/\s+/).slice(0, 3).join(" "));
      if (/pg_stat_ssl/.test(texto)) {
        return {
          rows: [{ utilizador: UTILIZADOR, ssl: true, version: "TLSv1.3", cipher: "TLS_AES_256_GCM_SHA384" }],
        };
      }
      if (/^SAVEPOINT/.test(texto) && savepointFalha) throw erro("savepoint falhou", "XX000");
      if (/^INSERT/.test(texto)) {
        if (gravar === "erro") {
          throw erro(`permission denied (${PALAVRA_PASSE}@${SERVIDOR})`, "42501");
        }
        return { rows: [{ id: "uuid-da-reserva-de-teste" }] };
      }
      if (/^DROP/.test(texto)) {
        if (apagar === "recusado") {
          throw erro(`must be owner of table reservas (${PALAVRA_PASSE}@${SERVIDOR})`, "42501");
        }
        if (apagar === "inesperado") throw erro("erro inesperado", "XX000");
        return { rows: [] };
      }
      if (/count\(\*\)/.test(texto)) return { rows: [{ total: 0 }] };
      return { rows: [] };
    }),
  };
  pgSimulado.estado.cliente = cliente;
  return { cliente, sqls };
}

function ligacao() {
  return criarLigacao({ databaseUrl: ENDERECO, caCert: CERTIFICADO, proxy: "" });
}

function anulouEDevolveu({ cliente, sqls }) {
  expect(sqls).toContain("ROLLBACK");
  expect(sqls.indexOf("ROLLBACK")).toBeGreaterThan(sqls.indexOf("BEGIN"));
  expect(cliente.release).toHaveBeenCalledTimes(1);
}

beforeEach(() => {
  pgSimulado.estado.cliente = null;
});

describe("verificarLigacao: a transação é sempre anulada", () => {
  it("quando tudo corre bem", async () => {
    const c = cenario();

    const relatorio = await verificarLigacao(ligacao());

    anulouEDevolveu(c);
    expect(relatorio.ok).toBe(true);
    expect(relatorio.gravar.permitido).toBe(true);
    expect(relatorio.apagar.recusado).toBe(true);
    expect(relatorio.anulacaoConfirmada).toBe(true);
  });

  it("quando gravar a reserva de teste falha", async () => {
    const c = cenario({ gravar: "erro" });

    const relatorio = await verificarLigacao(ligacao());

    anulouEDevolveu(c);
    expect(relatorio.gravar.permitido).toBe(false);
    expect(relatorio.ok).toBe(false);
  });

  it("quando apagar a tabela dá um erro inesperado", async () => {
    const c = cenario({ apagar: "inesperado" });

    const relatorio = await verificarLigacao(ligacao());

    anulouEDevolveu(c);
    expect(relatorio.apagar.recusado).toBe(false);
    expect(relatorio.ok).toBe(false);
  });

  it("quando um passo da transação falha e a verificação é interrompida", async () => {
    const c = cenario({ savepointFalha: true });

    await expect(verificarLigacao(ligacao())).rejects.toThrow("savepoint falhou");
    anulouEDevolveu(c);
  });
});

describe("verificarLigacao: permissão de apagar a tabela", () => {
  it("recusado com 42501 conta como correto", async () => {
    cenario({ apagar: "recusado" });

    const relatorio = await verificarLigacao(ligacao());

    expect(relatorio.apagar).toMatchObject({ recusado: true, problemaSeguranca: false });
  });

  it("permitido conta como problema de segurança (e é anulado)", async () => {
    const c = cenario({ apagar: "permitido" });

    const relatorio = await verificarLigacao(ligacao());

    anulouEDevolveu(c);
    expect(relatorio.apagar).toMatchObject({ recusado: false, problemaSeguranca: true });
    expect(relatorio.ok).toBe(false);
  });
});

describe("formatarRelatorio", () => {
  it("mostra o utilizador, mas nunca o endereço nem a palavra-passe", async () => {
    cenario({ gravar: "erro", apagar: "recusado" });

    const texto = formatarRelatorio(await verificarLigacao(ligacao()));

    expect(texto).toContain("app_reservas");
    expect(texto).toContain("TLSv1.3");
    expect(texto).toContain("TLS_AES_256_GCM_SHA384");
    for (const segredo of [
      ENDERECO,
      PALAVRA_PASSE,
      encodeURIComponent(PALAVRA_PASSE),
      SERVIDOR,
    ]) {
      expect(texto).not.toContain(segredo);
    }
  });
});
