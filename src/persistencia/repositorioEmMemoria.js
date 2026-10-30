import { Reserva } from "../dominio/reserva";

/**
 * Repositório que guarda os dados em memória (perdem-se ao reiniciar).
 * Cumpre a interface Repositorio de src/aplicacional/repositorio.js.
 *
 * @param {{ salas?: import("../dominio/sala").Sala[], reservas?: Reserva[] }} [dados]
 * @returns {import("../aplicacional/repositorio").Repositorio}
 */
export function criarRepositorioEmMemoria({ salas = [], reservas = [] } = {}) {
  const salasGuardadas = [...salas];
  const reservasGuardadas = [...reservas];
  let proximoId =
    reservasGuardadas.reduce((maior, r) => Math.max(maior, r.id ?? 0), 0) + 1;

  return {
    async listarSalas() {
      return [...salasGuardadas];
    },

    async listarReservas() {
      return [...reservasGuardadas];
    },

    async listarReservasDaSala(salaId) {
      return reservasGuardadas.filter((r) => r.salaId === salaId);
    },

    async guardarReserva(reserva) {
      const guardada = new Reserva({ ...reserva, id: proximoId++ });
      reservasGuardadas.push(guardada);
      return guardada;
    },

    async obterReserva(id) {
      return reservasGuardadas.find((r) => r.id === id) ?? null;
    },

    // Só apaga se ainda não tiver começado (verificado no momento da eliminação).
    async apagarReserva(id, agora) {
      const posicao = reservasGuardadas.findIndex(
        (r) => r.id === id && r.inicio.getTime() > agora.getTime()
      );
      if (posicao === -1) return false;
      reservasGuardadas.splice(posicao, 1);
      return true;
    },
  };
}
