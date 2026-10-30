import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Reserva } from "../dominio/reserva";
import { cancelarReserva, podeSerCancelada } from "./cancelarReserva";

const AGORA = new Date("2026-11-05T12:00:00Z");
const ERRO_NAO_ENCONTRADA = "Reserva não encontrada.";
const ERRO_JA_COMECOU = "Só é possível cancelar reservas futuras.";
const ERRO_CANCELAR = "Não foi possível cancelar a reserva.";

function reserva(inicio, fim) {
  return new Reserva({ id: "uuid-r1", salaId: "uuid-a", inicio: new Date(inicio), fim: new Date(fim) });
}

const FUTURA = reserva("2026-11-05T14:00:00Z", "2026-11-05T15:00:00Z");
const PASSADA = reserva("2026-11-04T10:00:00Z", "2026-11-04T11:00:00Z");
const A_DECORRER = reserva("2026-11-05T11:30:00Z", "2026-11-05T12:30:00Z");

// Persistência simulada: só os métodos usados pelo cancelamento.
function repositorio(encontrada, apagou = true) {
  return {
    obterReserva: vi.fn(async () => encontrada),
    apagarReserva: vi.fn(async () => apagou),
  };
}

let registos;
beforeEach(() => {
  registos = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  registos.mockRestore();
});

describe("cancelarReserva", () => {
  it("apaga uma reserva futura, pedindo ao repositório que confirme no momento da eliminação", async () => {
    const repo = repositorio(FUTURA);

    const resultado = await cancelarReserva({ reservaId: "uuid-r1" }, repo, AGORA);

    expect(resultado).toEqual({ sucesso: true });
    expect(repo.obterReserva).toHaveBeenCalledWith("uuid-r1");
    expect(repo.apagarReserva).toHaveBeenCalledWith("uuid-r1", AGORA);
  });

  it("recusa uma reserva passada, sem apagar", async () => {
    const repo = repositorio(PASSADA);

    const resultado = await cancelarReserva({ reservaId: "uuid-r1" }, repo, AGORA);

    expect(resultado).toEqual({ sucesso: false, erro: ERRO_JA_COMECOU });
    expect(repo.apagarReserva).not.toHaveBeenCalled();
  });

  it("recusa uma reserva a decorrer, sem apagar", async () => {
    const repo = repositorio(A_DECORRER);

    const resultado = await cancelarReserva({ reservaId: "uuid-r1" }, repo, AGORA);

    expect(resultado).toEqual({ sucesso: false, erro: ERRO_JA_COMECOU });
    expect(repo.apagarReserva).not.toHaveBeenCalled();
  });

  it("dá 'não encontrada' quando a reserva não existe", async () => {
    const repo = repositorio(null);

    const resultado = await cancelarReserva({ reservaId: "uuid-x" }, repo, AGORA);

    expect(resultado).toEqual({ sucesso: false, erro: ERRO_NAO_ENCONTRADA });
    expect(repo.apagarReserva).not.toHaveBeenCalled();
  });

  it("recusa quando a reserva começou entre a verificação e a eliminação", async () => {
    const repo = repositorio(FUTURA, false);

    const resultado = await cancelarReserva({ reservaId: "uuid-r1" }, repo, AGORA);

    expect(resultado).toEqual({ sucesso: false, erro: ERRO_JA_COMECOU });
  });

  it("dá a mensagem genérica quando o repositório falha, regista a causa e não lança exceção", async () => {
    const repo = repositorio(FUTURA);
    repo.obterReserva.mockRejectedValue(new Error("ligação perdida"));

    await expect(cancelarReserva({ reservaId: "uuid-r1" }, repo, AGORA)).resolves.toEqual({
      sucesso: false,
      erro: ERRO_CANCELAR,
    });
    expect(registos.mock.calls.flat().join(" ")).toContain("ligação perdida");
  });
});

describe("podeSerCancelada", () => {
  it("só as reservas futuras podem ser canceladas", () => {
    expect(podeSerCancelada(FUTURA, AGORA)).toBe(true);
    expect(podeSerCancelada(A_DECORRER, AGORA)).toBe(false);
    expect(podeSerCancelada(PASSADA, AGORA)).toBe(false);
  });
});
