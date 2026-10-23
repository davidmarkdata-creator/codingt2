"use client";

const CLASSE_ROTULO =
  "flex flex-col gap-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300";
// text-base em telemóvel evita o zoom automático do iOS ao focar o campo.
const CLASSE_CAMPO =
  "min-h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 text-base text-zinc-900 focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/20 sm:text-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:focus:border-zinc-300 dark:focus:ring-zinc-300/20";

// Ainda não guarda nada: submeter só fecha o formulário.
export default function FormularioReserva({ nomeSala, onFechar }) {
  function aoSubmeter(e) {
    e.preventDefault();
    onFechar();
  }

  return (
    <form
      onSubmit={aoSubmeter}
      aria-label={`Reservar ${nomeSala}`}
      className="mt-4 grid gap-4 border-t border-zinc-200 pt-4 sm:grid-cols-3 dark:border-zinc-800"
    >
      <label className={CLASSE_ROTULO}>
        Data da reserva
        <input type="date" name="data" required className={CLASSE_CAMPO} />
      </label>
      <label className={CLASSE_ROTULO}>
        Hora de início
        <input type="time" name="inicio" required className={CLASSE_CAMPO} />
      </label>
      <label className={CLASSE_ROTULO}>
        Hora de fim
        <input type="time" name="fim" required className={CLASSE_CAMPO} />
      </label>
      <div className="flex flex-col-reverse gap-2 sm:col-span-3 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onFechar}
          className="min-h-11 rounded-lg border border-zinc-300 px-5 text-base font-medium text-zinc-700 hover:bg-zinc-100 sm:text-sm dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          Cancelar
        </button>
        <button
          type="submit"
          className="min-h-11 rounded-lg bg-zinc-900 px-5 text-base font-medium text-white hover:bg-zinc-700 sm:text-sm dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Confirmar reserva
        </button>
      </div>
    </form>
  );
}
