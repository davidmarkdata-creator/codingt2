import { Sala } from "../dominio/sala";

// Salas fixas de exemplo, até existir base de dados.
// Os ids têm de coincidir com a lista fixa de src/app/page.js.
export const SALAS_EXEMPLO = [
  new Sala({ id: 1, nome: "Sala Atlântico", capacidade: 12 }),
  new Sala({ id: 2, nome: "Sala Douro", capacidade: 6 }),
  new Sala({ id: 3, nome: "Sala Tejo", capacidade: 20 }),
  new Sala({ id: 4, nome: "Sala Mondego", capacidade: 4 }),
];
