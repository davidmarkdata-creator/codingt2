import { describe, it, expect, vi, beforeEach } from "vitest";
import { Sala } from "../dominio/sala";
import { criarRepositorioEmMemoria } from "../persistencia/repositorioEmMemoria";

// O repositório PostgreSQL é substituído por um repositório em memória: nenhum
// teste liga à base de dados.
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

import { reservarSalaAction } from "./actions";

const SALA_A = new Sala({ id: "uuid-sala-a", nome: "Sala A", capacidade: 12 });

function formulario({ salaId = "uuid-sala-a", data, inicio, fim }) {
  const dados = new FormData();
  dados.set("salaId", salaId);
  dados.set("data", data);
  dados.set("inicio", inicio);
  dados.set("fim", fim);
  return dados;
}

beforeEach(() => {
  estado.repositorio = criarRepositorioEmMemoria({ salas: [SALA_A] });
});

describe("reservarSalaAction: do formulário ao repositório", () => {
  it("guarda a reserva com as horas de Lisboa convertidas para UTC e devolve só { sucesso: true }", async () => {
    const resultado = await reservarSalaAction(
      null,
      formulario({ data: "2026-07-10", inicio: "10:00", fim: "11:00" })
    );

    expect(resultado).toEqual({ sucesso: true });
    const [guardada] = await estado.repositorio.listarReservas();
    expect(guardada.salaId).toBe("uuid-sala-a");
    expect(guardada.inicio.toISOString()).toBe("2026-07-10T09:00:00.000Z");
    expect(guardada.fim.toISOString()).toBe("2026-07-10T10:00:00.000Z");
  });

  it("recusa 11:00 → 00:00 do mesmo dia, sem guardar", async () => {
    const resultado = await reservarSalaAction(
      null,
      formulario({ data: "2026-12-15", inicio: "11:00", fim: "00:00" })
    );

    expect(resultado).toEqual({
      sucesso: false,
      erro: "A hora de fim tem de ser depois da hora de início.",
    });
    expect(await estado.repositorio.listarReservas()).toEqual([]);
  });

  it("recusa uma hora que não existe em Lisboa (mudança de março), sem guardar", async () => {
    const resultado = await reservarSalaAction(
      null,
      formulario({ data: "2026-03-29", inicio: "01:30", fim: "02:30" })
    );

    expect(resultado).toEqual({
      sucesso: false,
      erro: "Hora inválida em Lisboa (mudança de hora).",
    });
    expect(await estado.repositorio.listarReservas()).toEqual([]);
  });
});
