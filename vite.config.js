import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { normalizeBasePath } from "./shared/paths.js";
export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), ""), ...process.env };
  const basePath = normalizeBasePath(env.APP_BASE_PATH);
  return {
    base: basePath + "/",
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        [basePath + "/api"]: {
          target: env.API_PROXY_TARGET || "http://127.0.0.1:3001",
          changeOrigin: false,
        },
      },
    },
  };
});
