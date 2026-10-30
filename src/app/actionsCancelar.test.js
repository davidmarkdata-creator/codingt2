import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Sala } from "../dominio/sala";
import { Reserva } from "../dominio/reserva";
import { criarRepositorioEmMemoria } from "../persistencia/repositorioEmMemoria";

// Repositório PostgreSQL substituído por um em memória; refresh() do Next simulado.
const estado = vi.hoisted(() => ({ repositorio: null }));
const cache = vi.hoisted(() => ({ refresh: vi.fn() }));

vi.mock("next/cache", () => cache);
vi.mock("../persistencia/ligacao", () => ({ criarLigacao: () => ({}) }));
vi.mock("../persistencia/repositorioPostgres", () => ({
  criarRepositorioPostgres: () =>
    new Proxy({}, { get: (_alvo, metodo) => (...a) => estado.repositorio[metodo](...a) }),
}));

import { cancelarReservaAction, obterReservas } from "./actions";

const AGORA = new Date("2026-11-05T12:00:00Z");
const SALA = new Sala({ id: "uuid-sala-a", nome: "Sala A", capacidade: 12 });
const FUTURA = new Reserva({
  id: "uuid-futura",
  salaId: "uuid-sala-a",
  inicio: new Date("2026-11-05T14:00:00Z"),
  fim: new Date("2026-11-05T15:00:00Z"),
});
const PASSADA = new Reserva({
  id: "uuid-passada",
  salaId: "uuid-sala-a",
  inicio: new Date("2026-11-04T10:00:00Z"),
  fim: new Date("2026-11-04T11:00:00Z"),
});

function pedido(reservaId) {
  const dados = new FormData();
  dados.set("reservaId", reservaId);
  return dados;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(AGORA);
  cache.refresh.mockClear();
  estado.repositorio = criarRepositorioEmMemoria({ salas: [SALA], reservas: [FUTURA, PASSADA] });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("cancelarReservaAction", () => {
  it("cancela uma reserva futura, devolve só { sucesso: true } e atualiza a página", async () => {
    expect(await cancelarReservaAction(null, pedido("uuid-futura"))).toEqual({ sucesso: true });

    expect(await estado.repositorio.obterReserva("uuid-futura")).toBeNull();
    expect(cache.refresh).toHaveBeenCalledTimes(1);
  });

  it("recusa uma reserva passada, sem apagar nem atualizar", async () => {
    expect(await cancelarReservaAction(null, pedido("uuid-passada"))).toEqual({
      sucesso: false,
      erro: "Só é possível cancelar reservas futuras.",
    });

    expect(await estado.repositorio.obterReserva("uuid-passada")).not.toBeNull();
    expect(cache.refresh).not.toHaveBeenCalled();
  });

  it("dá 'não encontrada' para um id que não existe", async () => {
    expect(await cancelarReservaAction(null, pedido("uuid-inexistente"))).toEqual({
      sucesso: false,
      erro: "Reserva não encontrada.",
    });
  });
});

describe("obterReservas: podeCancelar", () => {
  it("indica que só as reservas futuras podem ser canceladas", async () => {
    const { reservas } = await obterReservas();

    expect(reservas.find((r) => r.id === "uuid-futura").podeCancelar).toBe(true);
    expect(reservas.find((r) => r.id === "uuid-passada").podeCancelar).toBe(false);
  });
});
