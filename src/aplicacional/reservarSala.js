import { Reserva } from "../dominio/reserva";
import { temSobreposicao } from "../dominio/sobreposicao";
import { excedeDuracaoMaxima } from "../dominio/duracao";
import { temIntervaloInvalido } from "../dominio/intervalo";
import { ErroSobreposicao } from "../dominio/erros";

const ERRO_SALA_INEXISTENTE = "Sala não encontrada.";
const ERRO_INTERVALO = "A hora de fim tem de ser depois da hora de início.";
const ERRO_DURACAO = "A reserva não pode durar mais de 2 horas.";
const ERRO_OCUPADA = "A sala já tem uma reserva nesse horário.";
const ERRO_REPOSITORIO = "Não foi possível guardar a reserva.";

/**
 * Caso de uso "Reservar sala". Nunca lança exceções: devolve sempre
 * { sucesso: true, reserva } ou { sucesso: false, erro }.
 *
 * @param {{ salaId: number, inicio: Date, fim: Date }} pedido
 * @param {import("./repositorio").Repositorio} repositorio
 */
export async function reservarSala({ salaId, inicio, fim }, repositorio) {
  try {
    const salas = await repositorio.listarSalas();
    if (!salas.some((sala) => sala.id === salaId)) {
      return { sucesso: false, erro: ERRO_SALA_INEXISTENTE };
    }

    const nova = new Reserva({ salaId, inicio, fim });
    // Antes da duração e da sobreposição: um intervalo invertido escapa às duas.
    if (temIntervaloInvalido(nova)) {
      return { sucesso: false, erro: ERRO_INTERVALO };
    }
    if (excedeDuracaoMaxima(nova)) {
      return { sucesso: false, erro: ERRO_DURACAO };
    }

    const reservasDaSala = await repositorio.listarReservasDaSala(salaId);
    if (temSobreposicao(nova, reservasDaSala)) {
      return { sucesso: false, erro: ERRO_OCUPADA };
    }

    const reserva = await repositorio.guardarReserva(nova);
    return { sucesso: true, reserva };
  } catch (erro) {
    // Pedido simultâneo que a base de dados recusou: a sala ficou ocupada.
    if (erro instanceof ErroSobreposicao) {
      return { sucesso: false, erro: ERRO_OCUPADA };
    }
    return { sucesso: false, erro: ERRO_REPOSITORIO };
  }
}
