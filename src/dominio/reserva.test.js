import { describe, it, expect } from "vitest";
import { Reserva } from "./reserva";

describe("Reserva", () => {
  it("guarda id, salaId, inicio e fim", () => {
    const inicio = new Date("2026-11-03T10:00:00Z");
    const fim = new Date("2026-11-03T11:00:00Z");

    const reserva = new Reserva({ id: 1, salaId: 2, inicio, fim });

    expect(reserva).toBeInstanceOf(Reserva);
    expect(reserva.id).toBe(1);
    expect(reserva.salaId).toBe(2);
  });

  it("guarda inicio e fim como objetos Date em UTC", () => {
    const reserva = new Reserva({
      id: 1,
      salaId: 2,
      inicio: new Date("2026-11-03T10:00:00Z"),
      fim: new Date("2026-11-03T11:00:00Z"),
    });

    expect(reserva.inicio).toBeInstanceOf(Date);
    expect(reserva.fim).toBeInstanceOf(Date);
    expect(reserva.inicio.toISOString()).toBe("2026-11-03T10:00:00.000Z");
    expect(reserva.fim.toISOString()).toBe("2026-11-03T11:00:00.000Z");
    expect(reserva.inicio.getUTCHours()).toBe(10);
    expect(reserva.fim.getUTCHours()).toBe(11);
  });
});
