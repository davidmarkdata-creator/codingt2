# CLAUDE.md

## Stack e deploy
- Next.js (App Router), JavaScript, Tailwind CSS.
- Deploy: Vercel.
- Base de dados: PostgreSQL no Aiven.

## Arquitetura em 4 camadas
A app está organizada em: apresentação, aplicacional, dominio e persistencia.

- `src/dominio/`, `src/aplicacional/` e `src/persistencia/` têm pasta própria.
- A apresentação são as páginas e componentes Next.js (`src/app/` e `src/components/`). Não existe `src/apresentacao/`.

### Regras de dependência
- O domínio não depende de nenhuma outra camada.
- A apresentação só comunica com a camada aplicacional.
  - Exceção: um único ficheiro de composição (ex.: `src/app/actions.js`) cria o repositório e entrega-o aos casos de uso. É o único sítio da apresentação que importa de `src/persistencia/`.
- As chamadas à base de dados só existem na camada `persistencia/`.

## Segurança
- As variáveis de ambiente sensíveis e respetivas credenciais de acesso (`DATABASE_URL`, etc.) nunca aparecem em código do lado do cliente.

## Testes
- A lógica de domínio, aplicacional e persistência só está concluída com testes validados.
- Não alterar os testes somente para os fazer validar.

## Fluxo de trabalho
- Antes de instalar uma dependência, indicar qual é e para que serve.
- Antes de implementar, apresentar sempre um plano curto.
- Antes de dar uma tarefa por concluída, correr `npm run test`, `npm run lint` e `npm run build`.
- No fim de cada tarefa, explicar o que foi feito em linguagem simples.
