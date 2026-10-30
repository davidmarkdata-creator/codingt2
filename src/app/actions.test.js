import { describe, it, expect, vi, beforeEach } from "vitest";
import { Sala } from "../dominio/sala";
import { Reserva } from "../dominio/reserva";
import { criarRepositorioEmMemoria } from "../persistencia/repositorioEmMemoria";

// O repositório PostgreSQL é substituído por um repositório em memória que cada
// teste prepara: nenhum teste liga à base de dados.
const estado = vi.hoisted(() => ({ repositorio: null }));

vi.mock("../persistencia/ligacao", () => ({ criarLigacao: () => ({}) }));
vi.mock("../persistencia/repositorioPostgres", () => ({
  criarRepositorioPostgres: () => ({
    listarSalas: (...a) => estado.repositorio.listarSalas(...a),
    listarReservas: (...a) => estado.repositorio.listarReservas(...a),
    listarReservasDaSala: (...a) => estado.repositorio.listarReservasDaSala(...a),
    guardarReserva: (...a) => estado.repositorio.guardarReserva(...a),
  }),
}));

import { obterSalas, obterReservas } from "./actions";

const SALA_A = new Sala({ id: "uuid-sala-a", nome: "Sala A", capacidade: 12 });
const SALA_B = new Sala({ id: "uuid-sala-b", nome: "Sala B", capacidade: 6 });

const SEGREDOS = ["SegredoXYZ", "servidor-falso.exemplo.com"];

// Só dados simples: nada de entidades (classes) nem Date.
function soDadosSimples(valor) {
  if (Array.isArray(valor)) return valor.forEach(soDadosSimples);
  if (valor !== null && typeof valor === "object") {
    expect(Object.getPrototypeOf(valor)).toBe(Object.prototype);
    Object.values(valor).forEach(soDadosSimples);
    return;
  }
  expect(["string", "number", "boolean"]).toContain(typeof valor);
}

beforeEach(() => {
  estado.repositorio = criarRepositorioEmMemoria({ salas: [SALA_A, SALA_B] });
});

describe("obterSalas", () => {
  it("devolve as salas da base de dados como dados simples, com o id UUID", async () => {
    const resultado = await obterSalas();

    expect(resultado).toEqual({
      sucesso: true,
      salas: [
        { id: "uuid-sala-a", nome: "Sala A", capacidade: 12 },
        { id: "uuid-sala-b", nome: "Sala B", capacidade: 6 },
      ],
    });
    soDadosSimples(resultado);
  });

  it("devolve uma mensagem de erro sem segredos quando a base de dados falha", async () => {
    estado.repositorio.listarSalas = async () => {
      throw new Error(`ligação a ${SEGREDOS[1]} falhou (${SEGREDOS[0]})`);
    };

    const resultado = await obterSalas();

    expect(resultado).toEqual({ sucesso: false, erro: "Não foi possível carregar as salas." });
    for (const segredo of SEGREDOS) expect(JSON.stringify(resultado)).not.toContain(segredo);
  });
});

describe("obterReservas", () => {
  it("junta o nome da sala e formata a data e as horas em hora de Lisboa", async () => {
    estado.repositorio = criarRepositorioEmMemoria({
      salas: [SALA_A, SALA_B],
      reservas: [
        new Reserva({
          id: "uuid-r1",
          salaId: "uuid-sala-a",
          inicio: new Date("2026-07-10T09:00:00Z"), // verão: 10:00 em Lisboa
          fim: new Date("2026-07-10T10:00:00Z"),
        }),
        new Reserva({
          id: "uuid-r2",
          salaId: "uuid-sala-b",
          inicio: new Date("2026-11-03T10:00:00Z"), // inverno: 10:00 em Lisboa
          fim: new Date("2026-11-03T11:30:00Z"),
        }),
      ],
    });

    const resultado = await obterReservas();

    expect(resultado).toEqual({
      sucesso: true,
      reservas: [
        { id: "uuid-r1", nomeSala: "Sala A", data: "10/07/2026", inicio: "10:00", fim: "11:00" },
        { id: "uuid-r2", nomeSala: "Sala B", data: "03/11/2026", inicio: "10:00", fim: "11:30" },
      ],
    });
    soDadosSimples(resultado);
  });

  it("devolve uma lista vazia quando não há reservas", async () => {
    expect(await obterReservas()).toEqual({ sucesso: true, reservas: [] });
  });

  it("devolve uma mensagem de erro sem segredos quando a base de dados falha", async () => {
    estado.repositorio.listarReservas = async () => {
      throw new Error(`ligação a ${SEGREDOS[1]} falhou (${SEGREDOS[0]})`);
    };

    const resultado = await obterReservas();

    expect(resultado).toEqual({ sucesso: false, erro: "Não foi possível carregar as reservas." });
    for (const segredo of SEGREDOS) expect(JSON.stringify(resultado)).not.toContain(segredo);
  });
});
