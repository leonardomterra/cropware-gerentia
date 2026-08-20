"use client";

import { Toaster as Sonner, ToasterProps } from "sonner";

const Toaster = ({ ...props }: ToasterProps) => {
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
  return (
    <Sonner
      theme="light"
      className="toaster group"
      position={isMobile ? "bottom-center" : "top-right"}
      expand={true}
      // richColors: sucesso/erro/aviso ganham fundo e borda na cor do estado,
      // em vez de todos brancos e iguais. Sem isso, "salvo" e "falhou ao
      // salvar" se distinguiam só pelo texto — e toast é o que se lê de canto
      // de olho, não o que se lê.
      richColors
      // O X existe porque toast some sozinho: com uma mensagem longa, ou com
      // vários empilhados, a pessoa perde a leitura e não tem como segurar nem
      // dispensar o que já leu.
      closeButton
      toastOptions={{
        style: {
          fontWeight: 400,
          fontSize: "14px",
          padding: "16px 20px",
          maxWidth: "calc(100vw - 2rem)",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
