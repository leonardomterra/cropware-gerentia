"use client";

import { Toaster as Sonner, ToasterProps } from "sonner";

const Toaster = ({ ...props }: ToasterProps) => {
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  return (
    <Sonner
      theme="light"
      className="toaster group"
      position={isMobile ? 'bottom-center' : 'top-right'}
      expand={true}
      toastOptions={{
        style: {
          fontWeight: 400,
          fontSize: '14px',
          padding: '16px 20px',
          maxWidth: 'calc(100vw - 2rem)',
        },
      }}
      {...props}
    />
  );
};

export { Toaster };