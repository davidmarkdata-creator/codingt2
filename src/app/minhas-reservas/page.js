import Link from "next/link";
import CartaoReserva from "../../components/CartaoReserva";

// Dados de exemplo fixos: ainda não há lógica nem base de dados.
const RESERVAS = [
  { id: 1, nomeSala: "Sala Atlântico", data: "03/11/2026", inicio: "10:00", fim: "11:00" },
  { id: 2, nomeSala: "Sala Tejo", data: "05/11/2026", inicio: "14:30", fim: "16:00" },
  { id: 3, nomeSala: "Sala Douro", data: "12/11/2026", inicio: "09:00", fim: "09:30" },
];

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
        <ul className="flex flex-col gap-3 sm:gap-4">
          {RESERVAS.map((reserva) => (
            <CartaoReserva
              key={reserva.id}
              nomeSala={reserva.nomeSala}
              data={reserva.data}
              inicio={reserva.inicio}
              fim={reserva.fim}
            />
          ))}
        </ul>
      </main>
    </div>
  );
}
