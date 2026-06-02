import { useState } from "react";
import { api } from "@/utils/api";

export interface ReceiptLineItem {
  description: string | null;
  quantity: number | null;
  unit_value: number | null;
  total_value: number;
  category: string;
}

export interface ReceiptExtraction {
  vendor: string | null;
  vendor_cnpj: string | null;
  total_value: number | null;
  transaction_date: string | null;
  doc_type:
    | "cupom"
    | "nota_fiscal"
    | "recibo"
    | "pix"
    | "boleto"
    | "outro";
  payment_method:
    | "pix"
    | "cartao"
    | "boleto"
    | "dinheiro"
    | "transferencia"
    | null;
  invoice_number: string | null;
  category: string;
  description: string | null;
  direction: "expense" | "income";
  confidence: number;
  line_items?: ReceiptLineItem[];
}

export interface ScanResult {
  attachment_key: string;
  attachment_mime: string;
  extracted: ReceiptExtraction | null;
  scan_error?: string;
}

interface ScanResponse {
  ok: true;
  attachment_key: string;
  attachment_mime: string;
  extracted: ReceiptExtraction | null;
  scan_error?: string;
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("FileReader returned non-string"));
        return;
      }
      // Result e' "data:image/...;base64,<base64>"
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function useReceiptScanner() {
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scan = async (file: File): Promise<ScanResult | null> => {
    if (file.size > 10 * 1024 * 1024) {
      setError("Imagem maior que 10MB. Reduza e tente de novo.");
      return null;
    }

    setScanning(true);
    setError(null);
    try {
      const base64 = await fileToBase64(file);
      const data = await api<ScanResponse>("/receipts/scan", {
        method: "POST",
        body: {
          image_base64: base64,
          mime_type: file.type || "image/jpeg",
        },
      });
      return {
        attachment_key: data.attachment_key,
        attachment_mime: data.attachment_mime,
        extracted: data.extracted,
        scan_error: data.scan_error,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao processar.";
      setError(msg);
      return null;
    } finally {
      setScanning(false);
    }
  };

  return { scan, scanning, error };
}
