import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";
import Icons from "unplugin-icons/vite";
import path from "path";

export default defineConfig({
  // Icons (unplugin-icons): icones offline tree-shaken via `~icons/<set>/<nome>`.
  // Sets instalados: ph (Phosphor - a familia da interface, com os pesos
  // regular/fill/duotone/bold/light disponiveis como nomes proprios, ex.
  // `~icons/ph/trash-duotone`), line-md + svg-spinners (animados/loaders).
  // Compila cada icone como componente React no build.
  //
  // `scale: 1.2` define so' o width/height INTRINSECO (1.2em) - vale quando o
  // uso nao passa `size-*`. Qualquer classe de tamanho ganha dele por CSS.
  // O aumento extra de 10% que existia no app.css saiu com o material-symbols;
  // ver o comentario la'.
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
    // A porta vem do ambiente quando houver: rodando vários projetos da
    // Cropware ao mesmo tempo, a 3000 costuma estar tomada por outro, e um
    // servidor que se recusa a subir é pior do que um que sobe noutra porta.
    port: Number(process.env.PORT) || 3000,
    open: true,
  },
});
