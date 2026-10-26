// Regra: uma reserva tem no máximo 2 horas.
// A duração é a diferença real entre inicio e fim (em milissegundos), por isso
// conta bem mesmo quando a reserva atravessa a meia-noite.
const DURACAO_MAXIMA_MS = 2 * 60 * 60 * 1000;

export function excedeDuracaoMaxima(reserva) {
  return reserva.fim.getTime() - reserva.inicio.getTime() > DURACAO_MAXIMA_MS;
}
