import { defineConfig } from "vitest/config";

// Os testes leem o .env.local, como `npm run migrar` e `npm run verificar-ligacao`.
// Não substitui variáveis já definidas. Sem .env.local (ex.: CI), segue sem ele.
try {
  process.loadEnvFile(".env.local");
} catch {
  // sem .env.local: os testes que precisam dele são saltados ou falham com mensagem clara
}

export default defineConfig({});
