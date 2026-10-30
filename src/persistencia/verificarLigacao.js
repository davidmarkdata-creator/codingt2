// Ponto de entrada de `npm run verificar-ligacao` (corre com node, sem o Next.js).
// O .env.local é carregado pelo próprio comando (node --env-file=.env.local).
import { criarLigacao } from "./ligacao.js";
import { verificarLigacao, formatarRelatorio } from "./verificacaoLigacao.js";

let ligacao;
try {
  ligacao = criarLigacao();
  const relatorio = await verificarLigacao(ligacao);
  console.log(formatarRelatorio(relatorio));
  if (!relatorio.ok) process.exitCode = 1;
} catch (erro) {
  // As mensagens já chegam sem endereço, utilizador nem palavra-passe (ligacao.js).
  console.error(`Ligação: falhou (${erro.message})`);
  process.exitCode = 1;
} finally {
  try {
    await ligacao?.fechar();
  } catch {
    // nada a fazer: o processo vai terminar
  }
}
