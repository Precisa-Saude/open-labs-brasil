import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react/jsx-runtime'],
        },
      },
    },
  },
  plugins: [tailwindcss(), react()],
  server: {
    // O site do fhir-brasil usa 4321.
    port: 4322,
  },
});
