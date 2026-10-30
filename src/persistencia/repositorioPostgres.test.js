import { describe, it, expect, vi } from "vitest";
import { Sala } from "../dominio/sala";
import { Reserva } from "../dominio/reserva";
import { criarRepositorioPostgres } from "./repositorioPostgres";

// Ligação falsa: regista o SQL e os parâmetros; responde com as linhas dadas.
function ligacaoFalsa(linhas = []) {
  return { consultar: vi.fn(async () => ({ rows: linhas })) };
}

const MALICIOSO = "x'; DROP TABLE reservas; --";

// O texto do SQL nunca pode conter os valores: só marcadores $1, $2...
function semValoresNoSql(ligacao) {
  for (const [sql, parametros = []] of ligacao.consultar.mock.calls) {
    for (const valor of parametros) {
      const texto = valor instanceof Date ? valor.toISOString() : String(valor);
      expect(sql).not.toContain(texto);
    }
    expect(sql).not.toContain(MALICIOSO);
  }
}

describe("criarRepositorioPostgres", () => {
  it("listarSalas converte as linhas em Sala", async () => {
    const ligacao = ligacaoFalsa([{ id: "uuid-a", nome: "Sala A", capacidade: 12 }]);

    const salas = await criarRepositorioPostgres(ligacao).listarSalas();

    expect(salas).toEqual([new Sala({ id: "uuid-a", nome: "Sala A", capacidade: 12 })]);
    expect(salas[0]).toBeInstanceOf(Sala);
    expect(ligacao.consultar.mock.calls[0][0]).toMatch(/SELECT id, nome, capacidade FROM salas/);
  });

  it("listarReservas converte sala_id em salaId e mantém as datas", async () => {
    const inicio = new Date("2026-11-03T10:00:00.123Z");
    const fim = new Date("2026-11-03T11:00:00.456Z");
    const ligacao = ligacaoFalsa([{ id: "uuid-r", sala_id: "uuid-a", inicio, fim }]);

    const reservas = await criarRepositorioPostgres(ligacao).listarReservas();

    expect(reservas).toEqual([new Reserva({ id: "uuid-r", salaId: "uuid-a", inicio, fim })]);
    expect(reservas[0]).toBeInstanceOf(Reserva);
  });

  it("listarReservasDaSala usa um parâmetro, nunca o valor colado no SQL", async () => {
    const ligacao = ligacaoFalsa();

    await criarRepositorioPostgres(ligacao).listarReservasDaSala(MALICIOSO);

    const [sql, parametros] = ligacao.consultar.mock.calls[0];
    expect(sql).toMatch(/WHERE sala_id = \$1/);
    expect(parametros).toEqual([MALICIOSO]);
    semValoresNoSql(ligacao);
  });

  it("guardarReserva usa parâmetros, não envia o id e devolve o id gerado pela base de dados", async () => {
    const inicio = new Date("2026-11-03T10:00:00.123Z");
    const fim = new Date("2026-11-03T11:00:00.456Z");
    const ligacao = ligacaoFalsa([{ id: "uuid-novo", sala_id: MALICIOSO, inicio, fim }]);

    const guardada = await criarRepositorioPostgres(ligacao).guardarReserva(
      new Reserva({ id: 999, salaId: MALICIOSO, inicio, fim })
    );

    const [sql, parametros] = ligacao.consultar.mock.calls[0];
    expect(sql).toMatch(/INSERT INTO reservas \(sala_id, inicio, fim\) VALUES \(\$1, \$2, \$3\)/);
    expect(sql).toMatch(/RETURNING id, sala_id, inicio, fim/);
    expect(parametros).toEqual([MALICIOSO, inicio, fim]);
    expect(parametros).not.toContain(999);
    semValoresNoSql(ligacao);

    expect(guardada).toBeInstanceOf(Reserva);
    expect(guardada).toEqual(new Reserva({ id: "uuid-novo", salaId: MALICIOSO, inicio, fim }));
  });
});
