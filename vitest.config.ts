import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Os testes sobem o servidor de exemplo nas portas fixas do ambiente local.
    fileParallelism: false,
    hookTimeout: 180_000,
    include: [
      'comum/**/*.test.ts',
      'servidor-de-exemplo/**/*.test.ts',
      'suite-de-conformidade/**/*.test.ts',
      'ambiente-local/**/*.test.ts',
    ],
    testTimeout: 180_000,
  },
});
