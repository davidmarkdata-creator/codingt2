import { describe, it, expect } from "vitest";
import { Reserva } from "./reserva";
import { excedeDuracaoMaxima } from "./duracao";

// Cria uma reserva entre dois instantes UTC ("AAAA-MM-DDTHH:MM").
function reserva(inicio, fim) {
  return new Reserva({
    id: 1,
    salaId: 10,
    inicio: new Date(`${inicio}:00Z`),
    fim: new Date(`${fim}:00Z`),
  });
}

describe("excedeDuracaoMaxima: uma reserva tem no máximo 2 horas", () => {
  it("permite uma reserva de 30 minutos", () => {
    expect(excedeDuracaoMaxima(reserva("2026-11-03T10:00", "2026-11-03T10:30"))).toBe(false);
  });

  describe("caso limite: exatamente 2 horas", () => {
    it("permite uma reserva de exatamente 2 horas", () => {
      expect(excedeDuracaoMaxima(reserva("2026-11-03T10:00", "2026-11-03T12:00"))).toBe(false);
    });
  });

  describe("caso limite: 2 horas e 1 minuto", () => {
    it("recusa uma reserva de 2 horas e 1 minuto", () => {
      expect(excedeDuracaoMaxima(reserva("2026-11-03T10:00", "2026-11-03T12:01"))).toBe(true);
    });
  });

  it("recusa uma reserva bem acima do máximo (3 horas)", () => {
    expect(excedeDuracaoMaxima(reserva("2026-11-03T10:00", "2026-11-03T13:00"))).toBe(true);
  });

  it("conta o tempo real quando a reserva atravessa a meia-noite", () => {
    expect(excedeDuracaoMaxima(reserva("2026-11-03T23:00", "2026-11-04T01:00"))).toBe(false);
    expect(excedeDuracaoMaxima(reserva("2026-11-03T23:00", "2026-11-04T01:01"))).toBe(true);
  });
});
