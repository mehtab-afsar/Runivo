import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@features': path.resolve(__dirname, './src/features'),
      // Cross-platform shared logic (in packages/shared)
      '@shared/services': path.resolve(__dirname, '../../packages/shared/src/services'),
      '@shared/hooks': path.resolve(__dirname, '../../packages/shared/src/hooks'),
      '@shared/types': path.resolve(__dirname, '../../packages/shared/src/types'),
      '@shared/lib': path.resolve(__dirname, '../../packages/shared/src/lib'),
      // Web-only shared (design-system, ui, layout, audio, etc.)
      '@shared': path.resolve(__dirname, './src/shared'),
    },
  },
  server: {
    port: 3004,
    strictPort: true,
  },
  build: {
    target: 'es2020',
    rollupOptions: {
      output: {
        manualChunks: {
          'maplibre': ['maplibre-gl'],
          'h3': ['h3-js'],
          'motion': ['framer-motion'],
          'vendor': ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
    chunkSizeWarningLimit: 600,
    sourcemap: false,
  },
});
