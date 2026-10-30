// Verificação da ligação ao PostgreSQL, corrida com `npm run verificar-ligacao`
// (ver verificarLigacao.js). Tudo o que grava ou apaga fica numa transação que
// é sempre anulada no fim.

const SQL_SESSAO = `
SELECT current_user AS utilizador, s.ssl, s.version, s.cipher
FROM pg_stat_ssl s
WHERE s.pid = pg_backend_pid()`;

const SQL_GRAVAR_TESTE = `
INSERT INTO reservas (sala_id, inicio, fim)
SELECT id, now(), now() + interval '1 hour' FROM salas ORDER BY nome LIMIT 1
RETURNING id`;

const SQL_CONTAR_TESTE = "SELECT count(*)::int AS total FROM reservas WHERE id = $1";

// 42501 = insufficient_privilege (ex.: "must be owner of table reservas").
const SEM_PERMISSAO = "42501";

/**
 * Liga numa só ligação do pool e devolve um relatório. Nunca usa o endereço:
 * os erros chegam já limpos de segredos (ligacao.js).
 *
 * @param {ReturnType<typeof import("./ligacao.js").criarLigacao>} ligacao
 */
export async function verificarLigacao(ligacao) {
  return ligacao.comCliente(async (cliente) => {
    const tls = cliente.infoTls();
    const {
      rows: [sessao = {}],
    } = await cliente.consultar(SQL_SESSAO);

    let idTeste = null;
    let gravar;
    let apagar;

    await cliente.consultar("BEGIN");
    try {
      await cliente.consultar("SAVEPOINT antes_de_gravar");
      try {
        const { rows } = await cliente.consultar(SQL_GRAVAR_TESTE);
        idTeste = rows[0]?.id ?? null;
        gravar = idTeste
          ? { permitido: true }
          : {
              permitido: false,
              motivo: "não há salas na base de dados para associar a reserva de teste",
            };
      } catch (erro) {
        await cliente.consultar("ROLLBACK TO SAVEPOINT antes_de_gravar");
        gravar = { permitido: false, motivo: erro.message };
      }

      await cliente.consultar("SAVEPOINT antes_de_apagar");
      try {
        await cliente.consultar("DROP TABLE reservas");
        // Se chegou aqui, apagou: o ROLLBACK abaixo desfaz o apagamento.
        apagar = { recusado: false, problemaSeguranca: true };
      } catch (erro) {
        await cliente.consultar("ROLLBACK TO SAVEPOINT antes_de_apagar");
        apagar =
          erro.code === SEM_PERMISSAO
            ? { recusado: true, problemaSeguranca: false, motivo: erro.message }
            : { recusado: false, problemaSeguranca: false, motivo: erro.message };
      }
    } finally {
      // Sempre: nada do que foi feito dentro da transação fica gravado.
      await cliente.consultar("ROLLBACK");
    }

    // Prova de que a anulação funcionou: a reserva de teste já não existe.
    let anulacaoConfirmada = null;
    if (idTeste) {
      const { rows } = await cliente.consultar(SQL_CONTAR_TESTE, [idTeste]);
      anulacaoConfirmada = rows[0]?.total === 0;
    }

    const servidor = {
      ssl: sessao.ssl === true,
      protocolo: sessao.version ?? null,
      cifra: sessao.cipher ?? null,
    };

    return {
      ok:
        tls.cifrada &&
        tls.certificadoConfirmado &&
        servidor.ssl &&
        gravar.permitido &&
        apagar.recusado &&
        anulacaoConfirmada === true,
      tls,
      servidor,
      utilizador: sessao.utilizador ?? null,
      gravar,
      apagar,
      anulacaoConfirmada,
    };
  });
}

/** Texto do relatório, em português, sem endereço nem palavra-passe. */
export function formatarRelatorio(r) {
  const cifragem = (ativa, protocolo, cifra) =>
    ativa ? `sim — ${protocolo}, ${cifra}` : "NÃO";

  let apagar;
  if (r.apagar.recusado) apagar = `recusado, como esperado (${r.apagar.motivo})`;
  else if (r.apagar.problemaSeguranca)
    apagar = "PERMITIDO — problema de segurança (o apagamento foi anulado)";
  else apagar = `não confirmado (${r.apagar.motivo})`;

  let anulacao;
  if (r.anulacaoConfirmada === true) anulacao = "sim — a reserva de teste já não existe";
  else if (r.anulacaoConfirmada === false)
    anulacao = "NÃO — a reserva de teste continua a existir";
  else anulacao = "sim (não houve reserva de teste para confirmar)";

  return [
    "Ligação: OK",
    `Cifrada (cliente): ${cifragem(r.tls.cifrada, r.tls.protocolo, r.tls.cifra)}`,
    `Cifrada (confirmado pelo servidor): ${cifragem(r.servidor.ssl, r.servidor.protocolo, r.servidor.cifra)}`,
    `Certificado do servidor confirmado: ${r.tls.certificadoConfirmado ? "sim (verificado com o DATABASE_CA_CERT)" : "NÃO"}`,
    `Utilizador: ${r.utilizador}`,
    `Gravar uma reserva de teste: ${r.gravar.permitido ? "permitido (anulado no fim)" : `NÃO (${r.gravar.motivo})`}`,
    `Apagar a tabela reservas: ${apagar}`,
    `Transação anulada: ${anulacao}`,
    `Resultado: ${r.ok ? "ligação segura e permissões corretas." : "há verificações que falharam (ver acima)."}`,
  ].join("\n");
}
