import { describe, it, expect } from "vitest";
import { Reserva } from "./reserva";
import { temSobreposicao } from "./sobreposicao";

// Cria uma reserva no dia 2026-11-03 entre duas horas UTC ("HH:MM").
function reserva(id, salaId, inicio, fim) {
  return new Reserva({
    id,
    salaId,
    inicio: new Date(`2026-11-03T${inicio}:00Z`),
    fim: new Date(`2026-11-03T${fim}:00Z`),
  });
}

describe("temSobreposicao: uma sala não pode ter duas reservas sobrepostas", () => {
  const existente = reserva(1, 10, "10:00", "11:00");

  it("não há sobreposição quando a sala não tem reservas", () => {
    const nova = reserva(2, 10, "10:00", "11:00");
    expect(temSobreposicao(nova, [])).toBe(false);
  });

  it("há sobreposição quando o horário é exatamente o mesmo", () => {
    const nova = reserva(2, 10, "10:00", "11:00");
    expect(temSobreposicao(nova, [existente])).toBe(true);
  });

  it("há sobreposição quando a nova começa durante a existente", () => {
    const nova = reserva(2, 10, "10:30", "11:30");
    expect(temSobreposicao(nova, [existente])).toBe(true);
  });

  it("há sobreposição quando a nova acaba durante a existente", () => {
    const nova = reserva(2, 10, "09:30", "10:30");
    expect(temSobreposicao(nova, [existente])).toBe(true);
  });

  it("há sobreposição quando a nova fica dentro da existente", () => {
    const nova = reserva(2, 10, "10:15", "10:45");
    expect(temSobreposicao(nova, [existente])).toBe(true);
  });

  it("há sobreposição quando a nova engloba a existente", () => {
    const nova = reserva(2, 10, "09:00", "12:00");
    expect(temSobreposicao(nova, [existente])).toBe(true);
  });

  describe("caso limite: reservas seguidas", () => {
    it("não há sobreposição quando a nova começa quando a existente acaba", () => {
      const nova = reserva(2, 10, "11:00", "12:00");
      expect(temSobreposicao(nova, [existente])).toBe(false);
    });

    it("não há sobreposição quando a nova acaba quando a existente começa", () => {
      const nova = reserva(2, 10, "09:00", "10:00");
      expect(temSobreposicao(nova, [existente])).toBe(false);
    });
  });

  describe("caso limite: salas diferentes no mesmo horário", () => {
    it("não há sobreposição com reservas de outra sala no mesmo horário", () => {
      const nova = reserva(2, 20, "10:00", "11:00");
      expect(temSobreposicao(nova, [existente])).toBe(false);
    });

    it("só conta a sala da nova reserva quando há reservas de várias salas", () => {
      const outraSala = reserva(3, 20, "10:00", "11:00");
      const nova = reserva(2, 20, "11:00", "12:00");
      expect(temSobreposicao(nova, [existente, outraSala])).toBe(false);
    });
  });

  it("não há sobreposição quando há um intervalo entre as reservas", () => {
    const nova = reserva(2, 10, "12:00", "13:00");
    expect(temSobreposicao(nova, [existente])).toBe(false);
  });

  it("há sobreposição se colidir com pelo menos uma de várias reservas", () => {
    const manha = reserva(3, 10, "08:00", "09:00");
    const tarde = reserva(4, 10, "14:00", "15:00");
    const nova = reserva(2, 10, "14:30", "15:30");
    expect(temSobreposicao(nova, [manha, existente, tarde])).toBe(true);
  });
});
