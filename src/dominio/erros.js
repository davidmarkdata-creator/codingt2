// Erros do domínio, identificáveis pelo tipo em qualquer camada.

// Duas reservas da mesma sala sobrepõem-se. A persistência lança-o quando a
// base de dados recusa a gravação (ex.: pedidos simultâneos para o mesmo horário).
export class ErroSobreposicao extends Error {
  constructor(message = "A sala já tem uma reserva nesse horário.") {
    super(message);
    this.name = "ErroSobreposicao";
  }
}
