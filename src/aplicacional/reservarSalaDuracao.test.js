import { describe, it, expect, vi } from "vitest";
import { Reserva } from "../dominio/reserva";
import { Sala } from "../dominio/sala";
import { reservarSala } from "./reservarSala";

const ERRO_DURACAO = "A reserva não pode durar mais de 2 horas.";

function hora(hhmm) {
  return new Date(`2026-11-03T${hhmm}:00Z`);
}

// Persistência simulada: uma sala livre (id 10), sem reservas.
function repositorioSimulado() {
  return {
    listarSalas: vi.fn(async () => [
      new Sala({ id: 10, nome: "Sala Atlântico", capacidade: 12 }),
    ]),
    listarReservas: vi.fn(async () => []),
    listarReservasDaSala: vi.fn(async () => []),
    guardarReserva: vi.fn(async (reserva) => new Reserva({ ...reserva, id: 100 })),
  };
}

describe("reservarSala: uma reserva tem no máximo 2 horas", () => {
  it("recusa uma reserva com mais de 2 horas, devolve o erro e não lança exceção", async () => {
    const repositorio = repositorioSimulado();

    const promessa = reservarSala(
      { salaId: 10, inicio: hora("10:00"), fim: hora("12:01") },
      repositorio
    );

    await expect(promessa).resolves.toEqual({ sucesso: false, erro: ERRO_DURACAO });
    expect(repositorio.guardarReserva).not.toHaveBeenCalled();
  });

  it("aceita uma reserva de exatamente 2 horas", async () => {
    const repositorio = repositorioSimulado();

    const resultado = await reservarSala(
      { salaId: 10, inicio: hora("10:00"), fim: hora("12:00") },
      repositorio
    );

    expect(resultado.sucesso).toBe(true);
    expect(repositorio.guardarReserva).toHaveBeenCalledTimes(1);
  });
});
