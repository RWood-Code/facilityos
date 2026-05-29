import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const isCloudBuild = Boolean(process.env.VITE_CLOUD_RELAY_URL);

function cloudPwaPlugin() {
  return {
    name: 'facilityos-cloud-pwa',
    transformIndexHtml(html) {
      if (!isCloudBuild) return html;
      return html
        .replace('./manifest.webmanifest', './manifest.cloud.webmanifest')
        .replace('<title>FacilityOS</title>', '<title>FacilityOS Cloud</title>')
        .replace('content="FacilityOS"', 'content="FacilityOS Cloud"');
    },
  };
}

export default defineConfig({
  plugins: [react(), cloudPwaPlugin()],
  base: './',
  build: { outDir: 'dist' },
  define: {
    __CLOUD_BUILD__: JSON.stringify(isCloudBuild),
  },
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': { target: 'http://127.0.0.1:3847', changeOrigin: true },
    },
  },
});
