import { describe, it, expect } from "vitest";
import { lisboaParaUtc } from "./horaLisboa";

const ERRO_MUDANCA_HORA = "Hora inválida em Lisboa (mudança de hora).";
const ERRO_FORMATO = "Data ou hora inválida.";

function utc(data, hora) {
  return lisboaParaUtc(data, hora).toISOString();
}

describe("lisboaParaUtc", () => {
  it("devolve um objeto Date", () => {
    expect(lisboaParaUtc("2026-11-03", "10:00")).toBeInstanceOf(Date);
  });

  it("no inverno, Lisboa está em UTC+0", () => {
    expect(utc("2026-11-03", "10:00")).toBe("2026-11-03T10:00:00.000Z");
    expect(utc("2026-01-15", "23:45")).toBe("2026-01-15T23:45:00.000Z");
  });

  it("no verão, Lisboa está em UTC+1", () => {
    expect(utc("2026-07-10", "10:00")).toBe("2026-07-10T09:00:00.000Z");
  });

  it("no verão, a meia-noite em Lisboa ainda é o dia anterior em UTC", () => {
    expect(utc("2026-07-10", "00:30")).toBe("2026-07-09T23:30:00.000Z");
  });

  describe("mudança de hora de março (29/03/2026: 01:00 passa a 02:00)", () => {
    it("antes da mudança ainda é UTC+0", () => {
      expect(utc("2026-03-29", "00:30")).toBe("2026-03-29T00:30:00.000Z");
    });

    it("as horas entre 01:00 e 02:00 não existem e dão erro", () => {
      expect(() => lisboaParaUtc("2026-03-29", "01:00")).toThrow(ERRO_MUDANCA_HORA);
      expect(() => lisboaParaUtc("2026-03-29", "01:30")).toThrow(ERRO_MUDANCA_HORA);
      expect(() => lisboaParaUtc("2026-03-29", "01:59")).toThrow(ERRO_MUDANCA_HORA);
    });

    it("a partir das 02:00 já é UTC+1", () => {
      expect(utc("2026-03-29", "02:00")).toBe("2026-03-29T01:00:00.000Z");
      expect(utc("2026-03-29", "10:00")).toBe("2026-03-29T09:00:00.000Z");
    });
  });

  describe("mudança de hora de outubro (25/10/2026: 02:00 volta a 01:00)", () => {
    it("antes da mudança ainda é UTC+1", () => {
      expect(utc("2026-10-25", "00:30")).toBe("2026-10-24T23:30:00.000Z");
    });

    it("as horas entre 01:00 e 02:00 acontecem duas vezes: usa a primeira (UTC+1)", () => {
      expect(utc("2026-10-25", "01:00")).toBe("2026-10-25T00:00:00.000Z");
      expect(utc("2026-10-25", "01:30")).toBe("2026-10-25T00:30:00.000Z");
      expect(utc("2026-10-25", "01:59")).toBe("2026-10-25T00:59:00.000Z");
    });

    it("a partir das 02:00 já é UTC+0", () => {
      expect(utc("2026-10-25", "02:00")).toBe("2026-10-25T02:00:00.000Z");
      expect(utc("2026-10-25", "10:00")).toBe("2026-10-25T10:00:00.000Z");
    });
  });

  describe("dados mal formados", () => {
    it("dá erro com data ou hora vazias", () => {
      expect(() => lisboaParaUtc("", "10:00")).toThrow(ERRO_FORMATO);
      expect(() => lisboaParaUtc("2026-11-03", "")).toThrow(ERRO_FORMATO);
      expect(() => lisboaParaUtc(null, null)).toThrow(ERRO_FORMATO);
    });

    it("dá erro com formatos errados", () => {
      expect(() => lisboaParaUtc("03/11/2026", "10:00")).toThrow(ERRO_FORMATO);
      expect(() => lisboaParaUtc("2026-11-03", "10h00")).toThrow(ERRO_FORMATO);
    });

    it("dá erro com datas ou horas que não existem no calendário", () => {
      expect(() => lisboaParaUtc("2026-02-30", "10:00")).toThrow(ERRO_FORMATO);
      expect(() => lisboaParaUtc("2026-13-01", "10:00")).toThrow(ERRO_FORMATO);
      expect(() => lisboaParaUtc("2026-11-03", "24:00")).toThrow(ERRO_FORMATO);
      expect(() => lisboaParaUtc("2026-11-03", "10:60")).toThrow(ERRO_FORMATO);
    });
  });
});
