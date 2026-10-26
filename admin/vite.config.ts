import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Keep local Admin testing pointed at the hosted staging API without
      // requiring the staging backend to allow arbitrary localhost origins.
      "/api": {
        target: process.env.VITE_PROXY_TARGET || "https://gagan-srat.onrender.com",
        changeOrigin: true,
        secure: !(process.env.VITE_PROXY_TARGET && process.env.VITE_PROXY_TARGET.startsWith("http://")),
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
    environmentOptions: {
      jsdom: { url: "http://localhost/" },
    },
  },
});
