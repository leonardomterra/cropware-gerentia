// Supabase project info - V1 piloto compartilhado com Cropware Studio.
// Ver memoria do projeto: project_farm_supabase.md
//
// O anon key e' publico por design (assinado JWT com role=anon, security via RLS).
// Quando Farm graduar pra projeto dedicado, atualizar projectId + anonKey aqui.

export const projectId = "tzsmxhwvtobwkqffgsxo";
export const anonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR6c214aHd2dG9id2txZmZnc3hvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMyMTg3ODIsImV4cCI6MjA3ODc5NDc4Mn0.VQjoMrKXIyqRwVgJe_ttvu7SsXYD4YZF28bm4RC3TIA";
export const supabaseUrl = `https://${projectId}.supabase.co`;
