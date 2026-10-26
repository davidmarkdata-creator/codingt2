"use server";

// Ficheiro de composição: cria o repositório e entrega-o aos casos de uso.
// É o único sítio da apresentação que importa de src/persistencia/.
import { reservarSala } from "../aplicacional/reservarSala";
import { criarRepositorioEmMemoria } from "../persistencia/repositorioEmMemoria";
import { SALAS_EXEMPLO } from "../persistencia/salasExemplo";
import { lisboaParaUtc } from "./horaLisboa";

// Em memória: os dados perdem-se quando o servidor reinicia.
const repositorio = criarRepositorioEmMemoria({ salas: SALAS_EXEMPLO });

export async function reservarSalaAction(_estadoAnterior, formData) {
  const salaId = Number(formData.get("salaId"));
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

  const resultado = await reservarSala({ salaId, inicio, fim }, repositorio);
  // Ao browser só vai o essencial (nada de objetos Date nem da reserva).
  return resultado.sucesso
    ? { sucesso: true }
    : { sucesso: false, erro: resultado.erro };
}
