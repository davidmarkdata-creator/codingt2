import net from "node:net";
import { Duplex } from "node:stream";

// Túnel HTTP CONNECT através do proxy da empresa. O pg recebe-o pela opção
// `stream` e faz o TLS por cima dele até ao Aiven, como numa ligação direta.

export const ERRO_PROXY_INVALIDO =
  "DATABASE_PROXY não é válido: use o formato http://servidor:porta.";

const TEMPO_LIMITE_MS = 10_000;
const TAMANHO_MAXIMO_RESPOSTA = 16 * 1024;

/**
 * Interpreta o valor de DATABASE_PROXY, com ou sem "http://".
 * Só aceita http://servidor:porta (sem utilizador, palavra-passe nem caminho).
 *
 * @param {string} valor
 * @returns {{ host: string, port: number }}
 */
export function interpretarProxy(valor) {
  const texto = String(valor ?? "").trim();
  const comEsquema = /^[a-z][a-z\d+.-]*:\/\//i.test(texto) ? texto : `http://${texto}`;

  let url;
  try {
    url = new URL(comEsquema);
  } catch {
    throw new Error(ERRO_PROXY_INVALIDO);
  }

  // O URL esconde a porta 80 por ser a predefinida do http: aceitá-la se foi escrita.
  const porta = url.port || (/:80\/?$/.test(comEsquema) ? "80" : "");
  if (
    url.protocol !== "http:" ||
    !url.hostname ||
    !porta ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new Error(ERRO_PROXY_INVALIDO);
  }

  return { host: url.hostname.replace(/^\[|\]$/g, ""), port: Number(porta) };
}

class TunelProxy extends Duplex {
  constructor({ proxy, tempoLimiteMs }) {
    super();
    this._proxy = proxy;
    this._tempoLimiteMs = tempoLimiteMs;
    this._socket = null;
    this._semAtraso = false;
    this._manterVivo = null;
  }

  // Métodos de socket que o pg chama.
  setNoDelay(ativo = true) {
    this._semAtraso = ativo;
    this._socket?.setNoDelay(ativo);
    return this;
  }

  setKeepAlive(ativo, atrasoInicial) {
    this._manterVivo = [ativo, atrasoInicial];
    this._socket?.setKeepAlive(ativo, atrasoInicial);
    return this;
  }

  ref() {
    this._socket?.ref();
    return this;
  }

  unref() {
    this._socket?.unref();
    return this;
  }

  /** Pede ao proxy "CONNECT servidor:porta"; emite "connect" depois do 200. */
  connect(porta, servidor) {
    const alvo = `${servidor.includes(":") ? `[${servidor}]` : servidor}:${porta}`;
    const socket = net.connect(this._proxy.port, this._proxy.host);
    this._socket = socket;
    socket.setNoDelay(this._semAtraso);

    let resposta = Buffer.alloc(0);
    let terminado = false;

    const terminar = () => {
      terminado = true;
      clearTimeout(temporizador);
      socket.off("data", aoLer);
      socket.off("close", aoFechar);
    };

    const falhar = (mensagem, codigo) => {
      if (terminado) return;
      terminar();
      const erro = new Error(mensagem);
      if (codigo) erro.code = codigo;
      socket.destroy();
      this.destroy(erro);
    };

    const temporizador = setTimeout(
      () =>
        falhar(
          `O proxy não respondeu ao pedido de túnel em ${this._tempoLimiteMs / 1000} s.`,
          "ETIMEDOUT"
        ),
      this._tempoLimiteMs
    );

    const aoLer = (parte) => {
      resposta = Buffer.concat([resposta, parte]);
      const fimCabecalhos = resposta.indexOf("\r\n\r\n");
      if (fimCabecalhos === -1) {
        if (resposta.length > TAMANHO_MAXIMO_RESPOSTA) {
          falhar("O proxy respondeu de forma inválida ao pedido de túnel.");
        }
        return;
      }

      const linha = resposta.subarray(0, resposta.indexOf("\r\n")).toString("latin1");
      const [, estado] = /^HTTP\/1\.[01] (\d{3})/.exec(linha) ?? [];
      if (!estado) {
        return falhar("O proxy respondeu de forma inválida ao pedido de túnel.");
      }
      if (estado !== "200") {
        return falhar(`O proxy recusou o túnel para a base de dados (HTTP ${estado}).`);
      }

      terminar();
      this._ligar(socket, resposta.subarray(fimCabecalhos + 4));
    };

    const aoFechar = () =>
      falhar("O proxy fechou a ligação antes de abrir o túnel.", "ECONNRESET");

    socket.on("data", aoLer);
    socket.on("close", aoFechar);
    socket.on("error", (erro) => {
      if (terminado) return;
      falhar(`Não foi possível ligar ao proxy (${erro.code ?? "erro desconhecido"}).`, erro.code);
    });
    socket.once("connect", () => {
      socket.write(`CONNECT ${alvo} HTTP/1.1\r\nHost: ${alvo}\r\n\r\n`);
    });

    return this;
  }

  // Túnel aberto: daqui em diante só reencaminha bytes nos dois sentidos.
  _ligar(socket, restoDaResposta) {
    socket.on("data", (dados) => {
      if (!this.push(dados)) socket.pause();
    });
    socket.on("end", () => this.push(null));
    socket.on("error", (erro) => this.destroy(erro));
    socket.on("close", () => {
      if (!this.destroyed) this.destroy();
    });
    if (this._manterVivo) socket.setKeepAlive(...this._manterVivo);

    this.emit("connect");
    // Bytes que chegaram no mesmo pacote que o 200 já são do servidor de destino.
    if (restoDaResposta.length > 0) this.push(restoDaResposta);
  }

  _read() {
    this._socket?.resume();
  }

  _write(dados, codificacao, feito) {
    this._socket.write(dados, codificacao, feito);
  }

  _final(feito) {
    if (this._socket) this._socket.end(feito);
    else feito();
  }

  _destroy(erro, feito) {
    this._socket?.destroy();
    // Quando é o TLS por cima a fechar o túnel (ex.: certificado recusado), o
    // "close" do túnel não pode chegar ao pg antes do erro do TLS, senão o pg
    // só mostra "Connection terminated unexpectedly" e esconde a causa.
    setImmediate(() => feito(erro));
  }
}

/**
 * Cria um túnel novo (um por ligação do pool).
 *
 * @param {{ proxy: { host: string, port: number }, tempoLimiteMs?: number }} opcoes
 */
export function criarTunel({ proxy, tempoLimiteMs = TEMPO_LIMITE_MS }) {
  return new TunelProxy({ proxy, tempoLimiteMs });
}
