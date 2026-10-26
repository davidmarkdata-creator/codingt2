"use client";

import { useActionState } from "react";
import { reservarSalaAction } from "../app/actions";

const CLASSE_ROTULO =
  "flex flex-col gap-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300";
// text-base em telemóvel evita o zoom automático do iOS ao focar o campo.
const CLASSE_CAMPO =
  "min-h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 text-base text-zinc-900 focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/20 sm:text-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:focus:border-zinc-300 dark:focus:ring-zinc-300/20";

const ESTADO_INICIAL = { sucesso: null, erro: null, valores: {} };

// A reserva é feita no servidor (Server Action); com sucesso, o formulário fecha.
export default function FormularioReserva({ salaId, nomeSala, onFechar }) {
  const [estado, submeter, aEnviar] = useActionState(
    async (estadoAnterior, formData) => {
      const resultado = await reservarSalaAction(estadoAnterior, formData);
      if (resultado.sucesso) onFechar();
      // O React limpa o formulário depois da ação: guardar o que foi escrito
      // para o voltar a mostrar junto com o erro.
      const valores = {
        data: formData.get("data"),
        inicio: formData.get("inicio"),
        fim: formData.get("fim"),
      };
      return { ...resultado, valores };
    },
    ESTADO_INICIAL
  );

  return (
    <form
      action={submeter}
      aria-label={`Reservar ${nomeSala}`}
      className="mt-4 grid gap-4 border-t border-zinc-200 pt-4 sm:grid-cols-3 dark:border-zinc-800"
    >
      <input type="hidden" name="salaId" value={salaId} />
      <label className={CLASSE_ROTULO}>
        Data da reserva
        <input
          type="date"
          name="data"
          required
          defaultValue={estado.valores?.data}
          className={CLASSE_CAMPO}
        />
      </label>
      <label className={CLASSE_ROTULO}>
        Hora de início
        <input
          type="time"
          name="inicio"
          required
          defaultValue={estado.valores?.inicio}
          className={CLASSE_CAMPO}
        />
      </label>
      <label className={CLASSE_ROTULO}>
        Hora de fim
        <input
          type="time"
          name="fim"
          required
          defaultValue={estado.valores?.fim}
          className={CLASSE_CAMPO}
        />
      </label>
      {estado.erro && (
        <p
          role="alert"
          className="rounded-lg bg-red-50 px-3 py-2 text-base text-red-700 sm:col-span-3 sm:text-sm dark:bg-red-950/50 dark:text-red-300"
        >
          {estado.erro}
        </p>
      )}
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
          disabled={aEnviar}
          className="min-h-11 rounded-lg bg-zinc-900 px-5 text-base font-medium text-white hover:bg-zinc-700 disabled:opacity-60 sm:text-sm dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {aEnviar ? "A reservar…" : "Confirmar reserva"}
        </button>
      </div>
    </form>
  );
}
