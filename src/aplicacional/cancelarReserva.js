import { jaComecou } from "../dominio/cancelamento";

const ERRO_NAO_ENCONTRADA = "Reserva não encontrada.";
const ERRO_JA_COMECOU = "Só é possível cancelar reservas futuras.";
const ERRO_REPOSITORIO = "Não foi possível cancelar a reserva.";

/**
 * Se uma reserva ainda pode ser cancelada (só as futuras).
 *
 * @param {import("../dominio/reserva").Reserva} reserva
 * @param {Date} [agora]
 */
export function podeSerCancelada(reserva, agora = new Date()) {
  return !jaComecou(reserva, agora);
}

/**
 * Caso de uso "Cancelar reserva": apaga a reserva, só se for futura. Nunca lança
 * exceções: devolve { sucesso: true } ou { sucesso: false, erro }.
 *
 * A regra é verificada aqui e outra vez pelo repositório no momento da
 * eliminação, para o caso de a reserva começar entretanto.
 *
 * @param {{ reservaId: string }} pedido  reservaId: UUID da reserva
 * @param {import("./repositorio").Repositorio} repositorio
 * @param {Date} [agora]
 */
export async function cancelarReserva({ reservaId }, repositorio, agora = new Date()) {
  try {
    const reserva = await repositorio.obterReserva(reservaId);
    if (!reserva) {
      return { sucesso: false, erro: ERRO_NAO_ENCONTRADA };
    }
    if (jaComecou(reserva, agora)) {
      return { sucesso: false, erro: ERRO_JA_COMECOU };
    }

    const apagou = await repositorio.apagarReserva(reservaId, agora);
    if (!apagou) {
      return { sucesso: false, erro: ERRO_JA_COMECOU };
    }
    return { sucesso: true };
  } catch (erro) {
    // Regista a causa no servidor; as mensagens da persistência já vêm sem segredos.
    console.error("Cancelar reserva: falha no repositório:", erro?.message ?? erro);
    return { sucesso: false, erro: ERRO_REPOSITORIO };
  }
}
