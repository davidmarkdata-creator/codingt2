// Regra: só se podem cancelar reservas futuras.
// Uma reserva que começa exatamente agora, está a decorrer ou já passou, já começou.
export function jaComecou(reserva, agora) {
  return reserva.inicio.getTime() <= agora.getTime();
}
