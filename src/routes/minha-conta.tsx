import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Toaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, Wrench, LogOut, Phone, MapPin, Clock, MessageCircle, Star, Plus, StickyNote, Pencil, Check, X, Settings, AlertTriangle, Trash2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { RequestChat } from "@/components/RequestChat";
import { RatingForm } from "@/components/RatingForm";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AddressManager } from "@/components/AddressManager";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/minha-conta")({
  head: () => ({ meta: [{ title: "Minha conta — ResolveJá" }] }),
  component: MinhaContaPage,
});

type Request = {
  id: string;
  category: string;
  problem_description: string;
  location: string | null;
  urgency: string | null;
  status: string;
  created_at: string;
  assigned_professional_id: string | null;
  notes_for_professional: string | null;
};

type Pro = { id: string; full_name: string; phone: string; category: string };
type Rating = { service_request_id: string; stars: number };

function MinhaContaPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
  const [requests, setRequests] = useState<Request[]>([]);
  const [pros, setPros] = useState<Record<string, Pro>>({});
  const [ratings, setRatings] = useState<Record<string, Rating>>({});

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      if (!s) navigate({ to: "/login", search: { redirect: "/minha-conta" } });
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate({ to: "/login", search: { redirect: "/minha-conta" } });
        return;
      }
      setAuthChecked(true);
      load();
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  async function load() {
    setLoading(true);
    const { data: reqs, error } = await supabase
      .from("service_requests")
      .select("id, category, problem_description, location, urgency, status, created_at, assigned_professional_id, notes_for_professional")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    const list = (reqs as Request[]) ?? [];
    setRequests(list);

    const proIds = Array.from(new Set(list.map((r) => r.assigned_professional_id).filter(Boolean) as string[]));
    if (proIds.length > 0) {
      const { data: prosData } = await supabase
        .from("professionals")
        .select("id, full_name, phone, category")
        .in("id", proIds);
      const map: Record<string, Pro> = {};
      (prosData as Pro[] | null)?.forEach((p) => (map[p.id] = p));
      setPros(map);
    }

    const reqIds = list.map((r) => r.id);
    if (reqIds.length > 0) {
      const { data: rData } = await supabase
        .from("ratings")
        .select("service_request_id, stars")
        .in("service_request_id", reqIds);
      const rMap: Record<string, Rating> = {};
      (rData as Rating[] | null)?.forEach((r) => (rMap[r.service_request_id] = r));
      setRatings(rMap);
    }
    setLoading(false);
  }

  if (!authChecked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[image:var(--gradient-soft)]">
      <Toaster richColors position="top-center" />
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-5 py-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[image:var(--gradient-hero)] text-primary-foreground">
              <Wrench className="h-5 w-5" />
            </div>
            <h1 className="text-base font-bold text-foreground">Minha conta</h1>
          </Link>
          <div className="flex items-center gap-2">
            <Link to="/">
              <Button size="sm" variant="default">
                <Plus className="mr-1.5 h-4 w-4" /> Novo chamado
              </Button>
            </Link>
            <Button size="sm" variant="outline" onClick={() => supabase.auth.signOut()}>
              <LogOut className="mr-1.5 h-4 w-4" /> Sair
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-5 py-6">
        <Tabs defaultValue="requests">
          <TabsList className="mb-4">
            <TabsTrigger value="requests">Meus chamados</TabsTrigger>
            <TabsTrigger value="addresses">
              <MapPin className="mr-1.5 h-3.5 w-3.5" /> Endereços
            </TabsTrigger>
            <TabsTrigger value="settings">
              <Settings className="mr-1.5 h-3.5 w-3.5" /> Configurações
            </TabsTrigger>
          </TabsList>

          <TabsContent value="requests">
            {loading ? (
              <div className="flex justify-center py-20">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : requests.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
                <p className="text-sm text-muted-foreground">
                  Você ainda não abriu nenhum chamado.
                </p>
                <Link to="/" className="mt-3 inline-block">
                  <Button size="sm">Abrir primeiro chamado</Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {requests.map((r) => (
                  <RequestRow
                    key={r.id}
                    req={r}
                    pro={r.assigned_professional_id ? pros[r.assigned_professional_id] : undefined}
                    rating={ratings[r.id]}
                    onChange={load}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="addresses">
            <AddressManager />
          </TabsContent>

          <TabsContent value="settings">
            <SettingsPanel />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function RequestRow({
  req,
  pro,
  rating,
  onChange,
}: {
  req: Request;
  pro?: Pro;
  rating?: Rating;
  onChange: () => void;
}) {
  const [showChat, setShowChat] = useState(false);
  const [showRating, setShowRating] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesDraft, setNotesDraft] = useState(req.notes_for_professional ?? "");
  const [savingNotes, setSavingNotes] = useState(false);

  const statusLabel: Record<string, string> = {
    novo: "Novo",
    em_andamento: "Em andamento",
    concluido: "Concluído",
  };
  const statusColor: Record<string, string> = {
    novo: "bg-secondary text-secondary-foreground",
    em_andamento: "bg-primary text-primary-foreground",
    concluido: "bg-accent text-accent-foreground",
  };

  async function markConcluded() {
    const { error } = await supabase
      .from("service_requests")
      .update({ status: "concluido" })
      .eq("id", req.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Chamado concluído!");
      onChange();
    }
  }

  async function saveNotes() {
    const value = notesDraft.trim().slice(0, 500);
    setSavingNotes(true);
    const { error } = await supabase
      .from("service_requests")
      .update({ notes_for_professional: value || null })
      .eq("id", req.id);
    setSavingNotes(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Notas atualizadas");
    setEditingNotes(false);
    onChange();
  }

  return (
    <article className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-primary px-2.5 py-0.5 text-xs font-semibold uppercase text-primary-foreground">
              {req.category.replace(/_/g, " ")}
            </span>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusColor[req.status] ?? "bg-secondary text-secondary-foreground"}`}>
              {statusLabel[req.status] ?? req.status}
            </span>
            {req.urgency === "urgente" && (
              <span className="rounded-full bg-destructive px-2.5 py-0.5 text-xs font-semibold text-destructive-foreground">
                Urgente
              </span>
            )}
          </div>
          <p className="mt-2 text-sm font-medium text-foreground">{req.problem_description}</p>
          <div className="mt-2 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
            {req.location && (
              <div className="flex items-center gap-1.5">
                <MapPin className="h-3 w-3" />
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(req.location)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline-offset-2 hover:underline"
                  title="Abrir no Google Maps"
                >
                  {req.location}
                </a>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <Clock className="h-3 w-3" /> {new Date(req.created_at).toLocaleString("pt-BR")}
            </div>
          </div>

          <div className="mt-3 rounded-lg border border-accent/40 bg-accent/10 p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-primary">
                <StickyNote className="h-3.5 w-3.5" /> Notas para o profissional
              </div>
              {!editingNotes && req.status !== "concluido" && (
                <button
                  type="button"
                  onClick={() => {
                    setNotesDraft(req.notes_for_professional ?? "");
                    setEditingNotes(true);
                  }}
                  className="flex items-center gap-1 rounded-full px-2 py-0.5 text-xs text-muted-foreground hover:bg-background hover:text-foreground"
                >
                  <Pencil className="h-3 w-3" />
                  {req.notes_for_professional ? "Editar" : "Adicionar"}
                </button>
              )}
            </div>
            {editingNotes ? (
              <div className="mt-2 space-y-2">
                <Textarea
                  value={notesDraft}
                  onChange={(e) => setNotesDraft(e.target.value.slice(0, 500))}
                  placeholder="Ex: portão azul, tocar interfone 12. Cuidado com o cachorro no quintal."
                  rows={3}
                  className="text-sm"
                />
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{notesDraft.length}/500</span>
                  <div className="flex gap-1.5">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setEditingNotes(false);
                        setNotesDraft(req.notes_for_professional ?? "");
                      }}
                      disabled={savingNotes}
                    >
                      <X className="mr-1 h-3.5 w-3.5" /> Cancelar
                    </Button>
                    <Button size="sm" onClick={saveNotes} disabled={savingNotes}>
                      {savingNotes ? (
                        <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Check className="mr-1 h-3.5 w-3.5" />
                      )}
                      Salvar
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <p className="mt-1.5 text-sm text-foreground">
                {req.notes_for_professional || (
                  <span className="text-muted-foreground italic">
                    Nenhuma observação adicionada. Use este espaço para avisos como acesso, animais, melhor entrada.
                  </span>
                )}
              </p>
            )}
          </div>

          {pro && (
            <div className="mt-3 rounded-xl border border-accent/40 bg-accent/10 p-3">
              <div className="text-xs font-semibold uppercase text-primary">Profissional designado</div>
              <div className="mt-1 flex items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold text-foreground">{pro.full_name}</div>
                  <div className="text-xs text-muted-foreground">{pro.category.replace(/_/g, " ")}</div>
                </div>
                <a
                  href={`tel:${pro.phone.replace(/\D/g, "")}`}
                  className="rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
                >
                  <Phone className="inline h-3 w-3" /> Ligar
                </a>
              </div>
            </div>
          )}

          {rating && (
            <div className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
              Sua avaliação:
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className={`h-3.5 w-3.5 ${i < rating.stars ? "fill-primary text-primary" : "text-muted-foreground/30"}`} />
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">
        <Button size="sm" variant="outline" onClick={() => setShowChat((v) => !v)}>
          <MessageCircle className="mr-1.5 h-3.5 w-3.5" /> {showChat ? "Fechar chat" : "Conversar"}
        </Button>
        {req.status !== "concluido" && (
          <Button size="sm" variant="outline" onClick={markConcluded}>
            Marcar concluído
          </Button>
        )}
        {req.status === "concluido" && pro && !rating && (
          <Button size="sm" onClick={() => setShowRating((v) => !v)}>
            <Star className="mr-1.5 h-3.5 w-3.5" /> Avaliar profissional
          </Button>
        )}
      </div>

      {showChat && (
        <div className="mt-3 border-t border-border pt-3">
          <RequestChat requestId={req.id} senderRole="cliente" />
        </div>
      )}
      {showRating && pro && (
        <div className="mt-3 border-t border-border pt-3">
          <RatingForm
            requestId={req.id}
            professionalId={pro.id}
            onDone={() => {
              setShowRating(false);
              onChange();
            }}
          />
        </div>
      )}
    </article>
  );
}

function friendlyDeleteError(error: { message?: string; code?: string } | null): string {
  const raw = (error?.message ?? "").toLowerCase();
  const code = error?.code ?? "";

  if (raw.includes("not authenticated") || raw.includes("jwt") || code === "401") {
    return "Sua sessão expirou. Faça login novamente para apagar sua conta.";
  }
  if (
    raw.includes("permission denied") ||
    raw.includes("not allowed") ||
    code === "42501"
  ) {
    return "Você não tem permissão para apagar esta conta.";
  }
  if (raw.includes("does not exist") || raw.includes("no rows") || raw.includes("not found")) {
    return "Conta não encontrada. Talvez ela já tenha sido apagada.";
  }
  if (
    raw.includes("foreign key") ||
    raw.includes("violates") ||
    raw.includes("constraint")
  ) {
    return "Não foi possível apagar a conta porque ainda existem dados vinculados. Tente novamente em instantes.";
  }
  if (raw.includes("network") || raw.includes("failed to fetch") || raw.includes("timeout")) {
    return "Falha de conexão. Verifique sua internet e tente novamente.";
  }
  return "Não foi possível apagar sua conta no momento. Tente novamente em alguns instantes.";
}

function SettingsPanel() {
  const navigate = useNavigate();
  const [deleting, setDeleting] = useState(false);
  const [open, setOpen] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    const { error } = await supabase.rpc("delete_my_account");
    if (error) {
      setDeleting(false);
      toast.error(friendlyDeleteError(error), {
        description: "Se o problema persistir, entre em contato com o suporte.",
      });
      return;
    }
    await supabase.auth.signOut();
    setOpen(false);
    setDeleting(false);
    toast.success("Sua conta foi apagada. Sentiremos sua falta!");
    navigate({ to: "/" });
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border-2 border-destructive/40 bg-destructive/5 p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-destructive/15 text-destructive">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-bold text-destructive">Zona de Perigo</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Apagar sua conta é uma ação <strong>permanente e irreversível</strong>. Todo o
              seu histórico de chamados, endereços salvos e dados de perfil serão removidos
              definitivamente. Esta ação não pode ser desfeita.
            </p>

            <AlertDialog open={open} onOpenChange={setOpen}>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" className="mt-4">
                  <Trash2 className="mr-1.5 h-4 w-4" /> Apagar minha conta
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                    <AlertTriangle className="h-5 w-5" /> Apagar conta permanentemente?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    Você está prestes a apagar sua conta da ResolveJá. Todo o histórico de
                    chamados, endereços e dados pessoais serão removidos e não poderão ser
                    recuperados. Tem certeza que deseja continuar?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    disabled={deleting}
                    onClick={(e) => {
                      e.preventDefault();
                      handleDelete();
                    }}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {deleting ? (
                      <>
                        <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Apagando...
                      </>
                    ) : (
                      "Sim, quero apagar minha conta"
                    )}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </div>
    </div>
  );
}