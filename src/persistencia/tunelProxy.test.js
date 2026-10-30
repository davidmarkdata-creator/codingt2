import { describe, it, expect, afterEach } from "vitest";
import net from "node:net";
import tls from "node:tls";
import { criarTunel } from "./tunelProxy";
import { criarLigacao } from "./ligacao";
import {
  CHAVE_SERVIDOR_TESTE,
  CERTIFICADO_SERVIDOR_TESTE,
  CERTIFICADO_NAO_CONFIAVEL,
} from "./certificadoTeste";

// Servidores falsos em localhost, fechados no fim de cada teste.
const abertos = [];

function escutar(servidor) {
  const sockets = new Set();
  servidor.on("connection", (s) => {
    sockets.add(s);
    s.on("close", () => sockets.delete(s));
    s.on("error", () => {});
  });
  abertos.push({ servidor, sockets });
  return new Promise((resolve) =>
    servidor.listen(0, "127.0.0.1", () => resolve(servidor.address().port))
  );
}

afterEach(async () => {
  for (const { servidor, sockets } of abertos.splice(0)) {
    for (const s of sockets) s.destroy();
    await new Promise((resolve) => servidor.close(resolve));
  }
});

// Servidor de destino que devolve tudo o que recebe.
function servidorEco() {
  return escutar(net.createServer((s) => s.pipe(s)));
}

// Proxy HTTP falso. Regista o pedido CONNECT e responde conforme o comportamento.
async function proxyFalso(comportamento) {
  const pedidos = [];
  const servidor = net.createServer((cliente) => {
    let recebido = "";
    cliente.on("data", function lerPedido(parte) {
      recebido += parte.toString("latin1");
      if (!recebido.includes("\r\n\r\n")) return;
      cliente.off("data", lerPedido);
      const linha = recebido.split("\r\n")[0];
      pedidos.push(linha);

      if (comportamento === "recusa") {
        cliente.end("HTTP/1.1 403 Forbidden\r\nContent-Length: 0\r\n\r\n");
      } else if (comportamento === "200+S") {
        cliente.write("HTTP/1.1 200 Connection established\r\n\r\nS");
      } else if (comportamento === "aceita") {
        const [, destino] = linha.split(" ");
        const separador = destino.lastIndexOf(":");
        const destinoSocket = net.connect(
          Number(destino.slice(separador + 1)),
          destino.slice(0, separador),
          () => {
            cliente.write("HTTP/1.1 200 Connection established\r\n\r\n");
            cliente.pipe(destinoSocket).pipe(cliente);
          }
        );
        destinoSocket.on("error", () => cliente.destroy());
      }
      // "mudo": nunca responde.
    });
  });
  const porta = await escutar(servidor);
  return { proxy: { host: "127.0.0.1", port: porta }, pedidos };
}

function abrir(tunel, porta, servidor) {
  return new Promise((resolve, reject) => {
    tunel.once("connect", resolve);
    tunel.once("error", reject);
    tunel.connect(porta, servidor);
  });
}

function proximosDados(tunel) {
  return new Promise((resolve) => tunel.once("data", (d) => resolve(d.toString())));
}

describe("criarTunel: túnel HTTP CONNECT pelo proxy", () => {
  it("abre o túnel com CONNECT e depois funciona como um socket normal", async () => {
    const portaEco = await servidorEco();
    const { proxy, pedidos } = await proxyFalso("aceita");
    const tunel = criarTunel({ proxy });

    await abrir(tunel, portaEco, "localhost");
    const resposta = proximosDados(tunel);
    tunel.write("olá através do túnel");

    expect(await resposta).toBe("olá através do túnel");
    expect(pedidos).toEqual([`CONNECT localhost:${portaEco} HTTP/1.1`]);
    tunel.destroy();
  });

  it("dá um erro claro quando o proxy recusa o túnel (403)", async () => {
    const { proxy } = await proxyFalso("recusa");
    const tunel = criarTunel({ proxy });

    await expect(abrir(tunel, 5432, "bd.exemplo.com")).rejects.toThrow(
      "O proxy recusou o túnel para a base de dados (HTTP 403)."
    );
  });

  it("dá um erro claro quando o proxy não responde", async () => {
    const { proxy } = await proxyFalso("mudo");
    const tunel = criarTunel({ proxy, tempoLimiteMs: 200 });

    await expect(abrir(tunel, 5432, "bd.exemplo.com")).rejects.toThrow(
      "O proxy não respondeu ao pedido de túnel"
    );
  });

  it("entrega os bytes que chegam juntos com a resposta 200", async () => {
    const { proxy } = await proxyFalso("200+S");
    const tunel = criarTunel({ proxy });

    const ligado = abrir(tunel, 5432, "bd.exemplo.com");
    const dados = proximosDados(tunel);
    await ligado;

    expect(await dados).toBe("S");
    tunel.destroy();
  });

  it("o pg recusa um certificado não confiável por cima do túnel", async () => {
    // Servidor PostgreSQL falso: aceita o pedido de SSL ("S") e apresenta um
    // certificado que o cliente não confia.
    let tlsIniciado = false;
    const portaBd = await escutar(
      net.createServer((socket) => {
        socket.once("data", () => {
          socket.write("S");
          tlsIniciado = true;
          const seguro = new tls.TLSSocket(socket, {
            isServer: true,
            key: CHAVE_SERVIDOR_TESTE,
            cert: CERTIFICADO_SERVIDOR_TESTE,
          });
          seguro.on("error", () => {});
        });
      })
    );
    const { proxy, pedidos } = await proxyFalso("aceita");

    const ligacao = criarLigacao({
      databaseUrl: `postgres://utilizador:palavra@localhost:${portaBd}/bd`,
      caCert: CERTIFICADO_NAO_CONFIAVEL,
      proxy: `${proxy.host}:${proxy.port}`,
    });

    const erro = await ligacao.consultar("SELECT 1").catch((e) => e);
    await ligacao.fechar();

    expect(pedidos).toEqual([`CONNECT localhost:${portaBd} HTTP/1.1`]);
    expect(tlsIniciado).toBe(true);
    expect(erro).toBeInstanceOf(Error);
    expect(erro.message).toMatch(/certificate/i);
  });
});
