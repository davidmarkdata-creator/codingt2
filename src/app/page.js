import Link from "next/link";
import CartaoSala from "../components/CartaoSala";

// Dados de exemplo fixos. Os ids têm de coincidir com src/persistencia/salasExemplo.js.
const SALAS = [
  { id: 1, nome: "Sala Atlântico", capacidade: 12 },
  { id: 2, nome: "Sala Douro", capacidade: 6 },
  { id: 3, nome: "Sala Tejo", capacidade: 20 },
  { id: 4, nome: "Sala Mondego", capacidade: 4 },
];

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
        <ul className="flex flex-col gap-3 sm:gap-4">
          {SALAS.map((sala) => (
            <CartaoSala
              key={sala.id}
              id={sala.id}
              nome={sala.nome}
              capacidade={sala.capacidade}
            />
          ))}
        </ul>
      </main>
    </div>
  );
}
