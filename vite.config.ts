import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      // Maps imports starting with '@common' or 'common' to your shared folder
      '@common': path.resolve(__dirname, 'applications/common'),
      // Or if you reference it directly:
      // 'common': path.resolve(__dirname, '../../common/src')
    }
  }
});