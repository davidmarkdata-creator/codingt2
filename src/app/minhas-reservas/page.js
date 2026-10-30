import { Suspense } from "react";
import { connection } from "next/server";
import Link from "next/link";
import CartaoReserva from "../../components/CartaoReserva";
import { obterReservas } from "../actions";

const CLASSE_AVISO = "text-base text-zinc-600 sm:text-sm dark:text-zinc-400";
const CLASSE_ERRO =
  "rounded-lg bg-red-50 px-3 py-2 text-base text-red-700 sm:text-sm dark:bg-red-950/50 dark:text-red-300";

// Reservas lidas da base de dados em cada pedido (nunca durante o build).
// Nesta fase mostram-se todas as reservas: a app ainda não tem utilizadores.
async function ListaReservas() {
  await connection();
  const resultado = await obterReservas();

  if (!resultado.sucesso) {
    return (
      <p role="alert" className={CLASSE_ERRO}>
        {resultado.erro}
      </p>
    );
  }
  if (resultado.reservas.length === 0) {
    return <p className={CLASSE_AVISO}>Ainda não há reservas.</p>;
  }
  return (
    <ul className="flex flex-col gap-3 sm:gap-4">
      {resultado.reservas.map((reserva) => (
        <CartaoReserva
          key={reserva.id}
          nomeSala={reserva.nomeSala}
          data={reserva.data}
          inicio={reserva.inicio}
          fim={reserva.fim}
        />
      ))}
    </ul>
  );
}

export default function MinhasReservas() {
  return (
    <div className="flex-1 bg-zinc-50 font-sans dark:bg-zinc-950">
      <main className="mx-auto w-full max-w-2xl px-4 pt-8 pb-32 sm:px-6 sm:pt-14">
        <Link
          href="/"
          className="mb-4 inline-flex min-h-11 items-center text-base font-medium text-zinc-700 underline-offset-4 hover:underline sm:text-sm dark:text-zinc-300"
        >
          ← Voltar às salas
        </Link>
        <header className="mb-6 sm:mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl dark:text-zinc-50">
            As minhas reservas
          </h1>
          <p className="mt-1 text-base text-zinc-600 dark:text-zinc-400">
            Reservas que tem marcadas.
          </p>
        </header>
        <Suspense fallback={<p className={CLASSE_AVISO}>A carregar reservas…</p>}>
          <ListaReservas />
        </Suspense>
      </main>
    </div>
  );
}
