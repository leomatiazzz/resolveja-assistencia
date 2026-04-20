import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Send, Loader2, Wrench, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

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
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, isLoading]);

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
        body: JSON.stringify({ messages: history }),
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
          const { data: saveData, error } = await supabase.functions.invoke("save-request", {
            body: { ...args, conversation_id: convId },
          });
          if (error) throw error;
          setRequestRegistered(true);
          toast.success("Solicitação registrada!");
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

      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-5">
        {messages.map((m, i) => (
          <MessageBubble key={i} role={m.role} content={m.content} />
        ))}
        {matches.length > 0 && (
          <div className="space-y-2">
            {matches.map((p) => (
              <ProMatchCard key={p.id} pro={p} />
            ))}
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
        className="flex items-center gap-2 border-t border-border bg-background px-3 py-3"
      >
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

function ProMatchCard({ pro }: { pro: Match }) {
  return (
    <div className="rounded-2xl border border-accent/40 bg-accent/10 p-3 text-sm">
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
        <a
          href={`tel:${pro.phone.replace(/\D/g, "")}`}
          className="shrink-0 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
        >
          📞 Ligar
        </a>
      </div>
    </div>
  );
}