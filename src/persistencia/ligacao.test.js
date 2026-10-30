import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// pg simulado: regista o que o Pool recebe; nunca abre ligações de rede.
const pgSimulado = vi.hoisted(() => {
  const pools = [];
  const Pool = vi.fn(function (config) {
    this.config = config;
    this.handlers = {};
    this.on = vi.fn((evento, fn) => {
      this.handlers[evento] = fn;
    });
    this.query = vi.fn();
    this.end = vi.fn(async () => {});
    pools.push(this);
  });
  return { Pool, pools };
});

vi.mock("pg", () => ({
  default: { Pool: pgSimulado.Pool },
  Pool: pgSimulado.Pool,
}));

import { criarLigacao } from "./ligacao";

// Dados falsos, para os testes procurarem nas mensagens.
const UTILIZADOR = "utilizadorFalsoXYZ";
const PALAVRA_PASSE = "SegredoXYZ#1";
const SERVIDOR = "servidor-falso.exemplo.com";
const ENDERECO = `postgres://${UTILIZADOR}:${encodeURIComponent(PALAVRA_PASSE)}@${SERVIDOR}:12345/bdfalsa?sslmode=require`;
const CERTIFICADO = "-----BEGIN CERTIFICATE-----\nFALSO\n-----END CERTIFICATE-----";

function semSegredos(texto) {
  for (const segredo of [
    UTILIZADOR,
    PALAVRA_PASSE,
    encodeURIComponent(PALAVRA_PASSE),
    SERVIDOR,
  ]) {
    expect(texto).not.toContain(segredo);
  }
}

const variaveis = {};

beforeEach(() => {
  for (const nome of ["DATABASE_URL", "DATABASE_CA_CERT"]) {
    variaveis[nome] = process.env[nome];
    delete process.env[nome];
  }
  pgSimulado.Pool.mockClear();
  pgSimulado.pools.length = 0;
});

afterEach(() => {
  for (const [nome, valor] of Object.entries(variaveis)) {
    if (valor === undefined) delete process.env[nome];
    else process.env[nome] = valor;
  }
  vi.restoreAllMocks();
});

describe("criarLigacao", () => {
  it("não liga sem endereço e explica porquê", () => {
    process.env.DATABASE_CA_CERT = CERTIFICADO;

    expect(() => criarLigacao()).toThrow(/DATABASE_URL/);
    expect(pgSimulado.Pool).not.toHaveBeenCalled();
  });

  it("não liga sem certificado e explica porquê", () => {
    process.env.DATABASE_URL = ENDERECO;

    expect(() => criarLigacao()).toThrow(/DATABASE_CA_CERT/);
    expect(pgSimulado.Pool).not.toHaveBeenCalled();
  });

  it("nunca mostra a palavra-passe, o utilizador nem o endereço", async () => {
    // 1) Na mensagem de configuração em falta.
    let mensagem = "";
    try {
      criarLigacao({ databaseUrl: ENDERECO });
    } catch (erro) {
      mensagem = erro.message;
    }
    expect(mensagem).not.toBe("");
    semSegredos(mensagem);

    // 2) Num erro devolvido pela base de dados ao consultar.
    const ligacao = criarLigacao({ databaseUrl: ENDERECO, caCert: CERTIFICADO });
    const pool = pgSimulado.pools[0];
    pool.query.mockRejectedValue(
      new Error(
        `password authentication failed for user "${UTILIZADOR}" (${PALAVRA_PASSE}) ` +
          `at ${SERVIDOR}:12345 — ${ENDERECO}`
      )
    );
    const erro = await ligacao.consultar("SELECT 1").catch((e) => e);
    expect(erro).toBeInstanceOf(Error);
    semSegredos(erro.message);
    semSegredos(String(erro.stack));

    // 3) Nos registos de erros da ligação.
    const registos = vi.spyOn(console, "error").mockImplementation(() => {});
    pool.handlers.error(
      new Error(`connection to ${SERVIDOR} as ${UTILIZADOR}:${PALAVRA_PASSE} lost`)
    );
    expect(registos).toHaveBeenCalled();
    semSegredos(registos.mock.calls.flat().map(String).join(" "));
  });
});

describe("criarLigacao: requisitos de segurança da ligação", () => {
  const ENDERECO_COM_SSL =
    `postgres://${UTILIZADOR}:${encodeURIComponent(PALAVRA_PASSE)}@${SERVIDOR}:12345/bdfalsa` +
    "?sslmode=disable&sslrootcert=raiz.pem&sslcert=cliente.pem&sslkey=chave.pem&ssl=false";

  function configuracaoDoPool() {
    criarLigacao({ databaseUrl: ENDERECO_COM_SSL, caCert: CERTIFICADO });
    return pgSimulado.pools[0].config;
  }

  it("retira do endereço todos os parâmetros de SSL", () => {
    const parametros = new URL(configuracaoDoPool().connectionString).searchParams;

    for (const nome of ["sslmode", "sslrootcert", "sslcert", "sslkey", "ssl"]) {
      expect(parametros.has(nome)).toBe(false);
    }
  });

  it("liga sempre cifrado e verifica o certificado do Aiven", () => {
    const { ssl } = configuracaoDoPool();

    expect(ssl.rejectUnauthorized).toBe(true);
    expect(ssl.ca).toBe(CERTIFICADO);
  });

  it("converte \\n escritos como texto no certificado em quebras de linha", () => {
    const certificadoNumaLinha = CERTIFICADO.replace(/\n/g, "\\n");
    expect(certificadoNumaLinha).not.toContain("\n");

    criarLigacao({ databaseUrl: ENDERECO, caCert: certificadoNumaLinha });

    expect(pgSimulado.pools[0].config.ssl.ca).toBe(CERTIFICADO);
  });
});
