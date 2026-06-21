// Imports com sufixo "?url" (Vite) resolvem pra uma string com a URL do asset.
declare module "*?url" {
  const src: string;
  export default src;
}
