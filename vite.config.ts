import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig(({ mode: _mode }) => ({
  server: {
    // Solo esta maquina. Con "::" el servidor de desarrollo escuchaba en todas
    // las interfaces: en una red ajena (café, coworking) cualquiera en el mismo
    // wifi lo alcanzaba, y las fallas conocidas del dev server de vite/esbuild
    // permiten leer archivos del proyecto desde ahí.
    // Para probar desde el teléfono en la red local: `npm run dev:lan`.
    host: "localhost",
    port: 8080,
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // Mapbox GL queda aislado en un chunk lazy propio; elevamos el umbral
    // para evitar warnings de tamano en un bundle ya controlado.
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) {
            return;
          }

          if (id.includes("recharts")) {
            return "vendor-charts";
          }

          if (id.includes("pdfjs-dist")) {
            return "vendor-pdfjs";
          }

          if (id.includes("jspdf") || id.includes("jspdf-autotable")) {
            return "vendor-jspdf";
          }

          if (id.includes("tesseract.js")) {
            return "vendor-ocr";
          }

          if (id.includes("xlsx")) {
            return "vendor-xlsx";
          }

          if (id.includes("@supabase/supabase-js")) {
            return "vendor-supabase";
          }

          if (id.includes("mapbox-gl")) {
            return "vendor-mapbox";
          }

          if (id.includes("leaflet")) {
            return "vendor-leaflet";
          }

          if (id.includes("@tanstack/react-table") || id.includes("@tanstack/react-virtual")) {
            return "vendor-tables";
          }

          if (
            id.includes("@radix-ui/") ||
            id.includes("cmdk") ||
            id.includes("embla-carousel-react") ||
            id.includes("react-day-picker") ||
            id.includes("vaul")
          ) {
            return "vendor-ui";
          }
        },
      },
    },
  },
}));
