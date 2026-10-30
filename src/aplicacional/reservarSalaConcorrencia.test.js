import { describe, it, expect, vi } from "vitest";
import { Reserva } from "../dominio/reserva";
import { Sala } from "../dominio/sala";
import { ErroSobreposicao } from "../dominio/erros";
import { temSobreposicao } from "../dominio/sobreposicao";
import { reservarSala } from "./reservarSala";

const ERRO_OCUPADA = "A sala já tem uma reserva nesse horário.";
const ERRO_REPOSITORIO = "Não foi possível guardar a reserva.";
const SALA = new Sala({ id: "uuid-sala-c", nome: "Sala C", capacidade: 20 });
const PEDIDO = {
  salaId: "uuid-sala-c",
  inicio: new Date("2099-01-01T10:00:00Z"),
  fim: new Date("2099-01-01T11:00:00Z"),
};

// Repositório controlado, sem base de dados. As leituras demoram um pouco, para
// que pedidos simultâneos leiam todos antes de qualquer gravação (a condição de
// corrida). Com `exclusaoAtomica`, a gravação verifica e guarda de uma só vez,
// como faz a restrição EXCLUDE do PostgreSQL.
function repositorioControlado({ exclusaoAtomica }) {
  const guardadas = [];
  let proximoId = 1;
  const esperar = () => new Promise((resolve) => setTimeout(resolve, 5));
  return {
    guardadas,
    listarSalas: async () => [SALA],
    listarReservas: async () => [...guardadas],
    async listarReservasDaSala(salaId) {
      // Como numa base de dados: lê o estado no momento da consulta e só depois responde.
      const lidas = guardadas.filter((r) => r.salaId === salaId);
      await esperar();
      return lidas;
    },
    async guardarReserva(reserva) {
      if (exclusaoAtomica && temSobreposicao(reserva, guardadas)) {
        throw new ErroSobreposicao();
      }
      const guardada = new Reserva({ ...reserva, id: proximoId++ });
      guardadas.push(guardada);
      return guardada;
    },
  };
}

function pedidosSimultaneos(repositorio, n) {
  return Promise.all(Array.from({ length: n }, () => reservarSala(PEDIDO, repositorio)));
}

describe("reservarSala com pedidos simultâneos (testes controlados, sem base de dados)", () => {
  it("demonstração: só a verificação da app deixa passar pedidos simultâneos", async () => {
    const repositorio = repositorioControlado({ exclusaoAtomica: false });

    const resultados = await pedidosSimultaneos(repositorio, 8);

    // Todos leram a sala vazia antes de qualquer gravação: é a condição de corrida.
    expect(resultados.filter((r) => r.sucesso)).toHaveLength(8);
    expect(repositorio.guardadas).toHaveLength(8);
  });

  it("com exclusão atómica no repositório, só 1 pedido é aceite e os outros recebem a mensagem de sala ocupada", async () => {
    const repositorio = repositorioControlado({ exclusaoAtomica: true });

    const resultados = await pedidosSimultaneos(repositorio, 8);

    expect(resultados.filter((r) => r.sucesso)).toHaveLength(1);
    const recusados = resultados.filter((r) => !r.sucesso);
    expect(recusados).toHaveLength(7);
    for (const r of recusados) expect(r).toEqual({ sucesso: false, erro: ERRO_OCUPADA });
    expect(repositorio.guardadas).toHaveLength(1);
  });

  it("ErroSobreposicao ao guardar dá a mensagem de sala ocupada, sem lançar exceção", async () => {
    const repositorio = repositorioControlado({ exclusaoAtomica: false });
    repositorio.guardarReserva = vi.fn(async () => {
      throw new ErroSobreposicao();
    });

    await expect(reservarSala(PEDIDO, repositorio)).resolves.toEqual({
      sucesso: false,
      erro: ERRO_OCUPADA,
    });
  });

  it("outros erros ao guardar continuam a dar a mensagem genérica", async () => {
    const repositorio = repositorioControlado({ exclusaoAtomica: false });
    repositorio.guardarReserva = vi.fn(async () => {
      throw Object.assign(new Error("ligação perdida"), { code: "08006" });
    });

    await expect(reservarSala(PEDIDO, repositorio)).resolves.toEqual({
      sucesso: false,
      erro: ERRO_REPOSITORIO,
    });
  });
});
