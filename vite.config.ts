import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-charts": ["recharts"],
          "vendor-pdf": ["jspdf", "jspdf-autotable", "pdfjs-dist"],
          "vendor-ocr": ["tesseract.js"],
          "vendor-xlsx": ["xlsx"],
          "vendor-supabase": ["@supabase/supabase-js"],
        },
      },
    },
  },
}));
