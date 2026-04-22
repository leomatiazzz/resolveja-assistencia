import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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

const passwordSchema = z
  .string()
  .min(8, "A senha deve ter no mínimo 8 caracteres.")
  .regex(/[A-Z]/, "A senha deve conter ao menos uma letra maiúscula.")
  .regex(/[^A-Za-z0-9]/, "A senha deve conter ao menos um caractere especial.");

const signinSchema = z.object({
  fullName: z.string().optional(),
  email: z.string().trim().email("Email inválido."),
  password: z.string().min(1, "Informe sua senha."),
});

const signupSchema = z.object({
  fullName: z.string().trim().min(2, "Informe seu nome completo."),
  email: z.string().trim().email("Email inválido."),
  password: passwordSchema,
});

type AuthFormValues = {
  fullName?: string;
  email: string;
  password: string;
};

function LoginPage() {
  const navigate = useNavigate();
  const { redirect } = useSearch({ from: "/login" });
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [resetMode, setResetMode] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const form = useForm<AuthFormValues>({
    resolver: zodResolver(mode === "signup" ? signupSchema : signinSchema),
    defaultValues: { fullName: "", email: "", password: "" },
    mode: "onSubmit",
  });
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = form;

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate({ to: redirect ?? "/minha-conta" });
    });
  }, [navigate, redirect]);

  const onSubmit = handleSubmit(async ({ email, password, fullName }) => {
    setLoading(true);
    const target = redirect ?? "/minha-conta";
    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) toast.error(error.message);
      else navigate({ to: target });
    } else {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}${target}`,
          data: { full_name: fullName ?? "" },
        },
      });
      if (error) {
        toast.error(error.message);
      } else if (data.session) {
        toast.success("Conta criada!");
        navigate({ to: target });
      } else {
        toast.success("Conta criada! Confirme seu email para entrar.");
      }
    }
    setLoading(false);
  });

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    if (!resetEmail) {
      toast.error("Digite seu email.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
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
              <Input id="r-email" type="email" required value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar link"}
            </Button>
            <button type="button" onClick={() => setResetMode(false)} className="w-full text-center text-xs text-muted-foreground hover:text-foreground">
              ← Voltar
            </button>
          </form>
        ) : (
          <form onSubmit={onSubmit} className="space-y-3" noValidate>
            {mode === "signup" && (
              <div>
                <Label htmlFor="fname">Nome completo</Label>
                <Input id="fname" {...register("fullName")} />
                {errors.fullName && (
                  <p className="mt-1 text-[11px] text-destructive">{errors.fullName.message}</p>
                )}
              </div>
            )}
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" {...register("email")} />
              {errors.email && (
                <p className="mt-1 text-[11px] text-destructive">{errors.email.message}</p>
              )}
            </div>
            <div>
              <Label htmlFor="pwd">Senha</Label>
              <Input id="pwd" type="password" {...register("password")} />
              {errors.password && (
                <p className="mt-1 text-[11px] text-destructive">{errors.password.message}</p>
              )}
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
              onClick={() => {
                setMode(mode === "signin" ? "signup" : "signin");
                reset({ fullName: "", email: "", password: "" });
              }}
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