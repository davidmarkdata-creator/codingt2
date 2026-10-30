import { describe, it, expect, vi, beforeEach } from "vitest";
import tls from "node:tls";

// pg simulado: o pool entrega o cliente preparado em cada teste.
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

const UTILIZADOR = "utilizadorFalsoXYZ";
const PALAVRA_PASSE = "SegredoXYZ#1";
const SERVIDOR = "servidor-falso.exemplo.com";
const ENDERECO = `postgres://${UTILIZADOR}:${encodeURIComponent(PALAVRA_PASSE)}@${SERVIDOR}:12345/bdfalsa`;
const CERTIFICADO = "-----BEGIN CERTIFICATE-----\nFALSO\n-----END CERTIFICATE-----";

// Um TLSSocket falso (sem rede), com os dados que o Node expõe.
function streamTls({ autorizado = true } = {}) {
  return Object.assign(Object.create(tls.TLSSocket.prototype), {
    authorized: autorizado,
    getProtocol: () => "TLSv1.3",
    getCipher: () => ({ name: "TLS_AES_256_GCM_SHA384", version: "TLSv1.3" }),
  });
}

function clienteFalso(stream = streamTls()) {
  return { query: vi.fn(async () => ({ rows: [] })), release: vi.fn(), connection: { stream } };
}

function ligacao() {
  return criarLigacao({ databaseUrl: ENDERECO, caCert: CERTIFICADO, proxy: "" });
}

beforeEach(() => {
  pgSimulado.estado.cliente = clienteFalso();
});

describe("comCliente", () => {
  it("usa uma só ligação do pool e devolve-a no fim", async () => {
    const cliente = pgSimulado.estado.cliente;

    const resultado = await ligacao().comCliente(async (c) => {
      await c.consultar("SELECT 1");
      await c.consultar("SELECT 2");
      return "feito";
    });

    expect(resultado).toBe("feito");
    expect(cliente.query).toHaveBeenCalledTimes(2);
    expect(cliente.release).toHaveBeenCalledTimes(1);
  });

  it("devolve a ligação ao pool mesmo quando a função falha", async () => {
    const cliente = pgSimulado.estado.cliente;

    await expect(
      ligacao().comCliente(async () => {
        throw new Error("falhou a meio");
      })
    ).rejects.toThrow("falhou a meio");
    expect(cliente.release).toHaveBeenCalledTimes(1);
  });

  it("limpa o endereço, o utilizador e a palavra-passe dos erros", async () => {
    const cliente = pgSimulado.estado.cliente;
    cliente.query.mockRejectedValue(
      Object.assign(new Error(`falha de ${UTILIZADOR}:${PALAVRA_PASSE}@${SERVIDOR}`), {
        code: "XX000",
      })
    );

    const erro = await ligacao()
      .comCliente((c) => c.consultar("SELECT 1"))
      .catch((e) => e);

    for (const segredo of [UTILIZADOR, PALAVRA_PASSE, SERVIDOR]) {
      expect(erro.message).not.toContain(segredo);
    }
    expect(erro.code).toBe("XX000");
    expect(cliente.release).toHaveBeenCalledTimes(1);
  });

  it("mantém os métodos que já existiam", () => {
    const l = ligacao();
    expect(typeof l.consultar).toBe("function");
    expect(typeof l.fechar).toBe("function");
  });
});

describe("infoTls", () => {
  it("lê o protocolo, a cifra e a confirmação do certificado", async () => {
    const info = await ligacao().comCliente(async (c) => c.infoTls());

    expect(info).toEqual({
      cifrada: true,
      protocolo: "TLSv1.3",
      cifra: "TLS_AES_256_GCM_SHA384",
      certificadoConfirmado: true,
    });
  });

  it("indica quando o certificado não foi confirmado", async () => {
    pgSimulado.estado.cliente = clienteFalso(streamTls({ autorizado: false }));

    const info = await ligacao().comCliente(async (c) => c.infoTls());

    expect(info.cifrada).toBe(true);
    expect(info.certificadoConfirmado).toBe(false);
  });

  it("indica 'não cifrada' quando a ligação não é TLS", async () => {
    pgSimulado.estado.cliente = clienteFalso({});

    const info = await ligacao().comCliente(async (c) => c.infoTls());

    expect(info).toEqual({
      cifrada: false,
      protocolo: null,
      cifra: null,
      certificadoConfirmado: false,
    });
  });
});
