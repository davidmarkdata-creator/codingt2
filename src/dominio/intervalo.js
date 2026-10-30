// Regra: o fim de uma reserva tem de ser depois do início.
// Fim igual ao início (duração zero) ou antes do início é inválido.
// A comparação "não é depois" também apanha datas inválidas (Invalid Date).
export function temIntervaloInvalido(reserva) {
  return !(reserva.fim.getTime() > reserva.inicio.getTime());
}
