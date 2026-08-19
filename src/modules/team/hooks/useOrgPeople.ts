import { useEffect, useState } from "react";
import { api } from "@/utils/api";
import { useAuth } from "@/contexts/AuthContext";

interface Person {
  user_id: string;
  full_name: string | null;
}

interface PeopleMap {
  /** Quem está na organização hoje. */
  current: Record<string, string>;
  /** Quem saiu — o lançamento fica, então o nome ainda precisa aparecer. */
  former: Record<string, string>;
}

const EMPTY: PeopleMap = { current: {}, former: {} };

/**
 * Nomes das pessoas da organização, pra lista/detalhe mostrarem "Lançado por".
 * Só busca pra quem enxerga a organização inteira (gestor e convidado); pro
 * usuário comum tudo que aparece é dele, então o rótulo nem existe.
 *
 * O cache é por SESSÃO (`user.id` + organização), e não global: o signOut do app
 * não recarrega a página, só limpa o estado do React — sem a chave, trocar de
 * conta (ou usar o "Login como" do Master) reaproveitava o mapa do usuário
 * anterior. Resultado vazio ou falha NÃO viram cache, senão um erro de rede
 * congelava a lista sem nomes até dar F5.
 */
let cache: { key: string; map: PeopleMap } | null = null;
let inflight: { key: string; promise: Promise<PeopleMap> } | null = null;

function indexBy(rows: Person[] | undefined): Record<string, string> {
  const map: Record<string, string> = {};
  for (const p of rows ?? []) {
    if (p.full_name) map[p.user_id] = p.full_name;
  }
  return map;
}

async function fetchPeople(key: string): Promise<PeopleMap> {
  if (cache?.key === key) return cache.map;
  if (inflight?.key !== key) {
    const promise = api<{ people: Person[]; former?: Person[] }>("/members/names")
      .then((r) => {
        const map: PeopleMap = {
          current: indexBy(r.people),
          former: indexBy(r.former),
        };
        // Vazio não vira cache: pode ser resposta de uma sessão sem permissão.
        if (Object.keys(map.current).length > 0) cache = { key, map };
        return map;
      })
      .catch(() => EMPTY)
      .finally(() => {
        if (inflight?.key === key) inflight = null;
      });
    inflight = { key, promise };
  }
  return inflight.promise;
}

/** Limpa o cache — usar depois de mexer na equipe. */
export function invalidateOrgPeople() {
  cache = null;
  inflight = null;
}

export function useOrgPeople(): {
  /** Nome de quem lançou, ou null quando o rótulo não deve aparecer. */
  nameOf: (userId: string | null | undefined) => string | null;
  enabled: boolean;
} {
  const { user, canReadAll } = useAuth();
  const key = user ? `${user.id}:${user.organizationId}` : "";
  const [people, setPeople] = useState<PeopleMap>(
    cache?.key === key ? cache.map : EMPTY,
  );

  useEffect(() => {
    if (!canReadAll || !key) return;
    let alive = true;
    void fetchPeople(key).then((map) => {
      if (alive) setPeople(map);
    });
    return () => {
      alive = false;
    };
  }, [canReadAll, key]);

  return {
    enabled: canReadAll,
    nameOf: (userId) => {
      if (!userId || !canReadAll) return null;
      if (userId === user?.id) return null; // o próprio: não precisa de rótulo
      if (people.current[userId]) return people.current[userId];
      const gone = people.former[userId];
      if (gone) return `${gone} (removido)`;
      // Nome desconhecido: não dá pra AFIRMAR que a pessoa saiu — some o rótulo
      // em vez de acusar remoção de quem talvez esteja na organização.
      return null;
    },
  };
}
