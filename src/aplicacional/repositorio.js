// Interface do repositório de que os casos de uso precisam.
// Os casos de uso recebem-no de fora; quem o cria é a camada de persistência.
// Todos os métodos são assíncronos (devolvem uma Promise).

/**
 * @typedef {import("../dominio/sala").Sala} Sala
 * @typedef {import("../dominio/reserva").Reserva} Reserva
 */

/**
 * @typedef {object} Repositorio
 * @property {() => Promise<Sala[]>} listarSalas Todas as salas.
 * @property {() => Promise<Reserva[]>} listarReservas Todas as reservas.
 * @property {(salaId: string) => Promise<Reserva[]>} listarReservasDaSala As reservas de uma sala (salaId: UUID).
 * @property {(reserva: Reserva) => Promise<Reserva>} guardarReserva Guarda uma reserva nova e devolve-a já com id.
 */

export {};
