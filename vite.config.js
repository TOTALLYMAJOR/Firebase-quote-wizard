import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    include: ["src/**/*.{test,spec}.{js,jsx,mjs,cjs,ts,tsx}"],
    exclude: ["e2e/**", "node_modules/**", "dist/**"]
  }
});
