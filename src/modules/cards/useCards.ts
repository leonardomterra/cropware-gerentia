import { useCallback, useEffect, useState } from "react";
import { api } from "@/utils/api";
import type { Card } from "./types";

/**
 * Cartões da organização que a RLS deixa a pessoa ver.
 *
 * Usado no filtro de faturas, no seletor do formulário de lançamento e no
 * gerenciador. O recorte (o próprio vê o dele, o gestor vê todos) é decidido no
 * banco — aqui só consumimos.
 */
export function useCards() {
  const [cards, setCards] = useState<Card[]>([]);
  const [meuId, setMeuId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const recarregar = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api<{ cards: Card[]; meu_user_id: string | null }>(
        "/cards",
      );
      setCards(r.cards ?? []);
      setMeuId(r.meu_user_id);
    } catch {
      // Silencioso: sem cartão o app inteiro segue funcionando — o seletor
      // simplesmente não aparece. Derrubar a tela de lançamentos por causa
      // disso seria desproporcional.
      setCards([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  return { cards, meuId, loading, recarregar };
}

/** "Nubank Leonardo (•••• 4821)" — como o cartão se identifica num seletor. */
export function rotuloDoCartao(c: Card): string {
  return c.ultimos_digitos ? `${c.nome} (•••• ${c.ultimos_digitos})` : c.nome;
}
