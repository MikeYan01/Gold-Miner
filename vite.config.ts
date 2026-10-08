import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig(({ command, isPreview }) => ({
  plugins: [react()],
  base: command === 'serve' && !isPreview ? '/' : '/Gold-Miner/',
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
}));
