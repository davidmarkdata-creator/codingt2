import { describe, it, expect, vi } from "vitest";
import { Reserva } from "../dominio/reserva";
import { listarReservas } from "./listarReservas";

// Persistência simulada: só o método usado por este caso de uso.
function repositorioSimulado(reservas) {
  return { listarReservas: vi.fn(async () => reservas) };
}

describe("listarReservas", () => {
  it("devolve todas as reservas do repositório", async () => {
    const reservas = [
      new Reserva({
        id: 1,
        salaId: 10,
        inicio: new Date("2026-11-03T10:00:00Z"),
        fim: new Date("2026-11-03T11:00:00Z"),
      }),
      new Reserva({
        id: 2,
        salaId: 20,
        inicio: new Date("2026-11-05T14:30:00Z"),
        fim: new Date("2026-11-05T16:00:00Z"),
      }),
    ];
    const repositorio = repositorioSimulado(reservas);

    const resultado = await listarReservas(repositorio);

    expect(resultado).toEqual(reservas);
    expect(repositorio.listarReservas).toHaveBeenCalledTimes(1);
  });

  it("devolve uma lista vazia quando não há reservas", async () => {
    const resultado = await listarReservas(repositorioSimulado([]));

    expect(resultado).toEqual([]);
  });
});
