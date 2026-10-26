import { describe, it, expect } from "vitest";
import { Sala } from "./sala";

describe("Sala", () => {
  it("guarda id, nome e capacidade", () => {
    const sala = new Sala({ id: 1, nome: "Sala Atlântico", capacidade: 12 });

    expect(sala).toBeInstanceOf(Sala);
    expect(sala.id).toBe(1);
    expect(sala.nome).toBe("Sala Atlântico");
    expect(sala.capacidade).toBe(12);
  });
});
