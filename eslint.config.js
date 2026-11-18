import base from '@precisa-saude/eslint-config/base';

export default [
  ...base,
  {
    // Gerados pelo ambiente local e pela suíte, fora do controle de versão.
    ignores: ['ambiente-local/gerado/**', 'relatorios/**', 'site/dist/**'],
  },
  {
    // Test files are excluded from package tsconfigs (to keep tsc --noEmit
    // tight), so disable type-aware parsing for them or ESLint errors
    // trying to locate a project.
    files: ['**/*.test.ts', '**/*.test.tsx', '**/*.spec.ts', '**/*.spec.tsx', '**/__tests__/**'],
    languageOptions: {
      parserOptions: { project: false },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'off',
      'max-lines': 'off',
      'max-lines-per-function': 'off',
    },
  },
  {
    // Programas de linha de comando e o log do servidor de exemplo: a saída no
    // terminal é o produto deles.
    files: [
      'ambiente-local/demonstracao.ts',
      'ambiente-local/gerar.ts',
      'ferramentas/*.ts',
      'servidor-de-exemplo/principal.ts',
      'servidor-de-exemplo/servidor.ts',
      'suite-de-conformidade/local.ts',
      'suite-de-conformidade/principal.ts',
      'suite-de-conformidade/receptor-minimo/jornada.ts',
    ],
    rules: { 'no-console': 'off' },
  },
  {
    // Arquivos que já passavam de 400 linhas, na largura de 100 colunas, quando as
    // ferramentas compartilhadas foram adotadas. Dividi-los é trabalho à parte;
    // arquivos novos seguem o limite.
    files: [
      'ambiente-local/gerar.ts',
      'servidor-de-exemplo/agendamento.ts',
      'servidor-de-exemplo/autorizacao.ts',
      'servidor-de-exemplo/dados.ts',
      'servidor-de-exemplo/fhir.ts',
      'suite-de-conformidade/contexto.ts',
      'suite-de-conformidade/receptor-minimo/receptor.ts',
      'suite-de-conformidade/requisitos/agendamento.ts',
      'suite-de-conformidade/requisitos/api.ts',
      'suite-de-conformidade/requisitos/autorizacao.ts',
      'suite-de-conformidade/requisitos/catalogo-e-agenda.ts',
      'suite-de-conformidade/requisitos/consentimento.ts',
      'suite-de-conformidade/requisitos/registro.ts',
      'suite-de-conformidade/requisitos/resultados-e-erros.ts',
    ],
    rules: { 'max-lines': 'off' },
  },
];
