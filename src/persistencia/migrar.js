// Ponto de entrada de `npm run migrar` (corre com node, sem o Next.js).
// O .env.local é carregado pelo próprio comando (node --env-file=.env.local).
import { criarLigacaoAdmin, executarMigracao } from "./migracao.js";

let ligacao;
try {
  ligacao = criarLigacaoAdmin();
  const { temporaryHerdadoDePublic } = await executarMigracao(ligacao);

  console.log(
    "Migração concluída: tabelas salas e reservas prontas, salas de exemplo garantidas, permissões do app_reservas aplicadas."
  );
  console.log(
    `TEMPORARY na base de dados para o app_reservas: ${temporaryHerdadoDePublic ? "sim" : "não"} ` +
      "(herdado de PUBLIC, comum a todos os utilizadores; não alterado)."
  );
} catch (erro) {
  // As mensagens já chegam sem endereço, utilizador nem palavra-passe (ligacao.js).
  console.error(`Migração falhou: ${erro.message}`);
  process.exitCode = 1;
} finally {
  // Fechar a ligação também desfaz uma transação que tenha ficado a meio.
  try {
    await ligacao?.fechar();
  } catch {
    // nada a fazer: o processo vai terminar
  }
}
