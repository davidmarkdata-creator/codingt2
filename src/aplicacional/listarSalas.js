/**
 * Caso de uso "Listar salas".
 *
 * @param {import("./repositorio").Repositorio} repositorio
 */
export async function listarSalas(repositorio) {
  return repositorio.listarSalas();
}
