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
function erroLimpo(erro, limpar) {
  const novo = new Error(limpar(erro?.message));
  if (erro?.code) novo.code = erro.code;
  return novo;
}

/**
 * Cria a ligação ao PostgreSQL. O endereço vem de `databaseUrl` ou do
 * DATABASE_URL; o certificado do Aiven vem de `caCert` ou do DATABASE_CA_CERT.
 * A ligação é sempre cifrada e verifica sempre o certificado.
 * Com `proxy` ou DATABASE_PROXY, cada ligação passa por um túnel no proxy HTTP.
 *
 * @param {{ databaseUrl?: string, caCert?: string, proxy?: string }} [opcoes]
 * @returns {{ consultar: (sql: string, parametros?: unknown[]) => Promise<import("pg").QueryResult>, fechar: () => Promise<void> }}
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

    async fechar() {
      await pool.end();
    },
  };
}
