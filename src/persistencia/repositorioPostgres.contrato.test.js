import { describe, beforeAll, afterAll } from "vitest";
import { criarLigacao } from "./ligacao";
import { criarRepositorioPostgres } from "./repositorioPostgres";
import { descreverContratoRepositorio } from "./contratoRepositorio";

// Liga ao PostgreSQL real (DATABASE_URL do .env.local). Só corre com
// `npm run test:postgres` (vitest --mode postgres); o `npm run test` normal
// salta este ficheiro e nunca liga à base de dados.
const MODO_POSTGRES = import.meta.env.MODE === "postgres";

describe.runIf(MODO_POSTGRES)("PostgreSQL (Aiven)", () => {
  let ligacao;
  let repositorio;
  let salas;

  beforeAll(async () => {
    ligacao = criarLigacao();
    repositorio = criarRepositorioPostgres(ligacao);
    salas = (await repositorio.listarSalas()).slice(0, 2);
    if (salas.length < 2) {
      throw new Error(
        "O contrato precisa de pelo menos duas salas na base de dados: corra `npm run migrar`."
      );
    }
  });

  afterAll(async () => {
    await ligacao?.fechar();
  });

  descreverContratoRepositorio("PostgreSQL", () => ({
    repositorio,
    salas,
    // Apaga só as reservas criadas pelo teste (corre mesmo quando o teste falha).
    limpar: async (ids) => {
      if (ids.length === 0) return;
      await ligacao.consultar("DELETE FROM reservas WHERE id = ANY($1::uuid[])", [ids]);
    },
  }));
});
