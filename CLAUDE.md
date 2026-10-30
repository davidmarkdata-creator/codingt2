# CLAUDE.md

## Stack e deploy
- Next.js (App Router), JavaScript, Tailwind CSS.
- Deploy: Vercel.
- Base de dados: PostgreSQL no Aiven.
- A app usa o repositório PostgreSQL (`src/persistencia/repositorioPostgres.js`), criado em `src/app/actions.js`. O repositório em memória fica só para os testes de contrato.
- Consultar a documentação do Next.js instalado (`node_modules/next/dist/docs/`) quando for necessário. O projeto tem `cacheComponents` ativo: não usar configuração de segmento como `export const dynamic`.

## Arquitetura em 4 camadas
A app está organizada em: apresentação, aplicacional, dominio e persistencia.

- `src/dominio/`, `src/aplicacional/` e `src/persistencia/` têm pasta própria.
- A apresentação são as páginas e componentes Next.js (`src/app/` e `src/components/`). Não existe `src/apresentacao/`.
- O `DeployWidget` e a route `/api/deploy` são ferramentas de desenvolvimento, fora das 4 camadas; não se alteram sem pedido.

### Regras de dependência
- O domínio não depende de nenhuma outra camada.
- A apresentação só comunica com a camada aplicacional.
  - Exceção: um único ficheiro de composição (ex.: `src/app/actions.js`) cria o repositório e entrega-o aos casos de uso. É o único sítio da apresentação que importa de `src/persistencia/`.
- As chamadas à base de dados só existem na camada `persistencia/`.

### Casos de uso e Server Actions
- Os erros de negócio (ex.: sala ocupada) devolvem-se como resultado — `{ sucesso: true, ... }` ou `{ sucesso: false, erro }` — com a mensagem em português de Portugal, e não como exceção.
- As Server Actions ficam em `src/app/actions.js` e devolvem ao browser só dados simples, nunca entidades nem `Date`. Depois de as alterar, confirmar que o código do servidor não aparece no JavaScript enviado ao browser.

## Datas e horas
- No domínio e na camada aplicacional, as datas são `Date` em UTC. Na base de dados, as datas são `TIMESTAMPTZ`.
- A conversão da hora de Lisboa faz-se só na apresentação (`src/app/horaLisboa.js`): uma hora que não existe (mudança de março) dá erro; uma hora repetida (mudança de outubro) usa a primeira ocorrência.

## Interface
- Textos da interface em português de Portugal; datas no formato dd/mm/aaaa.
- Nomes de componentes em português e PascalCase (ex.: `CartaoSala`); rotas em português e kebab-case (ex.: `/minhas-reservas`).
- Pensar primeiro no telemóvel: áreas de toque com pelo menos 44 px e campos com `text-base` em telemóvel.
- Depois de alterações visuais, verificar no browser em 375 px e em desktop, sem scroll horizontal. Antes de testes automáticos no browser, recarregar a página.

## Segurança
- As variáveis de ambiente sensíveis e respetivas credenciais de acesso (`DATABASE_URL`, etc.) nunca aparecem em código do lado do cliente.
- Nunca ler nem mostrar os valores de `.env.local`, só os nomes das variáveis.
- A ligação ao PostgreSQL é feita só por `src/persistencia/ligacao.js`: sempre cifrada e com o certificado do Aiven verificado (`DATABASE_CA_CERT`); endereços, utilizadores e palavras-passe nunca aparecem em mensagens nem em registos.
- As consultas usam sempre parâmetros, nunca valores colados no SQL.
- `DATABASE_ADMIN_URL` só existe no computador do programador, para `npm run migrar`: nunca na Vercel nem no código da app, que usa o `DATABASE_URL` (`app_reservas`).

## Testes
- A lógica de domínio, aplicacional e persistência só está concluída com testes validados. Um `npm run test` sem testes não conta como validação: cada regra de domínio e caso de uso precisa de testes próprios.
- Nessas camadas, escrever primeiro os testes e mostrá-los a falhar antes de implementar.
- Não alterar os testes somente para os fazer validar. Para alterar um teste existente por outro motivo, explicar porquê antes de o fazer.
- `npm run test` não liga à base de dados; o contrato do repositório PostgreSQL corre com `npm run test:postgres`.

## Fluxo de trabalho
- Antes de implementar, apresentar sempre um plano curto e esperar pela aprovação explícita. Os passos que o pedido indica explicitamente já contam como aprovados; decisões importantes que o pedido não tome, ou trabalho fora do âmbito, continuam a precisar de aprovação. Só se dispensa a aprovação em correções mesmo simples.
- Seguir à letra comandos, flags e formatos indicados no pedido. Se houver uma alternativa melhor, propô-la e esperar por resposta explícita.
- Não acrescentar regras, validações ou casos de teste que não tenham sido pedidos; se fizerem falta, propô-los à parte.
- Antes de instalar uma dependência, indicar qual é e para que serve.
- Avisar antes de criar ficheiros de configuração ou de ferramentas fora do pedido (ex.: `.claude/launch.json`).
- Antes de dar uma tarefa por concluída, correr `npm run test`, `npm run lint` e `npm run build`.
- Nunca terminar processos pelo nome (ex.: `taskkill /IM node.exe`); parar só os processos iniciados pelo Claude, pelo PID ou pela ferramenta que os iniciou.
- Não fazer commit nem push sem pedido explícito.
- No fim de cada tarefa, explicar o que foi feito em linguagem simples.
