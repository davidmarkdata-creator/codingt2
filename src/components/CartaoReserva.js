import BotaoCancelarReserva from "./BotaoCancelarReserva";

export default function CartaoReserva({ id, nomeSala, data, inicio, fim, podeCancelar }) {
  return (
    <li className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            {nomeSala}
          </h2>
          <dl className="mt-1 flex flex-wrap gap-2 text-sm text-zinc-700 dark:text-zinc-300">
            <div className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-0.5 dark:bg-zinc-800">
              <dt>Data:</dt>
              <dd>{data}</dd>
            </div>
            <div className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-0.5 dark:bg-zinc-800">
              <dt className="sr-only">Horário:</dt>
              <dd>
                {inicio} – {fim}
              </dd>
            </div>
          </dl>
        </div>
        {/* Só as reservas futuras podem ser canceladas. */}
        {podeCancelar && (
          <BotaoCancelarReserva
            reservaId={id}
            descricao={`da ${nomeSala} de ${data}, ${inicio} – ${fim}`}
          />
        )}
      </div>
    </li>
  );
}
