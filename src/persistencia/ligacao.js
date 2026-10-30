import tls from "node:tls";
import pg from "pg";
import { criarTunel, interpretarProxy } from "./tunelProxy.js";

// Ligação ao PostgreSQL (Aiven). Só para o servidor: é importado apenas pela
// camada de persistência, em testes e em scripts.

const { Pool } = pg;

const ERRO_SEM_ENDERECO =
  "DATABASE_URL não está definido: não é possível ligar à base de dados.";
const ERRO_SEM_CERTIFICADO =
  "DATABASE_CA_CERT não está definido: não é possível verificar o certificado da base de dados.";
const ERRO_ENDERECO_INVALIDO =
  "DATABASE_URL não é um endereço válido: não é possível ligar à base de dados.";

// Parâmetros do endereço que o pg usaria para decidir o SSL por cima da nossa
// configuração. Retiram-se todos: a cifragem é decidida só aqui.
const PARAMETROS_SSL = ["sslmode", "sslrootcert", "sslcert", "sslkey", "ssl"];

// Textos sensíveis do endereço (completo, servidor, utilizador, palavra-passe,
// base de dados), do mais comprido para o mais curto.
function segredosDoEndereco(original, url) {
  const valores = new Set([original, url.toString(), url.host, url.hostname]);
  for (const parte of [url.username, url.password, url.pathname.slice(1)]) {
    valores.add(parte);
    try {
      valores.add(decodeURIComponent(parte));
    } catch {
      // parte mal codificada: fica só a forma original
    }
  }
  return [...valores].filter(Boolean).sort((a, b) => b.length - a.length);
}

function criarLimpeza(segredos) {
  return (texto) =>
    segredos.reduce(
      (resultado, segredo) => resultado.split(segredo).join("***"),
      String(texto ?? "")
    );
}

// Erro novo só com a mensagem limpa (sem "cause", que guardaria o original).
// Mantém o código e o nome da restrição (ex.: 23P01 em reservas_sem_sobreposicao),
// também limpo, para as camadas acima saberem que regra foi violada.
function erroLimpo(erro, limpar) {
  const novo = new Error(limpar(erro?.message));
  if (erro?.code) novo.code = erro.code;
  if (erro?.constraint) novo.constraint = limpar(erro.constraint);
  return novo;
}

// Depois do pedido de SSL, o pg troca o stream da ligação por um TLSSocket.
function lerInfoTls(stream) {
  if (!(stream instanceof tls.TLSSocket)) {
    return { cifrada: false, protocolo: null, cifra: null, certificadoConfirmado: false };
  }
  return {
    cifrada: true,
    protocolo: stream.getProtocol() ?? null,
    cifra: stream.getCipher()?.name ?? null,
    certificadoConfirmado: stream.authorized === true,
  };
}

/**
 * Cria a ligação ao PostgreSQL. O endereço vem de `databaseUrl` ou do
 * DATABASE_URL; o certificado do Aiven vem de `caCert` ou do DATABASE_CA_CERT.
 * A ligação é sempre cifrada e verifica sempre o certificado.
 * Com `proxy` ou DATABASE_PROXY, cada ligação passa por um túnel no proxy HTTP.
 *
 * `comCliente(funcao)` reserva uma só ligação do pool (para transações e para
 * `infoTls()`) e devolve-a sempre no fim, mesmo em caso de erro.
 *
 * @param {{ databaseUrl?: string, caCert?: string, proxy?: string }} [opcoes]
 * @returns {{
 *   consultar: (sql: string, parametros?: unknown[]) => Promise<import("pg").QueryResult>,
 *   comCliente: <T>(funcao: (cliente: {
 *     consultar: (sql: string, parametros?: unknown[]) => Promise<import("pg").QueryResult>,
 *     infoTls: () => { cifrada: boolean, protocolo: string | null, cifra: string | null, certificadoConfirmado: boolean },
 *   }) => Promise<T>) => Promise<T>,
 *   fechar: () => Promise<void>,
 * }}
 */
export function criarLigacao({ databaseUrl, caCert, proxy } = {}) {
  const endereco = databaseUrl ?? process.env.DATABASE_URL;
  const certificado = caCert ?? process.env.DATABASE_CA_CERT;
  const valorProxy = proxy ?? process.env.DATABASE_PROXY;

  if (!endereco?.trim()) throw new Error(ERRO_SEM_ENDERECO);
  if (!certificado?.trim()) throw new Error(ERRO_SEM_CERTIFICADO);

  let url;
  try {
    url = new URL(endereco);
  } catch {
    // O erro do URL guarda o endereço completo: não pode ser propagado.
    throw new Error(ERRO_ENDERECO_INVALIDO);
  }
  for (const parametro of PARAMETROS_SSL) url.searchParams.delete(parametro);

  // Sem proxy, a configuração fica exatamente como antes (sem `stream`).
  const destinoProxy = valorProxy?.trim() ? interpretarProxy(valorProxy) : null;

  const limpar = criarLimpeza(segredosDoEndereco(endereco, url));

  const pool = new Pool({
    connectionString: url.toString(),
    ssl: {
      // Na Vercel o certificado costuma vir numa só linha, com "\n" em texto.
      ca: certificado.replace(/\\n/g, "\n"),
      rejectUnauthorized: true,
    },
    // O pg chama esta função em cada ligação nova: um túnel por ligação.
    ...(destinoProxy && { stream: () => criarTunel({ proxy: destinoProxy }) }),
  });

  // Sem este handler, um erro numa ligação inativa derrubaria o processo.
  pool.on("error", (erro) => {
    console.error("Erro na ligação à base de dados:", limpar(erro?.message));
  });

  return {
    async consultar(sql, parametros) {
      try {
        return await pool.query(sql, parametros);
      } catch (erro) {
        throw erroLimpo(erro, limpar);
      }
    },

    async comCliente(funcao) {
      let cliente;
      try {
        cliente = await pool.connect();
      } catch (erro) {
        throw erroLimpo(erro, limpar);
      }

      let falhou = false;
      try {
        return await funcao({
          async consultar(sql, parametros) {
            try {
              return await cliente.query(sql, parametros);
            } catch (erro) {
              throw erroLimpo(erro, limpar);
            }
          },
          infoTls: () => lerInfoTls(cliente.connection?.stream),
        });
      } catch (erro) {
        falhou = true;
        throw erro;
      } finally {
        // Em caso de erro, o estado da ligação é incerto: o pool fecha-a em vez
        // de a reutilizar (o PostgreSQL anula então qualquer transação aberta).
        cliente.release(falhou ? true : undefined);
      }
    },

    async fechar() {
      await pool.end();
    },
  };
}
