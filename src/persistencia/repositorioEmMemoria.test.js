import { describe, it, expect } from "vitest";
import { Sala } from "../dominio/sala";
import { Reserva } from "../dominio/reserva";
import { criarRepositorioEmMemoria } from "./repositorioEmMemoria";

const SALAS = [
  new Sala({ id: 10, nome: "Sala Atlântico", capacidade: 12 }),
  new Sala({ id: 20, nome: "Sala Douro", capacidade: 6 }),
];

function reserva(id, salaId, inicio, fim) {
  return new Reserva({
    id,
    salaId,
    inicio: new Date(`2026-11-03T${inicio}:00Z`),
    fim: new Date(`2026-11-03T${fim}:00Z`),
  });
}

describe("criarRepositorioEmMemoria", () => {
  it("começa vazio quando não recebe dados", async () => {
    const repositorio = criarRepositorioEmMemoria();

    expect(await repositorio.listarSalas()).toEqual([]);
    expect(await repositorio.listarReservas()).toEqual([]);
  });

  it("lista as salas recebidas", async () => {
    const repositorio = criarRepositorioEmMemoria({ salas: SALAS });

    expect(await repositorio.listarSalas()).toEqual(SALAS);
  });

  it("lista todas as reservas", async () => {
    const reservas = [reserva(1, 10, "10:00", "11:00"), reserva(2, 20, "10:00", "11:00")];
    const repositorio = criarRepositorioEmMemoria({ reservas });

    expect(await repositorio.listarReservas()).toEqual(reservas);
  });

  it("lista só as reservas da sala pedida", async () => {
    const daSala10 = reserva(1, 10, "10:00", "11:00");
    const daSala20 = reserva(2, 20, "10:00", "11:00");
    const repositorio = criarRepositorioEmMemoria({ reservas: [daSala10, daSala20] });

    expect(await repositorio.listarReservasDaSala(10)).toEqual([daSala10]);
    expect(await repositorio.listarReservasDaSala(99)).toEqual([]);
  });

  it("guarda uma reserva nova e dá-lhe um id", async () => {
    const repositorio = criarRepositorioEmMemoria();
    const nova = new Reserva({
      salaId: 10,
      inicio: new Date("2026-11-03T14:00:00Z"),
      fim: new Date("2026-11-03T15:00:00Z"),
    });

    const guardada = await repositorio.guardarReserva(nova);

    expect(guardada).toBeInstanceOf(Reserva);
    expect(guardada.id).toBe(1);
    expect(guardada.salaId).toBe(10);
    expect(guardada.inicio.toISOString()).toBe("2026-11-03T14:00:00.000Z");
    expect(guardada.fim.toISOString()).toBe("2026-11-03T15:00:00.000Z");
    expect(await repositorio.listarReservas()).toEqual([guardada]);
    expect(await repositorio.listarReservasDaSala(10)).toEqual([guardada]);
  });

  it("dá ids seguidos a seguir ao maior id existente", async () => {
    const repositorio = criarRepositorioEmMemoria({
      reservas: [reserva(5, 10, "08:00", "09:00")],
    });

    const primeira = await repositorio.guardarReserva(reserva(undefined, 10, "10:00", "11:00"));
    const segunda = await repositorio.guardarReserva(reserva(undefined, 20, "10:00", "11:00"));

    expect(primeira.id).toBe(6);
    expect(segunda.id).toBe(7);
  });

  it("alterar a lista devolvida não altera os dados guardados", async () => {
    const repositorio = criarRepositorioEmMemoria({ salas: SALAS });

    const salas = await repositorio.listarSalas();
    salas.pop();

    expect(await repositorio.listarSalas()).toHaveLength(2);
  });

  it("cada repositório tem os seus próprios dados", async () => {
    const a = criarRepositorioEmMemoria();
    const b = criarRepositorioEmMemoria();

    await a.guardarReserva(reserva(undefined, 10, "10:00", "11:00"));

    expect(await a.listarReservas()).toHaveLength(1);
    expect(await b.listarReservas()).toEqual([]);
  });
});
