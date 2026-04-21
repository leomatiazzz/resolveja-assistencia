import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Send, Loader2, Wrench, CheckCircle2, Phone, UserCheck, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import { formatAddress, type Address } from "@/components/AddressManager";

type Msg = { role: "user" | "assistant"; content: string };

type Match = {
  id: string;
  full_name: string;
  phone: string;
  category: string;
  city: string;
  neighborhood: string | null;
  years_experience: number | null;
  description: string | null;
};

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;
const DRAFT_KEY = "resolveja_chat_draft";
const AUTO_FINALIZE_TRIGGER =
  "Acabei de fazer login na minha conta. Por favor, finalize agora minha solicitação chamando register_service_request com todos os dados que já coletamos nesta conversa, sem fazer mais perguntas.";

type Draft = {
  messages: Msg[];
  conversationId: string | null;
  savedAt: number;
};

function saveDraft(messages: Msg[], conversationId: string | null) {
  try {
    const draft: Draft = { messages, conversationId, savedAt: Date.now() };
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    /* ignore */
  }
}

function loadDraft(): Draft | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as Draft;
    // expire after 30 minutes
    if (Date.now() - d.savedAt > 30 * 60 * 1000) {
      sessionStorage.removeItem(DRAFT_KEY);
      return null;
    }
    return d;
  } catch {
    return null;
  }
}

function clearDraft() {
  try {
    sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    /* ignore */
  }
}

function getSessionId() {
  const k = "resolveja_session";
  let id = localStorage.getItem(k);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(k, id);
  }
  return id;
}

const SUGGESTIONS = [
  "Minha pia está vazando",
  "A tomada parou de funcionar",
  "Preciso montar um guarda-roupa",
  "Quero pintar uma parede",
];

export function ChatBot() {
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      content:
        "Olá! 👋 Sou o assistente da **ResolveJá**. Me conte: qual problema você está enfrentando em casa?",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [requestRegistered, setRequestRegistered] = useState(false);
  const [matches, setMatches] = useState<Match[]>([]);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [chosenProId, setChosenProId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<{ full_name: string | null; phone: string | null } | null>(null);
  const [defaultAddress, setDefaultAddress] = useState<Address | null>(null);
  const [collectedLocation, setCollectedLocation] = useState<string | null>(null);
  const [offerSaveAddress, setOfferSaveAddress] = useState(false);
  const [savingAddress, setSavingAddress] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const autoFinalizeRef = useRef(false);

  useEffect(() => {
    const loadProfile = async (uid: string | null) => {
      setUserId(uid);
      if (!uid) {
        setUserProfile(null);
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select("full_name, phone")
        .eq("user_id", uid)
        .maybeSingle();
      setUserProfile(data ?? { full_name: null, phone: null });

      const { data: addr } = await supabase
        .from("addresses")
        .select("*")
        .eq("user_id", uid)
        .eq("is_default", true)
        .maybeSingle();
      setDefaultAddress((addr as Address) ?? null);

      // After login, restore any draft conversation saved before redirect
      const draft = loadDraft();
      if (draft && draft.messages.length > 1) {
        setMessages(draft.messages);
        setConversationId(draft.conversationId);
        clearDraft();
        // Trigger auto-finalize on next render once profile is set
        autoFinalizeRef.current = true;
      }
    };
    supabase.auth.getSession().then(({ data: { session } }) => {
      loadProfile(session?.user?.id ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      loadProfile(s?.user?.id ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, isLoading]);

  // Auto-finalize after login restored a draft: send a hidden trigger so the AI
  // immediately calls register_service_request with the data already collected.
  useEffect(() => {
    if (!autoFinalizeRef.current) return;
    if (!userId || !userProfile) return;
    if (isLoading || requestRegistered) return;
    autoFinalizeRef.current = false;
    const firstName = userProfile.full_name?.split(" ")[0];
    const welcome: Msg = {
      role: "assistant",
      content: `✅ Pronto${firstName ? `, **${firstName}**` : ""}! Você entrou na sua conta. Vou finalizar sua solicitação agora com os dados que já coletamos…`,
    };
    setMessages((prev) => [...prev, welcome]);
    // Send a system-style trigger message to the AI to finalize.
    void handleSend(AUTO_FINALIZE_TRIGGER);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, userProfile]);

  async function ensureConversation(): Promise<string> {
    if (conversationId) return conversationId;
    const sessionId = getSessionId();
    const { data, error } = await supabase
      .from("conversations")
      .insert({ session_id: sessionId })
      .select()
      .single();
    if (error || !data) throw new Error("Falha ao criar conversa");
    setConversationId(data.id);
    return data.id;
  }

  async function persistMessage(
    convId: string,
    role: "user" | "assistant",
    content: string,
  ) {
    await supabase.from("messages").insert({
      conversation_id: convId,
      role,
      content,
    });
  }

  async function handleSend(textOverride?: string) {
    const text = (textOverride ?? input).trim();
    if (!text || isLoading) return;

    setInput("");
    const userMsg: Msg = { role: "user", content: text };
    setMessages((p) => [...p, userMsg]);
    setIsLoading(true);

    let convId: string;
    try {
      convId = await ensureConversation();
      await persistMessage(convId, "user", text);
    } catch (e) {
      toast.error("Erro ao iniciar conversa");
      setIsLoading(false);
      return;
    }

    const history = [...messages, userMsg].map((m) => ({
      role: m.role,
      content: m.content,
    }));

    let assistantSoFar = "";
    let toolCallBuffer: { name?: string; args: string } = { args: "" };

    const upsertAssistant = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") {
          return prev.map((m, i) =>
            i === prev.length - 1 ? { ...m, content: assistantSoFar } : m,
          );
        }
        return [...prev, { role: "assistant", content: assistantSoFar }];
      });
    };

    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: history,
          user_context: {
            logged_in: !!userId,
            full_name: userProfile?.full_name ?? null,
            phone: userProfile?.phone ?? null,
            default_address: defaultAddress ? formatAddress(defaultAddress) : null,
          },
        }),
      });

      if (resp.status === 429) {
        toast.error("Muitas mensagens em pouco tempo. Aguarde um instante.");
        setIsLoading(false);
        return;
      }
      if (resp.status === 402) {
        toast.error("Créditos esgotados.");
        setIsLoading(false);
        return;
      }
      if (!resp.ok || !resp.body) throw new Error("Falha ao iniciar stream");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let done = false;

      while (!done) {
        const r = await reader.read();
        if (r.done) break;
        buffer += decoder.decode(r.value, { stream: true });

        let idx: number;
        while ((idx = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") {
            done = true;
            break;
          }
          try {
            const parsed = JSON.parse(json);
            const delta = parsed.choices?.[0]?.delta;
            const content = delta?.content as string | undefined;
            if (content) upsertAssistant(content);

            const tc = delta?.tool_calls?.[0];
            if (tc) {
              if (tc.function?.name) toolCallBuffer.name = tc.function.name;
              if (tc.function?.arguments)
                toolCallBuffer.args += tc.function.arguments;
            }
          } catch {
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }

      // Persist assistant text
      if (assistantSoFar.trim()) {
        await persistMessage(convId, "assistant", assistantSoFar);
      }

      // Handle tool call
      if (toolCallBuffer.name === "register_service_request") {
        try {
          const args = JSON.parse(toolCallBuffer.args || "{}");
          // Se o usuário tem endereço padrão, força ele como location.
          const finalArgs = defaultAddress
            ? { ...args, location: formatAddress(defaultAddress) }
            : args;
          const { data: saveData, error } = await supabase.functions.invoke("save-request", {
            body: { ...finalArgs, conversation_id: convId, user_id: userId },
          });
          if (error) throw error;
          setRequestRegistered(true);
          if (saveData?.id) setRequestId(saveData.id);
          toast.success("Solicitação registrada!");
          // Memoriza o que o assistente coletou para oferecer salvar como endereço.
          if (typeof args.location === "string" && args.location.trim()) {
            setCollectedLocation(args.location.trim());
          }
          if (userId && !defaultAddress && args.location) {
            setOfferSaveAddress(true);
          }
          const found = (saveData?.matches ?? []) as Match[];
          setMatches(found);
          if (!assistantSoFar.trim()) {
            const confirm =
              found.length > 0
                ? `✅ Pronto! Encontrei **${found.length} profissional${found.length > 1 ? "is" : ""}** disponível${found.length > 1 ? "is" : ""} na sua região. Veja abaixo os contatos.`
                : "✅ Pronto! Sua solicitação foi registrada. Vou buscar o profissional ideal e em breve entraremos em contato.";
            upsertAssistant(confirm);
            await persistMessage(convId, "assistant", confirm);
          } else if (found.length > 0) {
            const extra = `\n\n💡 Encontrei **${found.length} profissional${found.length > 1 ? "is" : ""}** disponível${found.length > 1 ? "is" : ""} na sua região — veja abaixo.`;
            upsertAssistant(extra);
            await persistMessage(convId, "assistant", assistantSoFar);
          }
        } catch (err) {
          console.error("save-request error:", err);
          toast.error("Erro ao registrar solicitação");
        }
      }
    } catch (e) {
      console.error(e);
      toast.error("Erro de comunicação");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex h-[calc(100dvh-2rem)] max-h-[700px] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-elegant)]">
      <header className="flex items-center gap-3 border-b border-border bg-[image:var(--gradient-hero)] px-5 py-4 text-primary-foreground">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-foreground/15 backdrop-blur">
          <Wrench className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <h2 className="text-base font-semibold leading-tight">ResolveJá</h2>
          <p className="text-xs opacity-80">
            {requestRegistered ? "Solicitação enviada" : "Online agora"}
          </p>
        </div>
        {requestRegistered && (
          <CheckCircle2 className="h-5 w-5 text-accent" />
        )}
      </header>

      {userId && defaultAddress && !requestRegistered && (
        <div className="flex items-center justify-between gap-2 border-b border-border bg-primary/5 px-4 py-2 text-xs">
          <div className="flex min-w-0 items-center gap-1.5 text-foreground">
            <MapPin className="h-3.5 w-3.5 flex-shrink-0 text-primary" />
            <span className="truncate">
              <span className="font-semibold">{defaultAddress.label}:</span>{" "}
              {formatAddress(defaultAddress)}
            </span>
          </div>
          <Link
            to="/minha-conta"
            className="flex-shrink-0 font-semibold text-primary hover:underline"
          >
            Trocar
          </Link>
        </div>
      )}

      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-5">
        {messages
          .filter((m) => m.content !== AUTO_FINALIZE_TRIGGER)
          .map((m, i) => (
            <MessageBubble key={i} role={m.role} content={m.content} />
          ))}
        {matches.length > 0 && (
          <div className="space-y-2">
            {matches.map((p) => (
              <ProMatchCard
                key={p.id}
                pro={p}
                chosen={chosenProId === p.id}
                canChoose={!!userId && !!requestId && !chosenProId}
                onChoose={async () => {
                  if (!requestId) return;
                  const { error } = await supabase
                    .from("service_requests")
                    .update({ assigned_professional_id: p.id, status: "em_andamento" })
                    .eq("id", requestId);
                  if (error) {
                    toast.error(error.message);
                    return;
                  }
                  // Registra notificação para o profissional (visível no painel admin)
                  const clientName = userProfile?.full_name?.trim() || "Cliente";
                  await supabase.from("notifications").insert({
                    professional_id: p.id,
                    service_request_id: requestId,
                    type: "professional_assigned",
                    title: "Novo chamado atribuído",
                    message: `${clientName} escolheu você para um serviço. Acesse o painel para ver os detalhes.`,
                  });
                  setChosenProId(p.id);
                  toast.success(`${p.full_name} foi designado ao seu chamado!`);
                }}
              />
            ))}
            {requestRegistered && !userId && (
              <div className="rounded-2xl border border-primary/30 bg-primary/5 p-3 text-center text-xs">
                <p className="text-foreground">
                  💡 <strong>Crie uma conta</strong> para escolher um profissional, acompanhar o status e conversar pelo painel.
                </p>
                <Link
                  to="/login"
                  search={{ redirect: "/" }}
                  onClick={() => saveDraft(messages, conversationId)}
                  className="mt-2 inline-block rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
                >
                  Criar conta / Entrar
                </Link>
              </div>
            )}
            {chosenProId && (
              <div className="rounded-2xl border border-accent/40 bg-accent/10 p-3 text-center text-xs text-foreground">
                ✅ Profissional designado. Acompanhe o chamado em{" "}
                <Link to="/minha-conta" className="font-semibold text-primary hover:underline">
                  Minha conta
                </Link>.
              </div>
            )}
          </div>
        )}
        {requestRegistered && offerSaveAddress && collectedLocation && (
          <div className="rounded-2xl border border-primary/30 bg-primary/5 p-3 text-xs">
            <div className="flex items-start gap-2">
              <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
              <div className="flex-1">
                <p className="font-semibold text-foreground">
                  Salvar este endereço para próximas vezes?
                </p>
                <p className="mt-0.5 text-muted-foreground">
                  &ldquo;{collectedLocation}&rdquo;
                </p>
                <p className="mt-1 text-muted-foreground">
                  Cadastre o endereço completo na sua conta — assim o assistente
                  já sabe onde o serviço será feito e o foco da conversa fica
                  nos detalhes do problema.
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Link
                    to="/minha-conta"
                    className="inline-block rounded-full bg-primary px-3 py-1.5 font-semibold text-primary-foreground hover:bg-primary/90"
                  >
                    Cadastrar endereço
                  </Link>
                  <button
                    type="button"
                    onClick={() => setOfferSaveAddress(false)}
                    className="rounded-full border border-border bg-card px-3 py-1.5 font-medium text-foreground hover:bg-secondary"
                    disabled={savingAddress}
                  >
                    Agora não
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        {isLoading && messages[messages.length - 1]?.role === "user" && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            digitando...
          </div>
        )}

        {messages.length === 1 && !isLoading && (
          <div className="flex flex-wrap gap-2 pt-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => handleSend(s)}
                className="rounded-full border border-border bg-secondary px-3 py-1.5 text-xs text-secondary-foreground transition-[var(--transition-smooth)] hover:bg-accent hover:text-accent-foreground"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="flex flex-col gap-2 border-t border-border bg-background px-3 py-3"
      >
        {!userId && messages.length > 2 && !requestRegistered && (
          <div className="flex items-center justify-between gap-2 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2 text-xs">
            <span className="text-foreground">
              💡 Tem conta? Faça login para acompanhar seu chamado.
            </span>
            <Link
              to="/login"
              search={{ redirect: "/" }}
              onClick={() => saveDraft(messages, conversationId)}
              className="shrink-0 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Criar conta / Entrar
            </Link>
          </div>
        )}
        <div className="flex items-center gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Digite sua mensagem..."
          disabled={isLoading}
          maxLength={500}
          className="flex-1"
        />
        <Button
          type="submit"
          size="icon"
          disabled={isLoading || !input.trim()}
          className="shrink-0"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
        </div>
      </form>
    </div>
  );
}

function MessageBubble({
  role,
  content,
}: {
  role: "user" | "assistant";
  content: string;
}) {
  const isUser = role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
          isUser
            ? "rounded-br-md bg-primary text-primary-foreground"
            : "rounded-bl-md bg-secondary text-secondary-foreground"
        }`}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{content}</p>
        ) : (
          <div className="prose prose-sm max-w-none [&_p]:my-1 [&_strong]:text-foreground">
            <ReactMarkdown>{content}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}

function ProMatchCard({
  pro,
  chosen,
  canChoose,
  onChoose,
}: {
  pro: Match;
  chosen: boolean;
  canChoose: boolean;
  onChoose: () => void;
}) {
  return (
    <div
      className={`rounded-2xl border p-3 text-sm ${
        chosen ? "border-primary bg-primary/5" : "border-accent/40 bg-accent/10"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="font-semibold text-foreground">{pro.full_name}</div>
          <div className="mt-0.5 text-xs uppercase tracking-wide text-primary">
            {pro.category.replace(/_/g, " ")}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {pro.neighborhood ? `${pro.neighborhood}, ` : ""}
            {pro.city}
            {pro.years_experience != null
              ? ` • ${pro.years_experience} anos exp.`
              : ""}
          </div>
          {pro.description && (
            <p className="mt-1 text-xs text-muted-foreground">
              {pro.description}
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-col gap-1.5">
          <a
            href={`tel:${pro.phone.replace(/\D/g, "")}`}
            className="rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
          >
            <Phone className="mr-1 inline h-3 w-3" /> Ligar
          </a>
          {canChoose && (
            <button
              onClick={onChoose}
              className="rounded-full border border-primary bg-card px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary hover:text-primary-foreground"
            >
              <UserCheck className="mr-1 inline h-3 w-3" /> Escolher
            </button>
          )}
          {chosen && (
            <span className="rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">
              ✓ Escolhido
            </span>
          )}
        </div>
      </div>
    </div>
  );
}