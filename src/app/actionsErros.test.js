import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// A ligação falha ao ser criada (ex.: DATABASE_URL em falta na Vercel).
vi.mock("../persistencia/ligacao", () => ({
  criarLigacao: () => {
    throw new Error("DATABASE_URL não está definido: não é possível ligar à base de dados.");
  },
}));
vi.mock("../persistencia/repositorioPostgres", () => ({
  criarRepositorioPostgres: vi.fn(),
}));

import { reservarSalaAction, obterSalas, obterReservas } from "./actions";

function formularioValido() {
  const dados = new FormData();
  dados.set("salaId", "uuid-sala-a");
  dados.set("data", "2026-12-15");
  dados.set("inicio", "10:00");
  dados.set("fim", "11:00");
  return dados;
}

let registos;

beforeEach(() => {
  registos = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  registos.mockRestore();
});

describe("actions: falha ao criar a ligação", () => {
  it("reservarSalaAction devolve a mensagem de erro em vez de lançar exceção, e regista a causa", async () => {
    await expect(reservarSalaAction(null, formularioValido())).resolves.toEqual({
      sucesso: false,
      erro: "Não foi possível guardar a reserva.",
    });
    expect(registos.mock.calls.flat().join(" ")).toContain("DATABASE_URL não está definido");
  });

  it("obterSalas regista a causa no servidor", async () => {
    await expect(obterSalas()).resolves.toEqual({
      sucesso: false,
      erro: "Não foi possível carregar as salas.",
    });
    expect(registos.mock.calls.flat().join(" ")).toContain("DATABASE_URL não está definido");
  });

  it("obterReservas regista a causa no servidor", async () => {
    await expect(obterReservas()).resolves.toEqual({
      sucesso: false,
      erro: "Não foi possível carregar as reservas.",
    });
    expect(registos.mock.calls.flat().join(" ")).toContain("DATABASE_URL não está definido");
  });
});
