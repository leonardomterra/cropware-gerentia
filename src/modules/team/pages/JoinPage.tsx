import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Building2 from "~icons/material-symbols-light/apartment";
import AlertTriangle from "~icons/material-symbols-light/warning-outline";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Logo, LogoName } from "@/components/Logo";
import { supabase } from "@/utils/supabase/client";
import { api, ApiError } from "@/utils/api";
import type { InviteLookup } from "../types";

export default function JoinPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [code, setCode] = useState(searchParams.get("codigo") || searchParams.get("code") || "");
  const [lookup, setLookup] = useState<InviteLookup | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [submitting, setSubmitting] = useState(false);

  async function doLookup(c: string) {
    if (!/^\d{6}$/.test(c)) return;
    setChecking(true);
    setLookupError(null);
    setLookup(null);
    try {
      const r = await api<InviteLookup>(`/invites/lookup/${c}`, { method: "GET" });
      setLookup(r);
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.status === 404) setLookupError("Código não encontrado.");
        else if (e.status === 410) setLookupError("Convite expirado ou já usado.");
        else setLookupError("Não foi possível validar o código.");
      } else {
        setLookupError("Erro de rede.");
      }
    } finally {
      setChecking(false);
    }
  }

  useEffect(() => {
    if (code && /^\d{6}$/.test(code)) {
      void doLookup(code);
    }
  }, [code]);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    if (!lookup) return;
    if (!form.name.trim() || !form.email.trim() || form.password.length < 6) {
      toast.error("Preencha nome, email e senha (6+ caracteres).");
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: form.email.trim(),
        password: form.password,
        options: {
          data: {
            farm_invite_code: code,
            full_name: form.name.trim(),
          },
          emailRedirectTo: window.location.origin,
        },
      });
      if (error) {
        if (error.message.toLowerCase().includes("already")) {
          toast.error("Este e-mail ja esta cadastrado. Faca login normal — voce ja deve estar na organizacao.");
        } else {
          toast.error(error.message);
        }
        setSubmitting(false);
        return;
      }
      if (data.user?.identities && data.user.identities.length === 0) {
        toast.error("Este e-mail ja esta cadastrado.");
        setSubmitting(false);
        return;
      }
      if (!data.session) {
        toast.success("Conta criada! Confirme seu e-mail antes de entrar.");
        navigate("/");
        return;
      }
      toast.success(`Bem-vindo a ${lookup.organization_name}!`);
      window.location.href = "/";
    } catch (err) {
      console.error("[JoinPage] signup error:", err);
      toast.error("Erro inesperado. Tente de novo.");
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center text-center">
          <Logo className="h-14 w-auto" />
          <LogoName className="h-8 w-auto mt-2.5" />
          <h1 className="text-base font-medium text-slate-900 mt-4">Entrar na Equipe</h1>
        </div>

        {!lookup && (
          <div className="bg-white rounded-lg border border-slate-200 p-5 space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">
                Código de convite (6 dígitos)
              </label>
              <Input
                placeholder="000000"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                maxLength={6}
                className="text-center text-2xl tracking-widest font-mono"
              />
            </div>
            <Button
              className="w-full"
              onClick={() => doLookup(code)}
              disabled={code.length !== 6 || checking}
            >
              {checking ? "Validando..." : "Validar Código"}
            </Button>
            {lookupError && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded p-3 flex items-center gap-2">
                <AlertTriangle className="size-4 shrink-0" />
                {lookupError}
              </div>
            )}
          </div>
        )}

        {lookup && (
          <form onSubmit={handleSignup} className="bg-white rounded-lg border border-slate-200 p-5 space-y-4">
            <div className="flex items-center gap-2 text-sm text-slate-700 bg-emerald-50 border border-emerald-200 rounded p-3">
              <Building2 className="size-4 text-emerald-700 shrink-0" />
              <div>
                Convite valido para <strong>{lookup.organization_name}</strong> como{" "}
                <strong>{lookup.role}</strong>.
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">Seu nome</label>
              <Input
                placeholder="Joao da Silva"
                value={form.name}
                onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">E-mail</label>
              <Input
                type="email"
                placeholder="seu@email.com"
                value={form.email}
                onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">Senha</label>
              <Input
                type="password"
                placeholder="ao menos 6 caracteres"
                value={form.password}
                onChange={(e) => setForm((s) => ({ ...s, password: e.target.value }))}
              />
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "Criando conta..." : "Criar Conta e Entrar"}
            </Button>
            <button
              type="button"
              onClick={() => { setLookup(null); setCode(""); }}
              className="text-xs text-slate-500 hover:text-slate-700 mx-auto block"
            >
              Usar Outro Código
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
