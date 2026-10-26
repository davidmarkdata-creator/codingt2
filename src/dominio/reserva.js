// A marcação de uma sala entre dois instantes.
// inicio e fim são objetos Date (um Date guarda um instante exato, lido em UTC).
export class Reserva {
  constructor({ id, salaId, inicio, fim }) {
    this.id = id;
    this.salaId = salaId;
    this.inicio = inicio;
    this.fim = fim;
  }
}
