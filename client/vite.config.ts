import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// In development the client proxies /api to the Express server so the session cookie is first-party.
// VITE_API_PROXY lets the end-to-end suite point the client at its own API port.
const API_TARGET = process.env.VITE_API_PROXY ?? "http://localhost:3000";

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: { "/api": API_TARGET } },
});
