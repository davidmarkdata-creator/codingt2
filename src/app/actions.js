"use server";

// Ficheiro de composição: cria o repositório e entrega-o aos casos de uso.
// É o único sítio da apresentação que importa de src/persistencia/.
import { reservarSala } from "../aplicacional/reservarSala";
import { criarLigacao } from "../persistencia/ligacao";
import { criarRepositorioPostgres } from "../persistencia/repositorioPostgres";
import { lisboaParaUtc } from "./horaLisboa";

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

  const resultado = await reservarSala({ salaId, inicio, fim }, obterRepositorio());
  // Ao browser só vai o essencial (nada de objetos Date nem da reserva).
  return resultado.sucesso
    ? { sucesso: true }
    : { sucesso: false, erro: resultado.erro };
}
