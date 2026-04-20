import { createFileRoute, Link } from "@tanstack/react-router";
import { ChatBot } from "@/components/ChatBot";
import { Toaster } from "@/components/ui/sonner";
import { Wrench, Zap, Hammer, Paintbrush, Sparkles } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ResolveJá — Encontre o profissional certo para sua casa" },
      {
        name: "description",
        content:
          "Converse com a ResolveJá e encontre encanador, eletricista, pintor, montador e mais. Atendimento rápido, simples e direto.",
      },
      { property: "og:title", content: "ResolveJá — Serviços domésticos" },
      {
        property: "og:description",
        content:
          "Conte seu problema e te conectamos com o profissional ideal para sua casa.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="min-h-screen bg-[image:var(--gradient-soft)]">
      <Toaster richColors position="top-center" />
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[image:var(--gradient-hero)] text-primary-foreground shadow-[var(--shadow-elegant)]">
            <Wrench className="h-5 w-5" />
          </div>
          <span className="text-lg font-bold tracking-tight text-foreground">
            Resolve<span className="text-primary-glow">Já</span>
          </span>
        </div>
        <Link
          to="/admin"
          className="text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          Painel admin
        </Link>
      </header>

      <main className="mx-auto grid max-w-6xl gap-10 px-5 pb-12 lg:grid-cols-2 lg:items-center lg:gap-8 lg:py-8">
        <section className="space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-primary-glow" />
            Atendimento inteligente 24/7
          </div>
          <h1 className="text-4xl font-bold leading-tight tracking-tight text-foreground sm:text-5xl">
            Problema em casa?{" "}
            <span className="bg-[image:var(--gradient-hero)] bg-clip-text text-transparent">
              A gente resolve.
            </span>
          </h1>
          <p className="max-w-md text-base text-muted-foreground">
            Converse com nosso assistente, descreva o que está acontecendo e
            encontramos o profissional certo para você. Simples assim.
          </p>

          <div className="grid grid-cols-2 gap-3 pt-2 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
            {[
              { icon: Wrench, label: "Encanador" },
              { icon: Zap, label: "Eletricista" },
              { icon: Hammer, label: "Pedreiro" },
              { icon: Paintbrush, label: "Pintor" },
            ].map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5"
              >
                <Icon className="h-4 w-4 text-primary-glow" />
                <span className="text-sm font-medium text-foreground">
                  {label}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="flex justify-center lg:justify-end">
          <ChatBot />
        </section>
      </main>
    </div>
  );
}
