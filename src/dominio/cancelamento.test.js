import { describe, it, expect } from "vitest";
import { Reserva } from "./reserva";
import { jaComecou } from "./cancelamento";

const AGORA = new Date("2026-11-05T12:00:00Z");

function reserva(inicio, fim) {
  return new Reserva({ id: 1, salaId: 10, inicio: new Date(inicio), fim: new Date(fim) });
}

describe("jaComecou: só se cancelam reservas futuras", () => {
  it("uma reserva futura ainda não começou (pode ser cancelada)", () => {
    expect(jaComecou(reserva("2026-11-05T12:01:00Z", "2026-11-05T13:00:00Z"), AGORA)).toBe(false);
  });

  it("uma reserva que começa exatamente agora já começou", () => {
    expect(jaComecou(reserva("2026-11-05T12:00:00Z", "2026-11-05T13:00:00Z"), AGORA)).toBe(true);
  });

  it("uma reserva a decorrer já começou", () => {
    expect(jaComecou(reserva("2026-11-05T11:30:00Z", "2026-11-05T12:30:00Z"), AGORA)).toBe(true);
  });

  it("uma reserva passada já começou", () => {
    expect(jaComecou(reserva("2026-11-04T10:00:00Z", "2026-11-04T11:00:00Z"), AGORA)).toBe(true);
  });
});
