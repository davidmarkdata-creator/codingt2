import { describe, it, expect, vi } from "vitest";
import { Reserva } from "../dominio/reserva";
import { criarRepositorioPostgres } from "./repositorioPostgres";

const AGORA = new Date("2026-11-05T12:00:00Z");
const MALICIOSO = "x'; DROP TABLE reservas; --";

function ligacaoFalsa(linhas = []) {
  return { consultar: vi.fn(async () => ({ rows: linhas })) };
}

describe("repositório PostgreSQL: obter e apagar reservas", () => {
  it("obterReserva usa um parâmetro e converte a linha em Reserva", async () => {
    const inicio = new Date("2026-11-05T14:00:00Z");
    const fim = new Date("2026-11-05T15:00:00Z");
    const ligacao = ligacaoFalsa([{ id: "uuid-r1", sala_id: "uuid-a", inicio, fim }]);

    const r = await criarRepositorioPostgres(ligacao).obterReserva("uuid-r1");

    const [sql, parametros] = ligacao.consultar.mock.calls[0];
    expect(sql).toMatch(/SELECT id, sala_id, inicio, fim FROM reservas WHERE id = \$1/);
    expect(parametros).toEqual(["uuid-r1"]);
    expect(r).toEqual(new Reserva({ id: "uuid-r1", salaId: "uuid-a", inicio, fim }));
  });

  it("obterReserva devolve null quando não encontra", async () => {
    expect(await criarRepositorioPostgres(ligacaoFalsa([])).obterReserva("uuid-x")).toBeNull();
  });

  it("apagarReserva só apaga se o início ainda for depois de agora (no próprio DELETE)", async () => {
    const ligacao = ligacaoFalsa([{ id: "uuid-r1" }]);

    const apagou = await criarRepositorioPostgres(ligacao).apagarReserva("uuid-r1", AGORA);

    const [sql, parametros] = ligacao.consultar.mock.calls[0];
    expect(sql).toMatch(/DELETE FROM reservas WHERE id = \$1 AND inicio > \$2 RETURNING id/);
    expect(parametros).toEqual(["uuid-r1", AGORA]);
    expect(apagou).toBe(true);
  });

  it("apagarReserva devolve false quando nada foi apagado", async () => {
    expect(await criarRepositorioPostgres(ligacaoFalsa([])).apagarReserva("uuid-r1", AGORA)).toBe(false);
  });

  it("o id vai só nos parâmetros, nunca colado no SQL", async () => {
    const ligacao = ligacaoFalsa([]);
    const repositorio = criarRepositorioPostgres(ligacao);

    await repositorio.obterReserva(MALICIOSO);
    await repositorio.apagarReserva(MALICIOSO, AGORA);

    for (const [sql, parametros] of ligacao.consultar.mock.calls) {
      expect(sql).not.toContain(MALICIOSO);
      expect(parametros[0]).toBe(MALICIOSO);
    }
  });
});
