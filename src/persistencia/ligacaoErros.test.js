import { describe, it, expect, vi, beforeEach } from "vitest";

// pg simulado: o pool e o cliente falham com o erro preparado em cada teste.
const pgSimulado = vi.hoisted(() => {
  const estado = { erro: null };
  const Pool = vi.fn(function () {
    this.on = vi.fn();
    this.end = vi.fn(async () => {});
    this.query = vi.fn(async () => Promise.reject(estado.erro));
    this.connect = vi.fn(async () => ({
      query: vi.fn(async () => Promise.reject(estado.erro)),
      release: vi.fn(),
      connection: { stream: {} },
    }));
  });
  return { Pool, estado };
});

vi.mock("pg", () => ({
  default: { Pool: pgSimulado.Pool },
  Pool: pgSimulado.Pool,
}));

import { criarLigacao } from "./ligacao";

const UTILIZADOR = "utilizadorFalsoXYZ";
const PALAVRA_PASSE = "SegredoXYZ#1";
const SERVIDOR = "servidor-falso.exemplo.com";
const ENDERECO = `postgres://${UTILIZADOR}:${encodeURIComponent(PALAVRA_PASSE)}@${SERVIDOR}:12345/bdfalsa`;
const CERTIFICADO = "-----BEGIN CERTIFICATE-----\nFALSO\n-----END CERTIFICATE-----";

function ligacao() {
  return criarLigacao({ databaseUrl: ENDERECO, caCert: CERTIFICADO, proxy: "" });
}

beforeEach(() => {
  pgSimulado.estado.erro = Object.assign(
    new Error(
      `conflicting key value violates exclusion constraint "reservas_sem_sobreposicao" (${PALAVRA_PASSE}@${SERVIDOR})`
    ),
    { code: "23P01", constraint: "reservas_sem_sobreposicao" }
  );
});

describe("erros limpos da ligação: propriedade constraint", () => {
  it("consultar preserva code e constraint, e limpa os segredos da mensagem", async () => {
    const erro = await ligacao().consultar("INSERT ...").catch((e) => e);

    expect(erro.code).toBe("23P01");
    expect(erro.constraint).toBe("reservas_sem_sobreposicao");
    for (const segredo of [UTILIZADOR, PALAVRA_PASSE, SERVIDOR]) {
      expect(erro.message).not.toContain(segredo);
    }
  });

  it("comCliente preserva code e constraint", async () => {
    const erro = await ligacao()
      .comCliente((c) => c.consultar("INSERT ..."))
      .catch((e) => e);

    expect(erro.code).toBe("23P01");
    expect(erro.constraint).toBe("reservas_sem_sobreposicao");
  });

  it("também limpa segredos que apareçam na constraint", async () => {
    pgSimulado.estado.erro = Object.assign(new Error("falha"), {
      code: "23P01",
      constraint: `restricao_${PALAVRA_PASSE}`,
    });

    const erro = await ligacao().consultar("INSERT ...").catch((e) => e);

    expect(erro.constraint).not.toContain(PALAVRA_PASSE);
  });

  it("não acrescenta constraint quando o erro original não a tem", async () => {
    pgSimulado.estado.erro = Object.assign(new Error("falha"), { code: "XX000" });

    const erro = await ligacao().consultar("SELECT 1").catch((e) => e);

    expect(erro).not.toHaveProperty("constraint");
  });
});
