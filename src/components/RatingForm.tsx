import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2, Star } from "lucide-react";

export function RatingForm({
  requestId,
  professionalId,
  onDone,
}: {
  requestId: string;
  professionalId: string;
  onDone: () => void;
}) {
  const [stars, setStars] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (stars < 1) {
      toast.error("Escolha de 1 a 5 estrelas.");
      return;
    }
    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase.from("ratings").insert({
      service_request_id: requestId,
      professional_id: professionalId,
      user_id: userData.user!.id,
      stars,
      comment: comment.trim().slice(0, 500) || null,
    });
    setSaving(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Avaliação enviada. Obrigado!");
      onDone();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <p className="text-xs font-semibold uppercase text-muted-foreground">
          Como foi o atendimento?
        </p>
        <div className="mt-1 flex gap-1" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setStars(n)}
              onMouseEnter={() => setHover(n)}
              className="transition-transform hover:scale-110"
              aria-label={`${n} estrela${n > 1 ? "s" : ""}`}
            >
              <Star
                className={`h-7 w-7 ${
                  n <= (hover || stars) ? "fill-primary text-primary" : "text-muted-foreground/30"
                }`}
              />
            </button>
          ))}
        </div>
      </div>
      <Textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Conte como foi o serviço (opcional)"
        maxLength={500}
        rows={3}
      />
      <Button type="submit" size="sm" disabled={saving || stars < 1}>
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar avaliação"}
      </Button>
    </form>
  );
}