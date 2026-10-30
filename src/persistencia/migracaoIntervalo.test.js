import { describe, it, expect, vi } from "vitest";

// Módulo de ligação simulado: nenhum teste liga à base de dados.
vi.mock("./ligacao.js", () => ({ criarLigacao: vi.fn() }));

import { SQL_MIGRACAO, executarMigracao } from "./migracao";

const sql = SQL_MIGRACAO.replace(/--[^\n]*/g, "").replace(/\s+/g, " ");
const ERRO_RESERVAS_INVALIDAS =
  "Existem reservas com fim antes do início: apague-as antes de correr a migração.";

function ligacaoQueFalha(erro) {
  return { consultar: vi.fn(async () => Promise.reject(erro)) };
}

describe("migração: restrição reservas_fim_depois_do_inicio", () => {
  it("cria a restrição CHECK (fim > inicio) só se ainda não existir", () => {
    expect(sql).toMatch(
      /IF NOT EXISTS \(SELECT 1 FROM pg_constraint WHERE conname = 'reservas_fim_depois_do_inicio'\) THEN ALTER TABLE reservas ADD CONSTRAINT reservas_fim_depois_do_inicio CHECK \(fim > inicio\);/
    );
  });

  it("cria a restrição dentro da transação, antes do COMMIT", () => {
    const posicao = sql.indexOf("reservas_fim_depois_do_inicio CHECK");
    expect(posicao).toBeGreaterThan(sql.indexOf("BEGIN;"));
    expect(posicao).toBeLessThan(sql.lastIndexOf("COMMIT;"));
  });

  it("traduz o 23514 desta restrição para uma mensagem clara", async () => {
    const erro = Object.assign(
      new Error(
        'check constraint "reservas_fim_depois_do_inicio" of relation "reservas" is violated by some row'
      ),
      { code: "23514" }
    );

    await expect(executarMigracao(ligacaoQueFalha(erro))).rejects.toThrow(
      ERRO_RESERVAS_INVALIDAS
    );
  });

  it("mantém o erro original num 23514 de outra restrição", async () => {
    const erro = Object.assign(
      new Error('check constraint "outra_restricao" of relation "salas" is violated by some row'),
      { code: "23514" }
    );

    await expect(executarMigracao(ligacaoQueFalha(erro))).rejects.toBe(erro);
  });
});
