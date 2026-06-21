import { useState } from "react";
import {
  ErrorFallback,
  errorIdFor,
  errorDetails,
} from "@/components/ErrorBoundary";

/**
 * DEV-only: pré-visualiza a tela de erro (ErrorFallback) sem precisar quebrar o
 * app. Acesse por /erro. Usa um erro de exemplo (mesmo do print: ReferenceError).
 */
export default function ErrorTestPage() {
  const [copied, setCopied] = useState(false);
  const error = new ReferenceError("activeFilters is not defined");
  const errorId = errorIdFor(error);

  return (
    <ErrorFallback
      error={error}
      errorId={errorId}
      copied={copied}
      onCopy={() => {
        navigator.clipboard
          .writeText(errorDetails(error, errorId))
          .then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          })
          .catch(() => {});
      }}
      onHome={() => {}}
      onReload={() => {}}
    />
  );
}
