"use client";

import { useActionState } from "react";
import { cancelarReservaAction } from "../app/actions";

const ESTADO_INICIAL = { sucesso: null, erro: null };

// Pede confirmação e cancela a reserva no servidor (que volta a verificar se é futura).
export default function BotaoCancelarReserva({ reservaId, descricao }) {
  const [estado, submeter, aCancelar] = useActionState(cancelarReservaAction, ESTADO_INICIAL);

  function confirmar(evento) {
    if (!window.confirm(`Cancelar a reserva ${descricao}?`)) evento.preventDefault();
  }

  return (
    <form action={submeter} className="flex w-full flex-col gap-2 sm:w-auto sm:items-end">
      <input type="hidden" name="reservaId" value={reservaId} />
      <button
        type="submit"
        onClick={confirmar}
        disabled={aCancelar}
        className="min-h-11 w-full rounded-lg border border-zinc-300 px-5 text-base font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-60 sm:w-auto sm:text-sm dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
      >
        {aCancelar ? "A cancelar…" : "Cancelar"}
      </button>
      {estado.erro && (
        <p
          role="alert"
          className="rounded-lg bg-red-50 px-3 py-2 text-base text-red-700 sm:text-sm dark:bg-red-950/50 dark:text-red-300"
        >
          {estado.erro}
        </p>
      )}
    </form>
  );
}
