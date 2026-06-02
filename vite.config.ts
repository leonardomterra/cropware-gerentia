import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";
import Icons from "unplugin-icons/vite";
import path from "path";

export default defineConfig({
  // Icons (unplugin-icons): icones offline tree-shaken via `~icons/<set>/<nome>`.
  // Sets instalados: material-symbols-light (estaticos), line-md + svg-spinners
  // (animados/loaders). Compila cada icone como componente React no build.
  // `scale: 1.2` (default do unplugin, fixado explicito) faz todo icone sair com
  // width/height="1.2em". O app.css usa `svg[width="1.2em"]` pra dar um leve
  // aumento neles (material-symbols tem mais padding que o lucide e parecia menor
  // no mesmo box) - discrimina do lucide (width="24") e do recharts (px). Se
  // mudar este scale, atualizar o seletor no app.css.
  plugins: [
    tailwindcss(),
    react(),
    Icons({ compiler: "jsx", jsx: "react", scale: 1.2 }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  esbuild: {
    drop: ["debugger"],
    pure: ["console.log", "console.debug", "console.info"],
  },
  build: {
    target: "esnext",
    outDir: "build",
  },
  server: {
    port: 3000,
    open: true,
  },
});
