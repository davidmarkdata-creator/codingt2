import { describe, it, expect } from "vitest";
import { Reserva } from "../dominio/reserva";
import { criarRepositorioEmMemoria } from "./repositorioEmMemoria";

const AGORA = new Date("2026-11-05T12:00:00Z");

function reserva(id, inicio) {
  return new Reserva({
    id,
    salaId: 10,
    inicio: new Date(inicio),
    fim: new Date(new Date(inicio).getTime() + 60 * 60 * 1000),
  });
}

describe("repositório em memória: obter e apagar reservas", () => {
  it("obterReserva devolve a reserva pelo id, ou null se não existir", async () => {
    const r = reserva(1, "2026-11-05T14:00:00Z");
    const repositorio = criarRepositorioEmMemoria({ reservas: [r] });

    expect(await repositorio.obterReserva(1)).toEqual(r);
    expect(await repositorio.obterReserva(99)).toBeNull();
  });

  it("apagarReserva apaga uma reserva futura e devolve true", async () => {
    const repositorio = criarRepositorioEmMemoria({ reservas: [reserva(1, "2026-11-05T14:00:00Z")] });

    expect(await repositorio.apagarReserva(1, AGORA)).toBe(true);
    expect(await repositorio.listarReservas()).toEqual([]);
  });

  it("apagarReserva não apaga uma reserva que já começou e devolve false", async () => {
    const r = reserva(1, "2026-11-05T12:00:00Z");
    const repositorio = criarRepositorioEmMemoria({ reservas: [r] });

    expect(await repositorio.apagarReserva(1, AGORA)).toBe(false);
    expect(await repositorio.listarReservas()).toEqual([r]);
  });

  it("apagarReserva devolve false quando a reserva não existe", async () => {
    const repositorio = criarRepositorioEmMemoria();

    expect(await repositorio.apagarReserva(99, AGORA)).toBe(false);
  });
});
