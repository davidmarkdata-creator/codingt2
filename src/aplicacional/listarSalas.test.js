import { describe, it, expect, vi } from "vitest";
import { Sala } from "../dominio/sala";
import { listarSalas } from "./listarSalas";

// Persistência simulada: só o método usado por este caso de uso.
function repositorioSimulado(salas) {
  return { listarSalas: vi.fn(async () => salas) };
}

describe("listarSalas", () => {
  it("devolve as salas do repositório", async () => {
    const salas = [
      new Sala({ id: 1, nome: "Sala Atlântico", capacidade: 12 }),
      new Sala({ id: 2, nome: "Sala Douro", capacidade: 6 }),
    ];
    const repositorio = repositorioSimulado(salas);

    const resultado = await listarSalas(repositorio);

    expect(resultado).toEqual(salas);
    expect(repositorio.listarSalas).toHaveBeenCalledTimes(1);
  });

  it("devolve uma lista vazia quando não há salas", async () => {
    const resultado = await listarSalas(repositorioSimulado([]));

    expect(resultado).toEqual([]);
  });
});
