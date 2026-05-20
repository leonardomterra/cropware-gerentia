import { createContext, useContext, type ReactNode } from 'react';

/**
 * Sinaliza pra dropdowns/popovers/selects que eles estão renderizados dentro
 * de um modal (Dialog, Sheet, Drawer, AlertDialog). Eles consultam esse contexto
 * pra elevar o z-index acima do overlay do modal (z-[2000]).
 *
 * Fora de modal, o default `z-[999]` continua valendo — o que mantém o
 * `collisionPadding` do header funcionando em listagens normais.
 *
 * React Context atravessa Portal (garantia do React), então mesmo que o
 * conteúdo do popover renderize em outro Portal, ele enxerga o Provider.
 */
const ModalScopeContext = createContext(false);

export function ModalScopeProvider({ children }: { children: ReactNode }) {
  return (
    <ModalScopeContext.Provider value={true}>
      {children}
    </ModalScopeContext.Provider>
  );
}

export function useIsInsideModal(): boolean {
  return useContext(ModalScopeContext);
}
