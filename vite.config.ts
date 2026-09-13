import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    // Overridable via `PORT=xxxx npm run dev`; defaults to 3005 (3000 is
    // commonly taken by other local tools).
    port: Number(process.env.PORT) || 3005,
    strictPort: true,
    host: true,
    proxy: {
      // Same-origin path to the API so browsers that block cross-origin
      // XHR (e.g. the Claude desktop built-in browser pane) still work.
      // The app calls `/api/...` on its own origin; Vite forwards to 8005.
      "/api": {
        target: process.env.VITE_PROXY_TARGET || "http://127.0.0.1:8005",
        changeOrigin: true,
      },
    },
  },
});