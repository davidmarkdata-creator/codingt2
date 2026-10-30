import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// pg simulado: regista o que o Pool recebe; nunca abre ligações de rede.
const pgSimulado = vi.hoisted(() => {
  const pools = [];
  const Pool = vi.fn(function (config) {
    this.config = config;
    this.on = vi.fn();
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
import { interpretarProxy } from "./tunelProxy";

const ENDERECO = "postgres://utilizador:palavra@bd.exemplo.com:12345/bd?sslmode=require";
const CERTIFICADO = "-----BEGIN CERTIFICATE-----\nFALSO\n-----END CERTIFICATE-----";
const ERRO_PROXY_INVALIDO =
  "DATABASE_PROXY não é válido: use o formato http://servidor:porta.";

const variaveis = {};

beforeEach(() => {
  for (const nome of ["DATABASE_URL", "DATABASE_CA_CERT", "DATABASE_PROXY"]) {
    variaveis[nome] = process.env[nome];
    delete process.env[nome];
  }
  process.env.DATABASE_URL = ENDERECO;
  process.env.DATABASE_CA_CERT = CERTIFICADO;
  pgSimulado.Pool.mockClear();
  pgSimulado.pools.length = 0;
});

afterEach(() => {
  for (const [nome, valor] of Object.entries(variaveis)) {
    if (valor === undefined) delete process.env[nome];
    else process.env[nome] = valor;
  }
});

describe("criarLigacao com DATABASE_PROXY", () => {
  it("sem DATABASE_PROXY, a configuração fica igual à de hoje (sem túnel)", () => {
    criarLigacao();

    const config = pgSimulado.pools[0].config;
    expect(Object.keys(config).sort()).toEqual(["connectionString", "ssl"]);
    expect(config.ssl).toEqual({ ca: CERTIFICADO, rejectUnauthorized: true });
  });

  it("aceita o proxy com ou sem http:// e usa um túnel por ligação", () => {
    for (const valor of ["192.0.2.10:3128", "http://192.0.2.10:3128/"]) {
      expect(interpretarProxy(valor)).toEqual({ host: "192.0.2.10", port: 3128 });

      pgSimulado.pools.length = 0;
      process.env.DATABASE_PROXY = valor;
      criarLigacao();

      const config = pgSimulado.pools[0].config;
      expect(typeof config.stream).toBe("function");
      expect(config.ssl).toEqual({ ca: CERTIFICADO, rejectUnauthorized: true });
    }
  });

  it("recusa um proxy inválido com uma mensagem clara e não liga", () => {
    const invalidos = [
      "isto não é um proxy",
      "http://192.0.2.10",
      "https://192.0.2.10:3128",
      "http://utilizador:palavra@192.0.2.10:3128",
      "http://192.0.2.10:3128/caminho",
      "192.0.2.10:99999",
    ];

    for (const valor of invalidos) {
      process.env.DATABASE_PROXY = valor;
      expect(() => criarLigacao(), valor).toThrow(ERRO_PROXY_INVALIDO);
    }
    expect(pgSimulado.Pool).not.toHaveBeenCalled();
  });
});
