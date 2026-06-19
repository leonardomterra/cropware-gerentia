import { useCallback, useEffect, useRef, useState } from "react";
import { apiGet } from "@/utils/api";

interface AttachmentUrlResponse {
  url: string;
  expires_in: number;
}

interface UseAttachmentUrlResult {
  url: string | null;
  loading: boolean;
  error: string | null;
}

/**
 * Busca o URL presigned (R2, ~5min) do anexo de um lançamento, via
 * `GET /receipts/:id/attachment-url`. Só dispara quando `enabled` (ex: dialog
 * aberto). Cacheia por id durante a vida do hook pra evitar refetch ao reabrir.
 */
export function useAttachmentUrl(
  receiptId: string | null | undefined,
  enabled: boolean,
): UseAttachmentUrlResult {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cacheRef = useRef<Map<string, string>>(new Map());
  const reqIdRef = useRef(0);

  const fetchUrl = useCallback(async (id: string) => {
    const cached = cacheRef.current.get(id);
    if (cached) {
      setUrl(cached);
      return;
    }
    const myReqId = ++reqIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet<AttachmentUrlResponse>(
        `/receipts/${id}/attachment-url`,
      );
      if (myReqId !== reqIdRef.current) return;
      cacheRef.current.set(id, data.url);
      setUrl(data.url);
    } catch (err) {
      if (myReqId !== reqIdRef.current) return;
      setError(err instanceof Error ? err.message : "Erro ao carregar arquivo.");
      setUrl(null);
    } finally {
      if (myReqId === reqIdRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled || !receiptId) {
      setUrl(null);
      setError(null);
      return;
    }
    void fetchUrl(receiptId);
  }, [enabled, receiptId, fetchUrl]);

  return { url, loading, error };
}
