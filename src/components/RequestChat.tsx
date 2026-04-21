import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Loader2, Send } from "lucide-react";

type Message = {
  id: string;
  sender_role: "cliente" | "profissional" | "admin";
  content: string;
  created_at: string;
};

export function RequestChat({
  requestId,
  senderRole,
}: {
  requestId: string;
  senderRole: "cliente" | "admin";
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      const { data, error } = await supabase
        .from("request_messages")
        .select("id, sender_role, content, created_at")
        .eq("service_request_id", requestId)
        .order("created_at", { ascending: true });
      if (!active) return;
      if (error) toast.error(error.message);
      setMessages((data as Message[]) ?? []);
      setLoading(false);
    }
    load();

    const channel = supabase
      .channel(`req-${requestId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "request_messages",
          filter: `service_request_id=eq.${requestId}`,
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Message]);
        },
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [requestId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase.from("request_messages").insert({
      service_request_id: requestId,
      sender_role: senderRole,
      sender_user_id: userData.user?.id,
      content: text.slice(0, 500),
    });
    if (error) toast.error(error.message);
    else setInput("");
    setSending(false);
  }

  return (
    <div className="rounded-xl border border-border bg-background">
      <div ref={scrollRef} className="max-h-64 space-y-2 overflow-y-auto p-3">
        {loading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted-foreground">
            Nenhuma mensagem ainda. Envie a primeira para conversar com o suporte.
          </p>
        ) : (
          messages.map((m) => {
            const mine = m.sender_role === senderRole;
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[80%] rounded-2xl px-3 py-1.5 text-sm ${
                    mine
                      ? "rounded-br-md bg-primary text-primary-foreground"
                      : "rounded-bl-md bg-secondary text-secondary-foreground"
                  }`}
                >
                  {m.sender_role !== senderRole && (
                    <div className="mb-0.5 text-[10px] font-semibold uppercase opacity-70">
                      {m.sender_role}
                    </div>
                  )}
                  <p className="whitespace-pre-wrap">{m.content}</p>
                </div>
              </div>
            );
          })
        )}
      </div>
      <form onSubmit={handleSend} className="flex gap-2 border-t border-border p-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Mensagem..."
          maxLength={500}
          disabled={sending}
          className="flex-1"
        />
        <Button type="submit" size="icon" disabled={sending || !input.trim()}>
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </form>
    </div>
  );
}