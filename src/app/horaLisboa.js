const FUSO = "Europe/Lisbon";
const ERRO_MUDANCA_HORA = "Hora inválida em Lisboa (mudança de hora).";
const ERRO_FORMATO = "Data ou hora inválida.";

// Diferenças possíveis de Lisboa para UTC, em minutos. A de verão vem primeiro
// para que, na hora repetida de outubro, se use a primeira ocorrência.
const DESVIOS_MINUTOS = [60, 0];

const formatador = new Intl.DateTimeFormat("en-GB", {
  timeZone: FUSO,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

// Data e hora de parede em Lisboa para um instante UTC, no formato "AAAA-MM-DD HH:MM".
function emLisboa(instante) {
  const p = Object.fromEntries(
    formatador.formatToParts(instante).map(({ type, value }) => [type, value])
  );
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`;
}

/**
 * Converte uma data ("AAAA-MM-DD") e uma hora ("HH:MM") de Lisboa num Date em UTC.
 * Na mudança de hora de março (hora que não existe) lança erro; na de outubro
 * (hora repetida) usa a primeira ocorrência, ainda em horário de verão.
 */
export function lisboaParaUtc(data, hora) {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(data ?? "");
  const h = /^(\d{2}):(\d{2})$/.exec(hora ?? "");
  if (!d || !h) throw new Error(ERRO_FORMATO);

  const [ano, mes, dia] = d.slice(1).map(Number);
  const [horas, minutos] = h.slice(1).map(Number);
  if (horas > 23 || minutos > 59) throw new Error(ERRO_FORMATO);

  // Mesmos números lidos como se fossem UTC; serve também para validar o calendário.
  const comoUtc = new Date(Date.UTC(ano, mes - 1, dia, horas, minutos));
  if (
    comoUtc.getUTCFullYear() !== ano ||
    comoUtc.getUTCMonth() !== mes - 1 ||
    comoUtc.getUTCDate() !== dia
  ) {
    throw new Error(ERRO_FORMATO);
  }

  const pedido = `${data} ${hora}`;
  for (const desvio of DESVIOS_MINUTOS) {
    const candidato = new Date(comoUtc.getTime() - desvio * 60_000);
    if (emLisboa(candidato) === pedido) return candidato;
  }
  throw new Error(ERRO_MUDANCA_HORA);
}
