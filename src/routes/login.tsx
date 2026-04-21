import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { Loader2, Wrench } from "lucide-react";

type Search = { redirect?: string };

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
  }),
  head: () => ({
    meta: [{ title: "Entrar — ResolveJá" }],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { redirect } = useSearch({ from: "/login" });
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [resetMode, setResetMode] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate({ to: redirect ?? "/minha-conta" });
    });
  }, [navigate, redirect]);

  function validatePassword(p: string): string | null {
    if (p.length < 8) return "A senha deve ter no mínimo 8 caracteres.";
    if (!/[A-Z]/.test(p)) return "A senha deve conter ao menos uma letra maiúscula.";
    if (!/[^A-Za-z0-9]/.test(p)) return "A senha deve conter ao menos um caractere especial.";
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) toast.error(error.message);
      else navigate({ to: redirect ?? "/minha-conta" });
    } else {
      const err = validatePassword(password);
      if (err) {
        toast.error(err);
        setLoading(false);
        return;
      }
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/minha-conta`,
          data: { full_name: fullName },
        },
      });
      if (error) toast.error(error.message);
      else toast.success("Conta criada! Confirme seu email para entrar.");
    }
    setLoading(false);
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    if (!email) {
      toast.error("Digite seu email.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) toast.error(error.message);
    else toast.success("Email enviado! Verifique sua caixa de entrada.");
    setLoading(false);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[image:var(--gradient-soft)] px-4">
      <Toaster richColors position="top-center" />
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-elegant)]">
        <div className="mb-5 flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[image:var(--gradient-hero)] text-primary-foreground">
            <Wrench className="h-5 w-5" />
          </div>
          <h1 className="text-lg font-bold text-foreground">
            {resetMode ? "Recuperar senha" : mode === "signin" ? "Entrar" : "Criar conta"}
          </h1>
        </div>

        {resetMode ? (
          <form onSubmit={handleReset} className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Informe seu email para receber o link de redefinição.
            </p>
            <div>
              <Label htmlFor="r-email">Email</Label>
              <Input id="r-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar link"}
            </Button>
            <button type="button" onClick={() => setResetMode(false)} className="w-full text-center text-xs text-muted-foreground hover:text-foreground">
              ← Voltar
            </button>
          </form>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            {mode === "signup" && (
              <div>
                <Label htmlFor="fname">Nome completo</Label>
                <Input id="fname" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </div>
            )}
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="pwd">Senha</Label>
              <Input
                id="pwd"
                type="password"
                required
                minLength={mode === "signup" ? 8 : undefined}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              {mode === "signup" && (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Mín. 8 caracteres, 1 maiúscula e 1 caractere especial.
                </p>
              )}
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : mode === "signin" ? "Entrar" : "Criar conta"}
            </Button>
            {mode === "signin" && (
              <button type="button" onClick={() => setResetMode(true)} className="w-full text-center text-xs text-primary hover:underline">
                Esqueci minha senha
              </button>
            )}
            <button
              type="button"
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
              className="w-full text-center text-xs text-muted-foreground hover:text-foreground"
            >
              {mode === "signin" ? "Não tem conta? Criar uma" : "Já tem conta? Entrar"}
            </button>
          </form>
        )}

        <Link to="/" className="mt-4 block text-center text-xs text-muted-foreground hover:text-foreground">
          ← Voltar ao início
        </Link>
      </div>
    </div>
  );
}