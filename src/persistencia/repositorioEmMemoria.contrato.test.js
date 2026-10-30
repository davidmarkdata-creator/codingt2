import { Sala } from "../dominio/sala";
import { criarRepositorioEmMemoria } from "./repositorioEmMemoria";
import { descreverContratoRepositorio } from "./contratoRepositorio";

const SALAS = [
  new Sala({ id: 1, nome: "Sala Atlântico", capacidade: 12 }),
  new Sala({ id: 2, nome: "Sala Douro", capacidade: 6 }),
];

// Cada teste recebe um repositório novo; em memória não há nada para apagar.
descreverContratoRepositorio("em memória", () => ({
  repositorio: criarRepositorioEmMemoria({ salas: SALAS }),
  salas: SALAS,
  limpar: async () => {},
}));
