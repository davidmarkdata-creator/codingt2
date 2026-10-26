/**
 * Caso de uso "Listar reservas".
 *
 * @param {import("./repositorio").Repositorio} repositorio
 */
export async function listarReservas(repositorio) {
  return repositorio.listarReservas();
}
