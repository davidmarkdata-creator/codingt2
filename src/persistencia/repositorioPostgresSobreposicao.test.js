import { describe, it, expect, vi } from "vitest";
import { Reserva } from "../dominio/reserva";
import { ErroSobreposicao } from "../dominio/erros";
import { criarRepositorioPostgres } from "./repositorioPostgres";

function ligacaoQueFalha(erro) {
  return { consultar: vi.fn(async () => Promise.reject(erro)) };
}

const RESERVA = new Reserva({
  salaId: "uuid-sala-c",
  inicio: new Date("2099-01-01T10:00:00Z"),
  fim: new Date("2099-01-01T11:00:00Z"),
});

describe("repositório PostgreSQL: restrição reservas_sem_sobreposicao", () => {
  it("23P01 desta restrição passa a ErroSobreposicao", async () => {
    const erro = Object.assign(new Error("conflicting key value violates exclusion constraint"), {
      code: "23P01",
      constraint: "reservas_sem_sobreposicao",
    });

    await expect(
      criarRepositorioPostgres(ligacaoQueFalha(erro)).guardarReserva(RESERVA)
    ).rejects.toBeInstanceOf(ErroSobreposicao);
  });

  it("23P01 de outra restrição mantém o erro original", async () => {
    const erro = Object.assign(new Error("outra exclusão"), {
      code: "23P01",
      constraint: "outra_restricao",
    });

    await expect(
      criarRepositorioPostgres(ligacaoQueFalha(erro)).guardarReserva(RESERVA)
    ).rejects.toBe(erro);
  });

  it("outro código de erro mantém o erro original", async () => {
    const erro = Object.assign(new Error("ligação perdida"), { code: "08006" });

    await expect(
      criarRepositorioPostgres(ligacaoQueFalha(erro)).guardarReserva(RESERVA)
    ).rejects.toBe(erro);
  });
});
