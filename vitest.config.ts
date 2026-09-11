import { defineConfig } from 'vitest/config';
import path from 'node:path';

// Config mínima: tests de lógica pura corren en Node (no hace falta jsdom).
// Alias '@/*' espejado del tsconfig para poder testear módulos que importan
// con ese prefijo sin arrastrar el resto del toolchain de Next.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
