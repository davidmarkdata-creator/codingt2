import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Reserva } from "../dominio/reserva";

// Testes de contrato do repositório: qualquer implementação (memória,
// PostgreSQL...) tem de os cumprir. Só é importado por ficheiros de teste.
//
// `preparar()` devolve { repositorio, salas: [salaA, salaB], limpar(ids) }:
// - `salas` são duas salas que já existem no repositório;
// - `limpar(ids)` apaga as reservas criadas pelo teste; é chamado no fim de
//   cada teste, mesmo quando o teste falha.
//
// As verificações não dependem de outros dados que o repositório já tenha
// (procuram "contém", não "é igual"), nem do tipo dos ids (número ou UUID).

// Instantes com milissegundos e à volta das mudanças de hora em Lisboa
// (29/03/2026 e 25/10/2026, às 01:00 UTC): servem para apanhar desvios de fuso.
const INSTANTES = [
  "2026-01-15T10:00:00.123Z", // inverno
  "2026-07-15T09:00:00.456Z", // verão
  "2026-03-29T00:30:00.000Z", // antes da mudança de março
  "2026-03-29T01:00:00.000Z", // no instante da mudança de março
  "2026-03-29T01:30:00.000Z", // depois da mudança de março
  "2026-10-25T00:30:00.000Z", // antes da mudança de outubro
  "2026-10-25T01:00:00.000Z", // no instante da mudança de outubro
  "2026-10-25T01:30:00.000Z", // depois da mudança de outubro
];

const MEIA_HORA_MS = 30 * 60 * 1000;

export function descreverContratoRepositorio(nome, preparar) {
  describe(`contrato do repositório: ${nome}`, () => {
    let contexto;
    let guardadas;

    beforeEach(async () => {
      guardadas = [];
      contexto = await preparar();
    });

    afterEach(async () => {
      await contexto?.limpar(guardadas.map((reserva) => reserva.id));
    });

    async function guardar(salaId, inicio, fim) {
      const guardada = await contexto.repositorio.guardarReserva(
        new Reserva({ salaId, inicio, fim })
      );
      guardadas.push(guardada);
      return guardada;
    }

    async function lerPorId(id) {
      const todas = await contexto.repositorio.listarReservas();
      return todas.find((reserva) => reserva.id === id);
    }

    it("guarda uma reserva e volta a lê-la", async () => {
      const [sala] = contexto.salas;
      const inicio = new Date("2026-11-03T10:00:00.000Z");
      const fim = new Date("2026-11-03T11:00:00.000Z");

      const primeira = await guardar(sala.id, inicio, fim);
      const segunda = await guardar(sala.id, inicio, fim);

      expect(primeira.id).toBeDefined();
      expect(primeira.id).not.toBeNull();
      expect(segunda.id).not.toEqual(primeira.id);

      const lida = await lerPorId(primeira.id);
      expect(lida).toBeDefined();
      expect(lida.salaId).toEqual(sala.id);
      expect(lida.inicio.getTime()).toBe(inicio.getTime());
      expect(lida.fim.getTime()).toBe(fim.getTime());
    });

    it("lista as salas", async () => {
      const salas = await contexto.repositorio.listarSalas();

      for (const esperada of contexto.salas) {
        const encontrada = salas.find((sala) => sala.id === esperada.id);
        expect(encontrada, `sala ${esperada.nome}`).toBeDefined();
        expect(encontrada.nome).toBe(esperada.nome);
        expect(encontrada.capacidade).toBe(esperada.capacidade);
      }
    });

    it("lista as reservas de uma sala, sem as de outras salas", async () => {
      const [salaA, salaB] = contexto.salas;
      const inicio = new Date("2026-11-04T10:00:00.000Z");
      const fim = new Date("2026-11-04T11:00:00.000Z");

      const daSalaA = await guardar(salaA.id, inicio, fim);
      const daSalaB = await guardar(salaB.id, inicio, fim);

      const lista = await contexto.repositorio.listarReservasDaSala(salaA.id);
      const ids = lista.map((reserva) => reserva.id);

      expect(ids).toContain(daSalaA.id);
      expect(ids).not.toContain(daSalaB.id);
      for (const reserva of lista) expect(reserva.salaId).toEqual(salaA.id);
    });

    it("lê exatamente a hora guardada, sem desvios de fuso horário", async () => {
      const [sala] = contexto.salas;

      for (const texto of INSTANTES) {
        const inicio = new Date(texto);
        const fim = new Date(inicio.getTime() + MEIA_HORA_MS + 789);
        const guardada = await guardar(sala.id, inicio, fim);

        const lidaDeTodas = await lerPorId(guardada.id);
        const lidaDaSala = (await contexto.repositorio.listarReservasDaSala(sala.id)).find(
          (reserva) => reserva.id === guardada.id
        );

        for (const lida of [lidaDeTodas, lidaDaSala]) {
          expect(lida, texto).toBeDefined();
          expect(lida.inicio, texto).toBeInstanceOf(Date);
          expect(lida.fim, texto).toBeInstanceOf(Date);
          expect(lida.inicio.toISOString(), texto).toBe(inicio.toISOString());
          expect(lida.fim.toISOString(), texto).toBe(fim.toISOString());
        }
      }
    });
  });
}
