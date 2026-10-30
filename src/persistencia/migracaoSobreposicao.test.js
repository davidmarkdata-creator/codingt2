import { describe, it, expect, vi } from "vitest";

// Módulo de ligação simulado: nenhum teste liga à base de dados.
vi.mock("./ligacao.js", () => ({ criarLigacao: vi.fn() }));

import { SQL_MIGRACAO, executarMigracao } from "./migracao";

const sql = SQL_MIGRACAO.replace(/--[^\n]*/g, "").replace(/\s+/g, " ");
const ERRO_RESERVAS_SOBREPOSTAS =
  "Existem reservas sobrepostas na mesma sala: resolva-as antes de correr a migração.";

function ligacaoQueFalha(erro) {
  return { consultar: vi.fn(async () => Promise.reject(erro)) };
}

describe("migração: restrição reservas_sem_sobreposicao", () => {
  it("cria a extensão btree_gist só se ainda não existir", () => {
    expect(sql).toContain("CREATE EXTENSION IF NOT EXISTS btree_gist;");
  });

  it("cria a restrição EXCLUDE por sala e intervalo [início, fim), só se ainda não existir", () => {
    expect(sql).toMatch(
      /IF NOT EXISTS \(SELECT 1 FROM pg_constraint WHERE conname = 'reservas_sem_sobreposicao'\) THEN ALTER TABLE reservas ADD CONSTRAINT reservas_sem_sobreposicao EXCLUDE USING gist \(sala_id WITH =, tstzrange\(inicio, fim, '\[\)'\) WITH &&\);/
    );
  });

  it("vem depois do CHECK fim > início e antes do COMMIT", () => {
    const extensao = sql.indexOf("CREATE EXTENSION IF NOT EXISTS btree_gist");
    const exclusao = sql.indexOf("reservas_sem_sobreposicao EXCLUDE");
    expect(extensao).toBeGreaterThan(sql.indexOf("reservas_fim_depois_do_inicio CHECK"));
    expect(exclusao).toBeGreaterThan(extensao);
    expect(exclusao).toBeLessThan(sql.lastIndexOf("COMMIT;"));
  });

  it("traduz o 23P01 desta restrição para uma mensagem clara", async () => {
    const erro = Object.assign(
      new Error('could not create exclusion constraint "reservas_sem_sobreposicao"'),
      { code: "23P01", constraint: "reservas_sem_sobreposicao" }
    );

    await expect(executarMigracao(ligacaoQueFalha(erro))).rejects.toThrow(
      ERRO_RESERVAS_SOBREPOSTAS
    );
  });

  it("mantém o erro original num 23P01 de outra restrição", async () => {
    const erro = Object.assign(new Error('could not create exclusion constraint "outra"'), {
      code: "23P01",
      constraint: "outra",
    });

    await expect(executarMigracao(ligacaoQueFalha(erro))).rejects.toBe(erro);
  });
});
