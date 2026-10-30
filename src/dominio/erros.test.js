import { describe, it, expect } from "vitest";
import { ErroSobreposicao } from "./erros";

describe("ErroSobreposicao", () => {
  it("é um Error identificável pelo tipo", () => {
    const erro = new ErroSobreposicao();

    expect(erro).toBeInstanceOf(Error);
    expect(erro).toBeInstanceOf(ErroSobreposicao);
    expect(erro.name).toBe("ErroSobreposicao");
    expect(erro.message).toBe("A sala já tem uma reserva nesse horário.");
  });
});
