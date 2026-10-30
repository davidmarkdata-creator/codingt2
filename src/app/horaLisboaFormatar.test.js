import { describe, it, expect } from "vitest";
import { formatarEmLisboa } from "./horaLisboa";

function emLisboa(iso) {
  return formatarEmLisboa(new Date(iso));
}

describe("formatarEmLisboa", () => {
  it("no inverno, Lisboa está em UTC+0", () => {
    expect(emLisboa("2026-11-03T10:00:00Z")).toEqual({ data: "03/11/2026", hora: "10:00" });
    expect(emLisboa("2026-12-31T23:59:00Z")).toEqual({ data: "31/12/2026", hora: "23:59" });
  });

  it("no verão, Lisboa está em UTC+1", () => {
    expect(emLisboa("2026-07-10T09:00:00Z")).toEqual({ data: "10/07/2026", hora: "10:00" });
  });

  it("no verão, 23:30 UTC já é o dia seguinte em Lisboa", () => {
    expect(emLisboa("2026-07-09T23:30:00Z")).toEqual({ data: "10/07/2026", hora: "00:30" });
  });

  it("na mudança de março (29/03/2026), salta das 00:59 para as 02:00", () => {
    expect(emLisboa("2026-03-29T00:59:00Z")).toEqual({ data: "29/03/2026", hora: "00:59" });
    expect(emLisboa("2026-03-29T01:00:00Z")).toEqual({ data: "29/03/2026", hora: "02:00" });
  });

  it("na mudança de outubro (25/10/2026), as 01:30 acontecem duas vezes", () => {
    expect(emLisboa("2026-10-25T00:30:00Z")).toEqual({ data: "25/10/2026", hora: "01:30" });
    expect(emLisboa("2026-10-25T01:30:00Z")).toEqual({ data: "25/10/2026", hora: "01:30" });
  });
});
