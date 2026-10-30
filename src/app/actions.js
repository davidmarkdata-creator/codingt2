"use server";

// Ficheiro de composição: cria o repositório e entrega-o aos casos de uso.
// É o único sítio da apresentação que importa de src/persistencia/.
import { reservarSala } from "../aplicacional/reservarSala";
import { listarSalas } from "../aplicacional/listarSalas";
import { listarReservas } from "../aplicacional/listarReservas";
import { criarLigacao } from "../persistencia/ligacao";
import { criarRepositorioPostgres } from "../persistencia/repositorioPostgres";
import { lisboaParaUtc, formatarEmLisboa } from "./horaLisboa";

const ERRO_GUARDAR = "Não foi possível guardar a reserva.";
const ERRO_CARREGAR_SALAS = "Não foi possível carregar as salas.";
const ERRO_CARREGAR_RESERVAS = "Não foi possível carregar as reservas.";

// Regista a causa no servidor (registos da Vercel / terminal), nunca no browser.
// As mensagens da ligação já vêm sem endereço, utilizador nem palavra-passe.
function registarErro(contexto, erro) {
  console.error(`${contexto}:`, erro?.message ?? erro);
}

// PostgreSQL no Aiven (DATABASE_URL, utilizador app_reservas). A ligação só é
// criada quando é precisa, para o build não depender da base de dados.
let repositorio;
function obterRepositorio() {
  repositorio ??= criarRepositorioPostgres(criarLigacao());
  return repositorio;
}

export async function reservarSalaAction(_estadoAnterior, formData) {
  // O id da sala é um UUID (texto): não se converte em número.
  const salaId = formData.get("salaId");
  const data = formData.get("data");

  let inicio;
  let fim;
  try {
    // Os valores do formulário são hora de Lisboa; o caso de uso recebe UTC.
    inicio = lisboaParaUtc(data, formData.get("inicio"));
    fim = lisboaParaUtc(data, formData.get("fim"));
  } catch (erro) {
    return { sucesso: false, erro: erro.message };
  }

  let repositorioAtual;
  try {
    repositorioAtual = obterRepositorio();
  } catch (erro) {
    // Ex.: DATABASE_URL em falta: responde como qualquer falha ao guardar.
    registarErro("Reservar sala: sem ligação à base de dados", erro);
    return { sucesso: false, erro: ERRO_GUARDAR };
  }

  const resultado = await reservarSala({ salaId, inicio, fim }, repositorioAtual);
  // Ao browser só vai o essencial (nada de objetos Date nem da reserva).
  return resultado.sucesso
    ? { sucesso: true }
    : { sucesso: false, erro: resultado.erro };
}

// Leituras para as páginas: só dados simples (nada de entidades nem Date).
// Se a base de dados falhar, devolvem uma mensagem sem detalhes da ligação.

export async function obterSalas() {
  try {
    const salas = await listarSalas(obterRepositorio());
    return {
      sucesso: true,
      salas: salas.map(({ id, nome, capacidade }) => ({ id, nome, capacidade })),
    };
  } catch (erro) {
    registarErro("Carregar salas", erro);
    return { sucesso: false, erro: ERRO_CARREGAR_SALAS };
  }
}

export async function obterReservas() {
  try {
    const repositorio = obterRepositorio();
    const [reservas, salas] = await Promise.all([
      listarReservas(repositorio),
      listarSalas(repositorio),
    ]);
    const nomePorSala = new Map(salas.map((sala) => [sala.id, sala.nome]));

    return {
      sucesso: true,
      reservas: reservas.map((reserva) => {
        // As datas são guardadas em UTC; mostram-se em hora de Lisboa.
        const inicio = formatarEmLisboa(reserva.inicio);
        const fim = formatarEmLisboa(reserva.fim);
        return {
          id: reserva.id,
          nomeSala: nomePorSala.get(reserva.salaId) ?? "Sala desconhecida",
          data: inicio.data,
          inicio: inicio.hora,
          fim: fim.hora,
        };
      }),
    };
  } catch (erro) {
    registarErro("Carregar reservas", erro);
    return { sucesso: false, erro: ERRO_CARREGAR_RESERVAS };
  }
}
