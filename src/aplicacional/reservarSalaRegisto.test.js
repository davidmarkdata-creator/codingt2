import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Reserva } from "../dominio/reserva";
import { Sala } from "../dominio/sala";
import { ErroSobreposicao } from "../dominio/erros";
import { reservarSala } from "./reservarSala";

const PEDIDO = {
  salaId: 10,
  inicio: new Date("2026-12-15T10:00:00Z"),
  fim: new Date("2026-12-15T11:00:00Z"),
};

function repositorio(guardarReserva) {
  return {
    listarSalas: vi.fn(async () => [new Sala({ id: 10, nome: "Sala A", capacidade: 12 })]),
    listarReservas: vi.fn(async () => []),
    listarReservasDaSala: vi.fn(async () => []),
    guardarReserva: vi.fn(guardarReserva),
  };
}

let registos;

beforeEach(() => {
  registos = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  registos.mockRestore();
});

describe("reservarSala: registo de erros no servidor", () => {
  it("regista a causa quando o repositório falha, mantendo a mensagem ao utilizador", async () => {
    const resultado = await reservarSala(
      PEDIDO,
      repositorio(async () => {
        throw new Error("ligação perdida");
      })
    );

    expect(resultado).toEqual({ sucesso: false, erro: "Não foi possível guardar a reserva." });
    expect(registos).toHaveBeenCalledTimes(1);
    expect(registos.mock.calls[0].join(" ")).toContain("ligação perdida");
  });

  it("não regista nada quando a reserva é guardada", async () => {
    await reservarSala(PEDIDO, repositorio(async (r) => new Reserva({ ...r, id: 1 })));

    expect(registos).not.toHaveBeenCalled();
  });

  it("não regista a sobreposição recusada pela base de dados (é um resultado normal)", async () => {
    await reservarSala(
      PEDIDO,
      repositorio(async () => {
        throw new ErroSobreposicao();
      })
    );

    expect(registos).not.toHaveBeenCalled();
  });
});
