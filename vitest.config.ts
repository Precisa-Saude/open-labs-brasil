import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['comum/**/*.test.ts', 'servidor-de-exemplo/**/*.test.ts', 'suite-de-conformidade/**/*.test.ts', 'ambiente-local/**/*.test.ts'],
    // Os testes sobem o servidor de exemplo nas portas fixas do ambiente local.
    fileParallelism: false,
    testTimeout: 180_000,
    hookTimeout: 180_000,
  },
});
