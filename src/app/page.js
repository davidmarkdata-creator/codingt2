import { Suspense } from "react";
import { connection } from "next/server";
import Link from "next/link";
import CartaoSala from "../components/CartaoSala";
import { obterSalas } from "./actions";

const CLASSE_AVISO = "text-base text-zinc-600 sm:text-sm dark:text-zinc-400";
const CLASSE_ERRO =
  "rounded-lg bg-red-50 px-3 py-2 text-base text-red-700 sm:text-sm dark:bg-red-950/50 dark:text-red-300";

// Salas lidas da base de dados em cada pedido (nunca durante o build).
async function ListaSalas() {
  await connection();
  const resultado = await obterSalas();

  if (!resultado.sucesso) {
    return (
      <p role="alert" className={CLASSE_ERRO}>
        {resultado.erro}
      </p>
    );
  }
  if (resultado.salas.length === 0) {
    return <p className={CLASSE_AVISO}>Ainda não há salas.</p>;
  }
  return (
    <ul className="flex flex-col gap-3 sm:gap-4">
      {resultado.salas.map((sala) => (
        <CartaoSala
          key={sala.id}
          id={sala.id}
          nome={sala.nome}
          capacidade={sala.capacidade}
        />
      ))}
    </ul>
  );
}

export default function Home() {
  return (
    <div className="flex-1 bg-zinc-50 font-sans dark:bg-zinc-950">
      <main className="mx-auto w-full max-w-2xl px-4 pt-8 pb-32 sm:px-6 sm:pt-14">
        <header className="mb-6 sm:mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl dark:text-zinc-50">
            Salas
          </h1>
          <p className="mt-1 text-base text-zinc-600 dark:text-zinc-400">
            Escolha uma sala para fazer a reserva.
          </p>
          <Link
            href="/minhas-reservas"
            className="mt-3 inline-flex min-h-11 items-center text-base font-medium text-zinc-900 underline underline-offset-4 hover:text-zinc-600 sm:text-sm dark:text-zinc-50 dark:hover:text-zinc-300"
          >
            As minhas reservas →
          </Link>
        </header>
        <Suspense fallback={<p className={CLASSE_AVISO}>A carregar salas…</p>}>
          <ListaSalas />
        </Suspense>
      </main>
    </div>
  );
}
