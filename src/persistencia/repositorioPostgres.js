import { Sala } from "../dominio/sala.js";
import { Reserva } from "../dominio/reserva.js";
import { ErroSobreposicao } from "../dominio/erros.js";

// Repositório PostgreSQL: cumpre a mesma interface que o repositório em memória
// (src/aplicacional/repositorio.js) e passa nos mesmos testes de contrato.
// Os valores vão sempre como parâmetros ($1, $2...), nunca colados no SQL.

const SQL_LISTAR_SALAS = "SELECT id, nome, capacidade FROM salas ORDER BY nome";

const SQL_LISTAR_RESERVAS =
  "SELECT id, sala_id, inicio, fim FROM reservas ORDER BY inicio";

const SQL_LISTAR_RESERVAS_DA_SALA =
  "SELECT id, sala_id, inicio, fim FROM reservas WHERE sala_id = $1 ORDER BY inicio";

const SQL_GUARDAR_RESERVA =
  "INSERT INTO reservas (sala_id, inicio, fim) VALUES ($1, $2, $3) RETURNING id, sala_id, inicio, fim";

const SQL_OBTER_RESERVA =
  "SELECT id, sala_id, inicio, fim FROM reservas WHERE id = $1";

// A condição "inicio > $2" faz a verificação no próprio momento da eliminação.
const SQL_APAGAR_RESERVA_FUTURA =
  "DELETE FROM reservas WHERE id = $1 AND inicio > $2 RETURNING id";

// 23P01 = violação de uma restrição EXCLUDE.
const VIOLACAO_EXCLUSAO = "23P01";
const RESTRICAO_SEM_SOBREPOSICAO = "reservas_sem_sobreposicao";

function paraSala(linha) {
  return new Sala({ id: linha.id, nome: linha.nome, capacidade: linha.capacidade });
}

// TIMESTAMPTZ chega do pg como Date (o mesmo instante que foi guardado).
function paraReserva(linha) {
  return new Reserva({
    id: linha.id,
    salaId: linha.sala_id,
    inicio: linha.inicio,
    fim: linha.fim,
  });
}

/**
 * @param {ReturnType<typeof import("./ligacao.js").criarLigacao>} ligacao
 * @returns {import("../aplicacional/repositorio").Repositorio}
 */
export function criarRepositorioPostgres(ligacao) {
  return {
    async listarSalas() {
      const { rows } = await ligacao.consultar(SQL_LISTAR_SALAS);
      return rows.map(paraSala);
    },

    async listarReservas() {
      const { rows } = await ligacao.consultar(SQL_LISTAR_RESERVAS);
      return rows.map(paraReserva);
    },

    async listarReservasDaSala(salaId) {
      const { rows } = await ligacao.consultar(SQL_LISTAR_RESERVAS_DA_SALA, [salaId]);
      return rows.map(paraReserva);
    },

    // O id é gerado pela base de dados (UUID); o da reserva recebida é ignorado.
    async guardarReserva(reserva) {
      try {
        const { rows } = await ligacao.consultar(SQL_GUARDAR_RESERVA, [
          reserva.salaId,
          reserva.inicio,
          reserva.fim,
        ]);
        return paraReserva(rows[0]);
      } catch (erro) {
        // A base de dados recusou por sobreposição (ex.: pedidos simultâneos).
        if (erro?.code === VIOLACAO_EXCLUSAO && erro.constraint === RESTRICAO_SEM_SOBREPOSICAO) {
          throw new ErroSobreposicao();
        }
        throw erro;
      }
    },

    async obterReserva(id) {
      const { rows } = await ligacao.consultar(SQL_OBTER_RESERVA, [id]);
      return rows.length > 0 ? paraReserva(rows[0]) : null;
    },

    async apagarReserva(id, agora) {
      const { rows } = await ligacao.consultar(SQL_APAGAR_RESERVA_FUTURA, [id, agora]);
      return rows.length === 1;
    },
  };
}
