import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: process.env.GITHUB_REPOSITORY ? `/${process.env.GITHUB_REPOSITORY.split("/")[1]}/` : "/",
  server: {
    host: true,
    allowedHosts: true,
    strictPort: false,
    proxy: { "/api": { target: "http://127.0.0.1:7071", changeOrigin: true } },
  },
});
