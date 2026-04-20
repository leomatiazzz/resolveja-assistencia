import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { Wrench, ArrowLeft, CheckCircle2, Loader2 } from "lucide-react";

export const Route = createFileRoute("/cadastro-profissional")({
  head: () => ({
    meta: [
      { title: "Seja um profissional ResolveJá — Cadastre-se grátis" },
      {
        name: "description",
        content:
          "Cadastre-se como prestador de serviços na ResolveJá. Receba chamados de clientes na sua região: encanador, eletricista, pintor e mais.",
      },
      {
        property: "og:title",
        content: "Seja um profissional ResolveJá",
      },
      {
        property: "og:description",
        content:
          "Cadastro gratuito para prestadores de serviços domésticos. Comece a receber clientes hoje.",
      },
    ],
  }),
  component: ProfessionalSignupPage,
});

const CATEGORIES = [
  { value: "encanador", label: "Encanador" },
  { value: "eletricista", label: "Eletricista" },
  { value: "pedreiro", label: "Pedreiro" },
  { value: "pintor", label: "Pintor" },
  { value: "montador", label: "Montador de móveis" },
  { value: "tecnico_eletrodomesticos", label: "Técnico de eletrodomésticos" },
  { value: "instalador", label: "Instalador (TV, ar, chuveiro)" },
  { value: "diarista", label: "Diarista / limpeza" },
  { value: "chaveiro", label: "Chaveiro" },
  { value: "servicos_gerais", label: "Serviços gerais" },
];

const schema = z.object({
  full_name: z
    .string()
    .trim()
    .min(2, "Informe seu nome completo")
    .max(100, "Nome muito longo"),
  phone: z
    .string()
    .trim()
    .min(8, "Telefone inválido")
    .max(20, "Telefone muito longo"),
  email: z
    .string()
    .trim()
    .email("E-mail inválido")
    .max(255)
    .optional()
    .or(z.literal("")),
  category: z.string().min(1, "Selecione uma categoria"),
  city: z.string().trim().min(2, "Informe a cidade").max(100),
  neighborhood: z.string().trim().max(100).optional().or(z.literal("")),
  years_experience: z
    .number()
    .int()
    .min(0)
    .max(80)
    .optional(),
  description: z
    .string()
    .trim()
    .max(500, "Máximo de 500 caracteres")
    .optional()
    .or(z.literal("")),
});

function ProfessionalSignupPage() {
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    email: "",
    category: "",
    city: "",
    neighborhood: "",
    years_experience: "",
    description: "",
  });

  const update = (k: keyof typeof form, v: string) =>
    setForm((p) => ({ ...p, [k]: v }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const parsed = schema.safeParse({
      ...form,
      years_experience: form.years_experience
        ? Number(form.years_experience)
        : undefined,
    });

    if (!parsed.success) {
      const first = parsed.error.issues[0];
      toast.error(first?.message ?? "Verifique os campos");
      setLoading(false);
      return;
    }

    const data = parsed.data;
    const { error } = await supabase.from("professionals").insert({
      full_name: data.full_name,
      phone: data.phone,
      email: data.email || null,
      category: data.category,
      city: data.city,
      neighborhood: data.neighborhood || null,
      years_experience: data.years_experience ?? null,
      description: data.description || null,
    });

    setLoading(false);

    if (error) {
      toast.error("Erro ao enviar cadastro. Tente novamente.");
      return;
    }

    setSubmitted(true);
  }

  return (
    <div className="min-h-screen bg-[image:var(--gradient-soft)]">
      <Toaster richColors position="top-center" />
      <header className="mx-auto flex max-w-3xl items-center justify-between px-5 py-5">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[image:var(--gradient-hero)] text-primary-foreground shadow-[var(--shadow-elegant)]">
            <Wrench className="h-5 w-5" />
          </div>
          <span className="text-lg font-bold tracking-tight text-foreground">
            Resolve<span className="text-primary-glow">Já</span>
          </span>
        </Link>
        <Link
          to="/"
          className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Voltar
        </Link>
      </header>

      <main className="mx-auto max-w-3xl px-5 pb-16">
        {submitted ? (
          <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-[var(--shadow-elegant)]">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
              <CheckCircle2 className="h-7 w-7" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">
              Cadastro enviado!
            </h1>
            <p className="mt-2 text-muted-foreground">
              Recebemos seus dados. Nossa equipe entrará em contato em breve
              pelo telefone informado.
            </p>
            <Link
              to="/"
              className="mt-6 inline-flex h-10 items-center justify-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90"
            >
              Voltar ao início
            </Link>
          </div>
        ) : (
          <>
            <div className="mb-8 text-center">
              <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                Seja um profissional <span className="text-primary">ResolveJá</span>
              </h1>
              <p className="mt-3 text-muted-foreground">
                Cadastro gratuito. Receba chamados de clientes da sua região
                direto no seu WhatsApp.
              </p>
            </div>

            <form
              onSubmit={handleSubmit}
              className="space-y-5 rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-elegant)] sm:p-8"
            >
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="full_name">Nome completo *</Label>
                  <Input
                    id="full_name"
                    value={form.full_name}
                    onChange={(e) => update("full_name", e.target.value)}
                    placeholder="Ex: João Silva"
                    maxLength={100}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Telefone / WhatsApp *</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={form.phone}
                    onChange={(e) => update("phone", e.target.value)}
                    placeholder="(11) 99999-0000"
                    maxLength={20}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">E-mail (opcional)</Label>
                  <Input
                    id="email"
                    type="email"
                    value={form.email}
                    onChange={(e) => update("email", e.target.value)}
                    placeholder="seu@email.com"
                    maxLength={255}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category">Categoria *</Label>
                  <Select
                    value={form.category}
                    onValueChange={(v) => update("category", v)}
                  >
                    <SelectTrigger id="category">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((c) => (
                        <SelectItem key={c.value} value={c.value}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="years_experience">Anos de experiência</Label>
                  <Input
                    id="years_experience"
                    type="number"
                    min={0}
                    max={80}
                    value={form.years_experience}
                    onChange={(e) => update("years_experience", e.target.value)}
                    placeholder="Ex: 5"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="city">Cidade *</Label>
                  <Input
                    id="city"
                    value={form.city}
                    onChange={(e) => update("city", e.target.value)}
                    placeholder="Ex: São Paulo"
                    maxLength={100}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="neighborhood">Bairro</Label>
                  <Input
                    id="neighborhood"
                    value={form.neighborhood}
                    onChange={(e) => update("neighborhood", e.target.value)}
                    placeholder="Ex: Vila Mariana"
                    maxLength={100}
                  />
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="description">
                    Conte um pouco sobre seu trabalho
                  </Label>
                  <Textarea
                    id="description"
                    value={form.description}
                    onChange={(e) => update("description", e.target.value)}
                    placeholder="Especialidades, ferramentas, regiões que atende..."
                    maxLength={500}
                    rows={4}
                  />
                  <p className="text-xs text-muted-foreground">
                    {form.description.length}/500
                  </p>
                </div>
              </div>

              <Button type="submit" className="w-full" size="lg" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  "Enviar cadastro"
                )}
              </Button>

              <p className="text-center text-xs text-muted-foreground">
                Ao enviar, você concorda em ser contatado pela ResolveJá sobre
                oportunidades de serviço.
              </p>
            </form>
          </>
        )}
      </main>
    </div>
  );
}
