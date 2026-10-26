// Regra: uma sala não pode ter duas reservas sobrepostas.
// Duas reservas da mesma sala colidem quando cada uma começa antes de a outra
// acabar. Reservas seguidas (uma acaba quando a outra começa) não colidem.
export function temSobreposicao(novaReserva, reservasExistentes) {
  return reservasExistentes.some(
    (existente) =>
      existente.salaId === novaReserva.salaId &&
      novaReserva.inicio < existente.fim &&
      existente.inicio < novaReserva.fim
  );
}
