import { describe, it, expect, vi } from "vitest";
import { Reserva } from "../dominio/reserva";
import { Sala } from "../dominio/sala";
import { reservarSala } from "./reservarSala";

const ERRO_OCUPADA = "A sala já tem uma reserva nesse horário.";
const ERRO_REPOSITORIO = "Não foi possível guardar a reserva.";
const ERRO_SALA_INEXISTENTE = "Sala não encontrada.";

const SALAS = [
  new Sala({ id: 10, nome: "Sala Atlântico", capacidade: 12 }),
  new Sala({ id: 20, nome: "Sala Douro", capacidade: 6 }),
];

// Data em UTC no dia 2026-11-03 ("HH:MM").
function hora(hhmm) {
  return new Date(`2026-11-03T${hhmm}:00Z`);
}

// Persistência simulada: cumpre a interface do repositório com dados em memória.
function repositorioSimulado(reservas = []) {
  let proximoId = 100;
  return {
    listarSalas: vi.fn(async () => SALAS),
    listarReservas: vi.fn(async () => reservas),
    listarReservasDaSala: vi.fn(async (salaId) =>
      reservas.filter((r) => r.salaId === salaId)
    ),
    guardarReserva: vi.fn(
      async (reserva) => new Reserva({ ...reserva, id: proximoId++ })
    ),
  };
}

const existente = new Reserva({
  id: 1,
  salaId: 10,
  inicio: hora("10:00"),
  fim: hora("11:00"),
});

describe("reservarSala", () => {
  it("guarda a reserva e devolve sucesso quando a sala está livre", async () => {
    const repositorio = repositorioSimulado([existente]);

    const resultado = await reservarSala(
      { salaId: 10, inicio: hora("14:00"), fim: hora("15:00") },
      repositorio
    );

    expect(resultado.sucesso).toBe(true);
    expect(resultado.reserva).toBeInstanceOf(Reserva);
    expect(resultado.reserva.id).toBe(100);
    expect(resultado.reserva.salaId).toBe(10);
    expect(resultado.reserva.inicio.toISOString()).toBe("2026-11-03T14:00:00.000Z");
    expect(resultado.reserva.fim.toISOString()).toBe("2026-11-03T15:00:00.000Z");
    expect(repositorio.guardarReserva).toHaveBeenCalledTimes(1);
  });

  it("consulta as reservas da sala pedida", async () => {
    const repositorio = repositorioSimulado([existente]);

    await reservarSala(
      { salaId: 10, inicio: hora("14:00"), fim: hora("15:00") },
      repositorio
    );

    expect(repositorio.listarReservasDaSala).toHaveBeenCalledWith(10);
  });

  it("não guarda e devolve erro quando a sala está ocupada", async () => {
    const repositorio = repositorioSimulado([existente]);

    const resultado = await reservarSala(
      { salaId: 10, inicio: hora("10:30"), fim: hora("11:30") },
      repositorio
    );

    expect(resultado).toEqual({ sucesso: false, erro: ERRO_OCUPADA });
    expect(repositorio.guardarReserva).not.toHaveBeenCalled();
  });

  it("não guarda e devolve erro quando a sala não existe", async () => {
    const repositorio = repositorioSimulado([existente]);

    const resultado = await reservarSala(
      { salaId: 99, inicio: hora("14:00"), fim: hora("15:00") },
      repositorio
    );

    expect(resultado).toEqual({ sucesso: false, erro: ERRO_SALA_INEXISTENTE });
    expect(repositorio.guardarReserva).not.toHaveBeenCalled();
  });

  it("aceita uma reserva que começa quando a existente acaba", async () => {
    const repositorio = repositorioSimulado([existente]);

    const resultado = await reservarSala(
      { salaId: 10, inicio: hora("11:00"), fim: hora("12:00") },
      repositorio
    );

    expect(resultado.sucesso).toBe(true);
    expect(repositorio.guardarReserva).toHaveBeenCalledTimes(1);
  });

  it("aceita outra sala no mesmo horário", async () => {
    const repositorio = repositorioSimulado([existente]);

    const resultado = await reservarSala(
      { salaId: 20, inicio: hora("10:00"), fim: hora("11:00") },
      repositorio
    );

    expect(resultado.sucesso).toBe(true);
    expect(resultado.reserva.salaId).toBe(20);
  });

  it("devolve erro sem lançar exceção quando ler as reservas falha", async () => {
    const repositorio = repositorioSimulado();
    repositorio.listarReservasDaSala.mockRejectedValue(new Error("falha"));

    const resultado = await reservarSala(
      { salaId: 10, inicio: hora("14:00"), fim: hora("15:00") },
      repositorio
    );

    expect(resultado).toEqual({ sucesso: false, erro: ERRO_REPOSITORIO });
  });

  it("devolve erro sem lançar exceção quando guardar falha", async () => {
    const repositorio = repositorioSimulado();
    repositorio.guardarReserva.mockRejectedValue(new Error("falha"));

    const resultado = await reservarSala(
      { salaId: 10, inicio: hora("14:00"), fim: hora("15:00") },
      repositorio
    );

    expect(resultado).toEqual({ sucesso: false, erro: ERRO_REPOSITORIO });
  });
});
