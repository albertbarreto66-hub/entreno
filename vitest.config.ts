import { defineConfig } from 'vitest/config';
export default defineConfig({
  define: { __APP_VERSION__: '"test"', __PERFIL__: 'null', __BUILD_TIME__: '"test"' },
  test: { environment: 'node', setupFiles: ['tests/setup.ts'], include: ['tests/**/*.test.ts'], env: { TZ: 'UTC' } },
});
