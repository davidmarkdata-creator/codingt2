import { describe, it, expect, vi } from "vitest";
import { Reserva } from "../dominio/reserva";
import { Sala } from "../dominio/sala";
import { reservarSala } from "./reservarSala";

const ERRO_INTERVALO = "A hora de fim tem de ser depois da hora de início.";

function hora(texto) {
  return new Date(`2026-12-15T${texto}:00Z`);
}

// Persistência simulada: uma sala (id 10), sem reservas.
function repositorioSimulado() {
  return {
    listarSalas: vi.fn(async () => [new Sala({ id: 10, nome: "Sala A", capacidade: 12 })]),
    listarReservas: vi.fn(async () => []),
    listarReservasDaSala: vi.fn(async () => []),
    guardarReserva: vi.fn(async (reserva) => new Reserva({ ...reserva, id: 100 })),
  };
}

describe("reservarSala: o fim tem de ser depois do início", () => {
  it("recusa 11:00 → 00:00 do mesmo dia, devolve o erro e não lança exceção", async () => {
    const repositorio = repositorioSimulado();

    const promessa = reservarSala(
      { salaId: 10, inicio: hora("11:00"), fim: hora("00:00") },
      repositorio
    );

    await expect(promessa).resolves.toEqual({ sucesso: false, erro: ERRO_INTERVALO });
    expect(repositorio.listarReservasDaSala).not.toHaveBeenCalled();
    expect(repositorio.guardarReserva).not.toHaveBeenCalled();
  });

  it("recusa uma reserva com duração zero", async () => {
    const repositorio = repositorioSimulado();

    const resultado = await reservarSala(
      { salaId: 10, inicio: hora("11:00"), fim: hora("11:00") },
      repositorio
    );

    expect(resultado).toEqual({ sucesso: false, erro: ERRO_INTERVALO });
    expect(repositorio.guardarReserva).not.toHaveBeenCalled();
  });
});
