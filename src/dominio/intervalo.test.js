import { describe, it, expect } from "vitest";
import { Reserva } from "./reserva";
import { temIntervaloInvalido } from "./intervalo";

function reserva(inicio, fim) {
  return new Reserva({ id: 1, salaId: 10, inicio: new Date(inicio), fim: new Date(fim) });
}

describe("temIntervaloInvalido: o fim tem de ser depois do início", () => {
  it("é inválido quando o fim é antes do início (11:00 → 00:00 do mesmo dia)", () => {
    expect(temIntervaloInvalido(reserva("2026-12-15T11:00:00Z", "2026-12-15T00:00:00Z"))).toBe(true);
  });

  it("é inválido quando o fim é igual ao início (duração zero)", () => {
    expect(temIntervaloInvalido(reserva("2026-12-15T11:00:00Z", "2026-12-15T11:00:00Z"))).toBe(true);
  });

  it("é válido com 1 minuto", () => {
    expect(temIntervaloInvalido(reserva("2026-12-15T11:00:00Z", "2026-12-15T11:01:00Z"))).toBe(false);
  });

  it("é válido numa reserva normal (10:00 → 11:00)", () => {
    expect(temIntervaloInvalido(reserva("2026-12-15T10:00:00Z", "2026-12-15T11:00:00Z"))).toBe(false);
  });

  it("é válido quando atravessa a meia-noite (23:00 → 01:00 do dia seguinte)", () => {
    expect(temIntervaloInvalido(reserva("2026-12-15T23:00:00Z", "2026-12-16T01:00:00Z"))).toBe(false);
  });
});
