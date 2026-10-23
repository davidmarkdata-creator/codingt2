import { execFile } from "node:child_process";

// Ferramenta apenas de desenvolvimento: fora de 'development' a route não existe.

const MSG_VARIAVEIS = "Variáveis GIT_ do .env.local não configuradas";
const MENSAGEM_POR_OMISSAO = "WIP: sessão em curso";

function emDesenvolvimento() {
  return process.env.NODE_ENV === "development";
}

function lerConfig() {
  const { GIT_TOKEN, GIT_REPO_URL, GIT_USER_NAME, GIT_USER_EMAIL } =
    process.env;
  if (!GIT_TOKEN || !GIT_REPO_URL || !GIT_USER_NAME || !GIT_USER_EMAIL) {
    return null;
  }
  const tokenB64 = Buffer.from(`x-access-token:${GIT_TOKEN}`).toString(
    "base64"
  );
  return {
    token: GIT_TOKEN,
    tokenB64,
    repoUrl: `https://${GIT_REPO_URL}`,
    nome: GIT_USER_NAME,
    email: GIT_USER_EMAIL,
  };
}

// Remove o token (e a sua forma base64) de qualquer texto devolvido ao cliente.
function limpar(texto, config) {
  let saida = String(texto ?? "");
  for (const segredo of [config.token, config.tokenB64]) {
    if (segredo) saida = saida.split(segredo).join("***");
  }
  return saida.trim().slice(0, 2000);
}

// O token vai no cabeçalho HTTP http.extraHeader, mas passado por variáveis de
// ambiente do processo (e não por "-c") para não aparecer nos argumentos do git.
function ambienteComAutenticacao(config) {
  return {
    ...process.env,
    GIT_TERMINAL_PROMPT: "0",
    GIT_CONFIG_COUNT: "1",
    GIT_CONFIG_KEY_0: "http.extraHeader",
    GIT_CONFIG_VALUE_0: `Authorization: Basic ${config.tokenB64}`,
  };
}

function git(args, config, { autenticado = false } = {}) {
  return new Promise((resolve, reject) => {
    execFile(
      "git",
      args,
      {
        cwd: process.cwd(),
        env: autenticado ? ambienteComAutenticacao(config) : process.env,
        maxBuffer: 10 * 1024 * 1024,
        windowsHide: true,
      },
      (erro, stdout, stderr) => {
        if (erro) {
          reject(new Error(limpar(stderr || erro.message, config)));
          return;
        }
        resolve(stdout);
      }
    );
  });
}

async function haAlteracoes(config) {
  const saida = await git(["status", "--porcelain"], config);
  return saida.trim().length > 0;
}

async function haCommitsPorEnviar(config) {
  let local;
  try {
    local = (await git(["rev-parse", "HEAD"], config)).trim();
  } catch {
    return true; // ainda sem commits locais
  }
  const remoto = await git(["ls-remote", config.repoUrl, "main"], config, {
    autenticado: true,
  });
  const hashRemoto = remoto.trim().split(/\s+/)[0] ?? "";
  return hashRemoto !== local;
}

export async function GET() {
  if (!emDesenvolvimento()) {
    return new Response(null, { status: 404 });
  }
  const config = lerConfig();
  if (!config) {
    return Response.json({ error: MSG_VARIAVEIS }, { status: 500 });
  }
  try {
    const pendente =
      (await haAlteracoes(config)) || (await haCommitsPorEnviar(config));
    return Response.json({ pendente });
  } catch (erro) {
    return Response.json({ error: erro.message }, { status: 500 });
  }
}

export async function POST(request) {
  if (!emDesenvolvimento()) {
    return new Response(null, { status: 404 });
  }
  const config = lerConfig();
  if (!config) {
    return Response.json({ error: MSG_VARIAVEIS }, { status: 500 });
  }

  let mensagem = MENSAGEM_POR_OMISSAO;
  try {
    const corpo = await request.json();
    if (typeof corpo?.mensagem === "string" && corpo.mensagem.trim()) {
      mensagem = corpo.mensagem.trim();
    }
  } catch {
    // corpo ausente ou inválido: usa a mensagem por omissão
  }

  try {
    if (await haAlteracoes(config)) {
      await git(["add", "-A"], config);
      await git(
        [
          "-c",
          `user.name=${config.nome}`,
          "-c",
          `user.email=${config.email}`,
          "commit",
          "-m",
          mensagem,
        ],
        config
      );
    }
    await git(["push", config.repoUrl, "main"], config, { autenticado: true });
    return Response.json({ ok: true });
  } catch (erro) {
    return Response.json({ error: erro.message }, { status: 500 });
  }
}
