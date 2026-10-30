import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { criarLigacao } from "./ligacao";
import { criarRepositorioPostgres } from "./repositorioPostgres";
import { reservarSala } from "../aplicacional/reservarSala";

// Teste de concorrência REAL no PostgreSQL (DATABASE_URL do .env.local).
// Só corre com `npm run test:postgres`; o `npm run test` normal salta-o.
//
// Segurança dos dados:
// - só corre se a restrição reservas_sem_sobreposicao já existir (migração aplicada);
// - usa uma janela isolada (Sala C, 01/01/2099) e só começa se estiver vazia;
// - no fim apaga EXCLUSIVAMENTE os ids que o próprio teste criou (mesmo que falhe);
// - se aparecerem na janela registos que o teste não criou, não os apaga e falha.
const MODO_POSTGRES = import.meta.env.MODE === "postgres";

const ERRO_OCUPADA = "A sala já tem uma reserva nesse horário.";
const JANELA_INICIO = new Date("2099-01-01T00:00:00Z");
const JANELA_FIM = new Date("2099-01-02T00:00:00Z");
const PEDIDOS_SIMULTANEOS = 8; // abaixo do máximo de 10 ligações do pool

function horario(inicio, fim) {
  return { inicio: new Date(`2099-01-01T${inicio}:00Z`), fim: new Date(`2099-01-01T${fim}:00Z`) };
}

describe.runIf(MODO_POSTGRES)("concorrência real no PostgreSQL (Aiven)", () => {
  let ligacao;
  let repositorio;
  let salaC;
  const criadas = [];

  async function idsNaJanela() {
    const { rows } = await ligacao.consultar(
      "SELECT id FROM reservas WHERE sala_id = $1 AND inicio >= $2 AND inicio < $3",
      [salaC.id, JANELA_INICIO, JANELA_FIM]
    );
    return rows.map((r) => r.id);
  }

  function registarCriadas(resultados) {
    for (const r of resultados) if (r.sucesso) criadas.push(r.reserva.id);
  }

  beforeAll(async () => {
    ligacao = criarLigacao();
    repositorio = criarRepositorioPostgres(ligacao);

    const { rows } = await ligacao.consultar(
      "SELECT count(*)::int AS n FROM pg_constraint WHERE conname = $1",
      ["reservas_sem_sobreposicao"]
    );
    if (rows[0].n !== 1) {
      throw new Error("A restrição reservas_sem_sobreposicao não existe: corra `npm run migrar` primeiro.");
    }

    salaC = (await repositorio.listarSalas()).find((sala) => sala.nome === "Sala C");
    if (!salaC) throw new Error("A Sala C não existe: corra `npm run migrar` primeiro.");

    if ((await idsNaJanela()).length > 0) {
      throw new Error("Já existem reservas da Sala C em 01/01/2099: o teste não continua.");
    }
  });

  afterEach(async () => {
    const encontrados = await idsNaJanela();
    const alheios = encontrados.filter((id) => !criadas.includes(id));
    if (criadas.length > 0) {
      await ligacao.consultar("DELETE FROM reservas WHERE id = ANY($1::uuid[])", [criadas]);
      criadas.length = 0;
    }
    if (alheios.length > 0) {
      throw new Error(`Há ${alheios.length} reserva(s) na janela de teste que este teste não criou: não foram apagadas.`);
    }
  });

  afterAll(async () => {
    await ligacao?.fechar();
  });

  it(`${PEDIDOS_SIMULTANEOS} pedidos simultâneos para o mesmo horário: só 1 é aceite`, async () => {
    const pedido = { salaId: salaC.id, ...horario("10:00", "11:00") };

    const resultados = await Promise.all(
      Array.from({ length: PEDIDOS_SIMULTANEOS }, () => reservarSala(pedido, repositorio))
    );
    registarCriadas(resultados);

    expect(resultados.filter((r) => r.sucesso)).toHaveLength(1);
    for (const r of resultados.filter((r) => !r.sucesso)) {
      expect(r).toEqual({ sucesso: false, erro: ERRO_OCUPADA });
    }
    expect(await idsNaJanela()).toHaveLength(1);
  });

  it("2 pedidos simultâneos com horários seguidos: os dois são aceites", async () => {
    const resultados = await Promise.all([
      reservarSala({ salaId: salaC.id, ...horario("10:00", "11:00") }, repositorio),
      reservarSala({ salaId: salaC.id, ...horario("11:00", "12:00") }, repositorio),
    ]);
    registarCriadas(resultados);

    expect(resultados.every((r) => r.sucesso)).toBe(true);
    expect(await idsNaJanela()).toHaveLength(2);
  });
});
