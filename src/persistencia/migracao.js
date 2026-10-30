import { criarLigacao } from "./ligacao.js";

// Migração das tabelas salas e reservas, corrida pelo administrador com
// `npm run migrar` (ver migrar.js). Pode correr várias vezes.

const ERRO_SEM_ENDERECO_ADMIN =
  "DATABASE_ADMIN_URL não está definido: não é possível correr a migração.";
const ERRO_SEM_APP_RESERVAS =
  "O utilizador app_reservas não existe no Aiven: crie-o na consola antes de correr a migração.";
const ERRO_RESERVAS_INVALIDAS =
  "Existem reservas com fim antes do início: apague-as antes de correr a migração.";
const RESTRICAO_FIM_DEPOIS_DO_INICIO = "reservas_fim_depois_do_inicio";
const ERRO_RESERVAS_SOBREPOSTAS =
  "Existem reservas sobrepostas na mesma sala: resolva-as antes de correr a migração.";
const RESTRICAO_SEM_SOBREPOSICAO = "reservas_sem_sobreposicao";

// Enviado numa só consulta: corre numa só ligação e, se algum passo falhar,
// nada fica aplicado.
export const SQL_MIGRACAO = `
BEGIN;

CREATE TABLE IF NOT EXISTS salas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE,
  capacidade INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS reservas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sala_id UUID NOT NULL REFERENCES salas(id),
  inicio TIMESTAMPTZ NOT NULL,
  fim TIMESTAMPTZ NOT NULL
);

INSERT INTO salas (nome, capacidade)
VALUES ('Sala A', 12), ('Sala B', 6), ('Sala C', 20)
ON CONFLICT (nome) DO NOTHING;

-- Última barreira: o fim de uma reserva tem de ser depois do início.
-- Só é criada se ainda não existir; falha (23514) se houver reservas inválidas.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reservas_fim_depois_do_inicio') THEN
    ALTER TABLE reservas ADD CONSTRAINT reservas_fim_depois_do_inicio CHECK (fim > inicio);
  END IF;
END $$;

-- Garantia contra pedidos simultâneos: duas reservas da mesma sala não se podem
-- sobrepor. Intervalo [início, fim): reservas seguidas continuam permitidas.
-- Precisa do CHECK acima (tstzrange exige início <= fim). Só é criada se ainda
-- não existir; falha (23P01) se houver reservas sobrepostas.
CREATE EXTENSION IF NOT EXISTS btree_gist;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reservas_sem_sobreposicao') THEN
    ALTER TABLE reservas ADD CONSTRAINT reservas_sem_sobreposicao EXCLUDE USING gist (sala_id WITH =, tstzrange(inicio, fim, '[)') WITH &&);
  END IF;
END $$;

-- 1) Verificações do app_reservas: o que GRANT/REVOKE não controla.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_reservas'
             AND (rolsuper OR rolcreatedb OR rolcreaterole OR rolbypassrls OR rolreplication)) THEN
    RAISE EXCEPTION 'O utilizador app_reservas tem atributos especiais (SUPERUSER, CREATEDB, CREATEROLE, BYPASSRLS ou REPLICATION).';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_auth_members m JOIN pg_roles r ON r.oid = m.member
             WHERE r.rolname = 'app_reservas') THEN
    RAISE EXCEPTION 'O utilizador app_reservas pertence a outros papéis e herdaria as permissões deles.';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public'
             AND tablename IN ('salas', 'reservas') AND tableowner = 'app_reservas') THEN
    RAISE EXCEPTION 'O utilizador app_reservas é dono das tabelas salas/reservas (o dono tem todas as permissões).';
  END IF;
END $$;

-- 2) Permissões diretas do app_reservas (só afetam o app_reservas).
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM app_reservas;
GRANT SELECT, INSERT, UPDATE, DELETE ON salas, reservas TO app_reservas;
REVOKE CREATE ON SCHEMA public FROM app_reservas;
GRANT USAGE ON SCHEMA public TO app_reservas;
DO $$
BEGIN
  EXECUTE format('REVOKE CREATE, TEMPORARY ON DATABASE %I FROM app_reservas', current_database());
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO app_reservas', current_database());
END $$;

-- 3a) Herança de PUBLIC ou de papéis que contraria o requisito: falha.
DO $$
DECLARE tabela text; permissao text;
BEGIN
  FOREACH tabela IN ARRAY ARRAY['public.salas', 'public.reservas'] LOOP
    FOREACH permissao IN ARRAY ARRAY['TRUNCATE', 'REFERENCES', 'TRIGGER'] LOOP
      IF has_table_privilege('app_reservas', tabela, permissao) THEN
        RAISE EXCEPTION 'O app_reservas tem % em % por herança (PUBLIC ou outro papel).', permissao, tabela;
      END IF;
    END LOOP;
  END LOOP;
  -- O CREATE direto já foi retirado acima; se continuar, é herdado de PUBLIC.
  IF has_schema_privilege('app_reservas', 'public', 'CREATE') THEN
    RAISE EXCEPTION 'O app_reservas continua a poder criar objetos no esquema public por herança de PUBLIC (padrão antes do PostgreSQL 15). Retirar CREATE ON SCHEMA public a PUBLIC afeta todos os utilizadores: precisa da decisão de um administrador. A migração não altera permissões globais.';
  END IF;
END $$;

-- 3b) Só informação: TEMPORARY herdado de PUBLIC (padrão do PostgreSQL).
SELECT has_database_privilege('app_reservas', current_database(), 'TEMPORARY') AS temporary_herdado_de_public;

COMMIT;
`;

/**
 * Ligação com o utilizador administrador (DATABASE_ADMIN_URL). O certificado e
 * o proxy vêm do .env.local, como na ligação da app.
 *
 * @param {string} [adminUrl]
 */
export function criarLigacaoAdmin(adminUrl = process.env.DATABASE_ADMIN_URL) {
  if (!adminUrl?.trim()) throw new Error(ERRO_SEM_ENDERECO_ADMIN);
  return criarLigacao({ databaseUrl: adminUrl });
}

/**
 * Corre a migração e devolve o que a última consulta SELECT informa.
 *
 * @param {{ consultar: (sql: string) => Promise<unknown> }} ligacao
 * @returns {Promise<{ temporaryHerdadoDePublic: boolean }>}
 */
export async function executarMigracao(ligacao) {
  let resultados;
  try {
    resultados = await ligacao.consultar(SQL_MIGRACAO);
  } catch (erro) {
    // 42704 = objeto não existe (aqui, o papel app_reservas).
    if (erro?.code === "42704" && /app_reservas/.test(erro.message)) {
      throw new Error(ERRO_SEM_APP_RESERVAS);
    }
    // 23514 = violação de CHECK; só esta restrição tem a mensagem própria.
    if (erro?.code === "23514" && erro.message?.includes(RESTRICAO_FIM_DEPOIS_DO_INICIO)) {
      throw new Error(ERRO_RESERVAS_INVALIDAS);
    }
    // 23P01 = violação de EXCLUDE; só esta restrição tem a mensagem própria. Ao criar
    // a restrição, o nome vem na propriedade `constraint` ou, pelo menos, na mensagem.
    if (
      erro?.code === "23P01" &&
      (erro.constraint === RESTRICAO_SEM_SOBREPOSICAO ||
        erro.message?.includes(`"${RESTRICAO_SEM_SOBREPOSICAO}"`))
    ) {
      throw new Error(ERRO_RESERVAS_SOBREPOSTAS);
    }
    throw erro;
  }

  // Várias instruções numa consulta: o pg devolve um resultado por instrução.
  const lista = Array.isArray(resultados) ? resultados : [resultados];
  const ultimoSelect = lista.filter((r) => r?.command === "SELECT").at(-1);
  return {
    temporaryHerdadoDePublic: Boolean(
      ultimoSelect?.rows?.[0]?.temporary_herdado_de_public
    ),
  };
}
