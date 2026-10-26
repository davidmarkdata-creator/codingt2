"use client";

import { useState } from "react";
import FormularioReserva from "./FormularioReserva";

export default function CartaoSala({ id, nome, capacidade }) {
  const [aReservar, setAReservar] = useState(false);

  return (
    <li
      className={`rounded-xl border bg-white p-4 shadow-sm transition-colors sm:p-5 dark:bg-zinc-900 ${
        aReservar
          ? "border-zinc-400 dark:border-zinc-600"
          : "border-zinc-200 dark:border-zinc-800"
      }`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            {nome}
          </h2>
          <p className="mt-1 inline-flex items-center rounded-full bg-zinc-100 px-2.5 py-0.5 text-sm text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
            Capacidade: {capacidade} pessoas
          </p>
        </div>
        {!aReservar && (
          <button
            type="button"
            onClick={() => setAReservar(true)}
            className="min-h-11 w-full rounded-lg bg-zinc-900 px-5 text-base font-medium text-white hover:bg-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 sm:w-auto sm:text-sm dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200 dark:focus-visible:outline-zinc-50"
          >
            Reservar
          </button>
        )}
      </div>
      {aReservar && (
        <FormularioReserva
          salaId={id}
          nomeSala={nome}
          onFechar={() => setAReservar(false)}
        />
      )}
    </li>
  );
}
