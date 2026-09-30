import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  server: {
    port: 5173,
    host: true,
    strictPort: true,
    watch: {
      usePolling: true,
      interval: 500,
    },
    hmr: {
      host: "localhost",
      port: 5173,
      clientPort: 5173, // browser ko batata hai ki HMR websocket localhost:5173 pe connect kare, container ke internal address pe nahi
    },
  },
});