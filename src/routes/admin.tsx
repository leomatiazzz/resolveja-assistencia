import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  LogOut,
  Wrench,
  Phone,
  MapPin,
  Clock,
  Mail,
  Briefcase,
  CheckCircle2,
  XCircle,
  Bell,
  StickyNote,
} from "lucide-react";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [{ title: "Painel — ResolveJá" }],
  }),
  component: AdminPage,
});

type ServiceRequest = {
  id: string;
  category: string;
  problem_description: string;
  location: string | null;
  urgency: string | null;
  preferred_time: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  status: string;
  created_at: string;
  assigned_professional_id: string | null;
  notes_for_professional: string | null;
};

type Professional = {
  id: string;
  full_name: string;
  phone: string;
  email: string | null;
  category: string;
  city: string;
  neighborhood: string | null;
  years_experience: number | null;
  description: string | null;
  status: string;
  created_at: string;
};

function AdminPage() {
  const navigate = useNavigate();
  const [session, setSession] = useState<unknown>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (s?.user) checkAdmin(s.user.id);
      else {
        setIsAdmin(false);
        setChecking(false);
      }
    });
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      if (s?.user) checkAdmin(s.user.id);
      else setChecking(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function checkAdmin(userId: string) {
    setChecking(true);
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    setIsAdmin(!!data);
    setChecking(false);
  }

  useEffect(() => {
    if (checking) return;
    if (!session || !isAdmin) {
      navigate({ to: "/login", search: { redirect: "/admin" } });
    }
  }, [checking, session, isAdmin, navigate]);

  if (checking || !session || !isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return <Dashboard />;
}

function Dashboard() {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let mounted = true;
    async function loadCount() {
      const { count } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("read", false);
      if (mounted) setUnreadCount(count ?? 0);
    }
    loadCount();
    const channel = supabase
      .channel("notifications-unread")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications" },
        () => loadCount(),
      )
      .subscribe();
    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div className="min-h-screen bg-[image:var(--gradient-soft)]">
      <Toaster richColors position="top-center" />
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[image:var(--gradient-hero)] text-primary-foreground">
              <Wrench className="h-5 w-5" />
            </div>
            <h1 className="text-base font-bold text-foreground">
              Painel ResolveJá
            </h1>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => supabase.auth.signOut()}
          >
            <LogOut className="mr-2 h-4 w-4" /> Sair
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-6">
        <Tabs defaultValue="requests" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="requests">
              <Briefcase className="mr-2 h-4 w-4" /> Solicitações
            </TabsTrigger>
            <TabsTrigger value="professionals">
              <Wrench className="mr-2 h-4 w-4" /> Profissionais
            </TabsTrigger>
            <TabsTrigger value="notifications" className="relative">
              <Bell className="mr-2 h-4 w-4" /> Notificações
              {unreadCount > 0 && (
                <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[11px] font-semibold text-destructive-foreground">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="requests">
            <RequestsTab />
          </TabsContent>
          <TabsContent value="professionals">
            <ProfessionalsTab />
          </TabsContent>
          <TabsContent value="notifications">
            <NotificationsTab />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function RequestsTab() {
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("service_requests")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setRequests((data as ServiceRequest[]) ?? []);
    setLoading(false);
  }

  async function updateStatus(id: string, status: string) {
    const { error } = await supabase
      .from("service_requests")
      .update({ status })
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }

    // Notificar profissional ao concluir/cancelar
    if (status === "concluido" || status === "cancelado") {
      const req = requests.find((r) => r.id === id);
      if (req?.assigned_professional_id) {
        const isDone = status === "concluido";
        await supabase.from("notifications").insert({
          professional_id: req.assigned_professional_id,
          service_request_id: id,
          type: isDone ? "request_completed" : "request_cancelled",
          title: isDone
            ? "Serviço marcado como concluído"
            : "Serviço cancelado",
          message: isDone
            ? `A solicitação de ${req.category} (${req.contact_name ?? "cliente"}) foi marcada como concluída pelo admin.`
            : `A solicitação de ${req.category} (${req.contact_name ?? "cliente"}) foi cancelada pelo admin.`,
        });
      }
    }

    toast.success("Atualizado");
    load();
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }
  if (requests.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
        <p className="text-sm text-muted-foreground">
          Nenhuma solicitação ainda. Quando os usuários completarem uma
          conversa, ela aparecerá aqui.
        </p>
      </div>
    );
  }
  return (
    <div className="grid gap-3">
      {requests.map((r) => (
        <RequestCard key={r.id} req={r} onStatus={updateStatus} />
      ))}
    </div>
  );
}

const PRO_CATEGORIES = [
  "encanador",
  "eletricista",
  "pedreiro",
  "pintor",
  "montador",
  "tecnico_eletrodomesticos",
  "instalador",
  "diarista",
  "chaveiro",
  "servicos_gerais",
];

const CATEGORY_LABELS: Record<string, string> = {
  encanador: "Encanador",
  eletricista: "Eletricista",
  pedreiro: "Pedreiro",
  pintor: "Pintor",
  montador: "Montador de móveis",
  tecnico_eletrodomesticos: "Técnico em eletrodomésticos",
  instalador: "Instalador",
  instalacao: "Instalação",
  diarista: "Diarista",
  chaveiro: "Chaveiro",
  servicos_gerais: "Serviços gerais",
  limpeza: "Limpeza",
};

function categoryLabel(key: string) {
  if (CATEGORY_LABELS[key]) return CATEGORY_LABELS[key];
  const words = key.replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function ProfessionalsTab() {
  const [pros, setPros] = useState<Professional[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [cityFilter, setCityFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("professionals")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setPros((data as Professional[]) ?? []);
    setLoading(false);
  }

  async function updateProStatus(id: string, status: string) {
    const { error } = await supabase
      .from("professionals")
      .update({ status })
      .eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success(
        status === "aprovado"
          ? "Profissional aprovado"
          : status === "rejeitado"
            ? "Profissional rejeitado"
            : "Atualizado",
      );
      load();
    }
  }

  const filtered = pros.filter((p) => {
    if (categoryFilter !== "all" && p.category !== categoryFilter) return false;
    if (statusFilter !== "all" && p.status !== statusFilter) return false;
    if (
      cityFilter.trim() &&
      !p.city.toLowerCase().includes(cityFilter.trim().toLowerCase())
    )
      return false;
    return true;
  });

  const cities = Array.from(new Set(pros.map((p) => p.city))).filter(Boolean);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 rounded-2xl border border-border bg-card p-4 sm:grid-cols-3">
        <div>
          <Label className="text-xs">Categoria</Label>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as categorias</SelectItem>
              {PRO_CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {categoryLabel(c)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Cidade</Label>
          <Input
            list="city-list"
            value={cityFilter}
            onChange={(e) => setCityFilter(e.target.value)}
            placeholder="Filtrar por cidade..."
          />
          <datalist id="city-list">
            {cities.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>
        <div>
          <Label className="text-xs">Status</Label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="pendente">Pendentes</SelectItem>
              <SelectItem value="aprovado">Aprovados</SelectItem>
              <SelectItem value="rejeitado">Rejeitados</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
          <p className="text-sm text-muted-foreground">
            {pros.length === 0
              ? "Nenhum profissional cadastrado ainda."
              : "Nenhum profissional com esses filtros."}
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((p) => (
            <ProfessionalCard key={p.id} pro={p} onStatus={updateProStatus} />
          ))}
        </div>
      )}
    </div>
  );
}

function ProfessionalCard({
  pro,
  onStatus,
}: {
  pro: Professional;
  onStatus: (id: string, s: string) => void;
}) {
  const statusColor =
    pro.status === "aprovado"
      ? "bg-accent text-accent-foreground"
      : pro.status === "rejeitado"
        ? "bg-destructive text-destructive-foreground"
        : "bg-secondary text-secondary-foreground";
  return (
    <article className="rounded-2xl border border-border bg-card p-5 shadow-sm transition-[var(--transition-smooth)] hover:shadow-[var(--shadow-elegant)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground">
              {pro.full_name}
            </h3>
            <span className="rounded-full bg-primary px-2.5 py-0.5 text-xs font-semibold text-primary-foreground">
              {categoryLabel(pro.category)}
            </span>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusColor}`}
            >
              {pro.status}
            </span>
          </div>
          <div className="mt-3 grid gap-1.5 text-xs text-muted-foreground sm:grid-cols-2">
            <div className="flex items-center gap-1.5">
              <Phone className="h-3 w-3" />
              {pro.phone}
            </div>
            {pro.email && (
              <div className="flex items-center gap-1.5">
                <Mail className="h-3 w-3" />
                {pro.email}
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <MapPin className="h-3 w-3" />
              {pro.neighborhood ? `${pro.neighborhood}, ` : ""}
              {pro.city}
            </div>
            {pro.years_experience != null && (
              <div className="flex items-center gap-1.5">
                <Clock className="h-3 w-3" />
                {pro.years_experience} anos de experiência
              </div>
            )}
          </div>
          {pro.description && (
            <p className="mt-2 text-xs text-muted-foreground">
              {pro.description}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <Button
            size="sm"
            variant={pro.status === "aprovado" ? "default" : "outline"}
            onClick={() => onStatus(pro.id, "aprovado")}
          >
            <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Aprovar
          </Button>
          <Button
            size="sm"
            variant={pro.status === "rejeitado" ? "destructive" : "outline"}
            onClick={() => onStatus(pro.id, "rejeitado")}
          >
            <XCircle className="mr-1.5 h-3.5 w-3.5" /> Rejeitar
          </Button>
        </div>
      </div>
      <div className="mt-3 text-[10px] text-muted-foreground">
        Cadastrado em {new Date(pro.created_at).toLocaleString("pt-BR")}
      </div>
    </article>
  );
}

function RequestCard({
  req,
  onStatus,
}: {
  req: ServiceRequest;
  onStatus: (id: string, s: string) => void;
}) {
  const urgent = req.urgency === "urgente";
  return (
    <article className="rounded-2xl border border-border bg-card p-5 shadow-sm transition-[var(--transition-smooth)] hover:shadow-[var(--shadow-elegant)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-primary px-2.5 py-0.5 text-xs font-semibold text-primary-foreground">
              {categoryLabel(req.category)}
            </span>
            {urgent && (
              <span className="rounded-full bg-destructive px-2.5 py-0.5 text-xs font-semibold text-destructive-foreground">
                Urgente
              </span>
            )}
            <span className="rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground">
              {req.status}
            </span>
          </div>
          <p className="mt-2 text-sm font-medium text-foreground">
            {req.problem_description}
          </p>
          {req.notes_for_professional && (
            <div className="mt-2 flex items-start gap-2 rounded-lg border border-accent/50 bg-accent/10 p-2.5 text-xs text-accent-foreground">
              <StickyNote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wide text-primary">
                  Notas para o profissional
                </div>
                <p className="mt-0.5 leading-snug text-foreground">
                  {req.notes_for_professional}
                </p>
              </div>
            </div>
          )}
          <div className="mt-3 grid gap-1.5 text-xs text-muted-foreground sm:grid-cols-2">
            {req.contact_name && (
              <div>
                <span className="font-semibold text-foreground">
                  {req.contact_name}
                </span>
              </div>
            )}
            {req.contact_phone && (
              <div className="flex items-center gap-1.5">
                <Phone className="h-3 w-3" />
                {req.contact_phone}
              </div>
            )}
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
            {req.preferred_time && (
              <div className="flex items-center gap-1.5">
                <Clock className="h-3 w-3" />
                {req.preferred_time}
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Button
            size="sm"
            variant={req.status === "em_andamento" ? "default" : "outline"}
            onClick={() => onStatus(req.id, "em_andamento")}
          >
            Em andamento
          </Button>
          <Button
            size="sm"
            variant={req.status === "concluido" ? "default" : "outline"}
            onClick={() => onStatus(req.id, "concluido")}
          >
            Concluído
          </Button>
        </div>
      </div>
      <div className="mt-3 text-[10px] text-muted-foreground">
        {new Date(req.created_at).toLocaleString("pt-BR")}
      </div>
    </article>
  );
}

type NotificationRow = {
  id: string;
  professional_id: string;
  service_request_id: string | null;
  type: string;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
};

function NotificationsTab() {
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [pros, setPros] = useState<Record<string, { full_name: string; phone: string; email: string | null }>>({});
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [readFilter, setReadFilter] = useState<string>("all");

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    const list = (data as NotificationRow[]) ?? [];
    setItems(list);
    const proIds = Array.from(new Set(list.map((n) => n.professional_id)));
    if (proIds.length > 0) {
      const { data: prosData } = await supabase
        .from("professionals")
        .select("id, full_name, phone, email")
        .in("id", proIds);
      const map: Record<string, { full_name: string; phone: string; email: string | null }> = {};
      (prosData ?? []).forEach((p) => {
        map[p.id] = { full_name: p.full_name, phone: p.phone, email: p.email };
      });
      setPros(map);
    }
    setLoading(false);
  }

  async function toggleRead(id: string, read: boolean) {
    const { error } = await supabase.from("notifications").update({ read }).eq("id", id);
    if (error) toast.error(error.message);
    else load();
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }
  const filtered = items.filter((n) => {
    if (typeFilter !== "all" && n.type !== typeFilter) return false;
    if (readFilter === "unread" && n.read) return false;
    if (readFilter === "read" && !n.read) return false;
    return true;
  });
  const unreadVisible = filtered.filter((n) => !n.read).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-card p-3">
        <div className="min-w-[180px] flex-1">
          <Label className="text-xs">Tipo</Label>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              <SelectItem value="professional_assigned">Atribuído</SelectItem>
              <SelectItem value="request_completed">Concluído</SelectItem>
              <SelectItem value="request_cancelled">Cancelado</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-[160px] flex-1">
          <Label className="text-xs">Status</Label>
          <Select value={readFilter} onValueChange={setReadFilter}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="unread">Não lidas</SelectItem>
              <SelectItem value="read">Lidas</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="text-xs text-muted-foreground">
          {filtered.length} resultado{filtered.length === 1 ? "" : "s"} · {unreadVisible} não lida{unreadVisible === 1 ? "" : "s"}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
          <p className="text-sm text-muted-foreground">
            {items.length === 0
              ? "Nenhuma notificação ainda. Quando um cliente escolher um profissional no chat, ela aparecerá aqui."
              : "Nenhuma notificação corresponde aos filtros selecionados."}
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((n) => {
        const pro = pros[n.professional_id];
        return (
          <article
            key={n.id}
            className={`rounded-2xl border p-4 shadow-sm ${
              n.read ? "border-border bg-card" : "border-primary/40 bg-primary/5"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Bell className={`h-4 w-4 ${n.read ? "text-muted-foreground" : "text-primary"}`} />
                  <h3 className="font-semibold text-foreground">{n.title}</h3>
                  {!n.read && (
                    <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
                      Nova
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{n.message}</p>
                {pro && (
                  <div className="mt-3 rounded-lg border border-border bg-background p-2 text-xs">
                    <div className="font-semibold text-foreground">→ {pro.full_name}</div>
                    <div className="mt-1 flex flex-wrap gap-3 text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Phone className="h-3 w-3" /> {pro.phone}
                      </span>
                      {pro.email && (
                        <span className="flex items-center gap-1">
                          <Mail className="h-3 w-3" /> {pro.email}
                        </span>
                      )}
                    </div>
                  </div>
                )}
                {n.service_request_id && (
                  <div className="mt-2 text-[10px] text-muted-foreground">
                    Chamado: <code className="font-mono">{n.service_request_id.slice(0, 8)}</code>
                  </div>
                )}
              </div>
              <Button
                size="sm"
                variant={n.read ? "outline" : "default"}
                onClick={() => toggleRead(n.id, !n.read)}
              >
                {n.read ? "Marcar não lida" : "Marcar lida"}
              </Button>
            </div>
            <div className="mt-3 text-[10px] text-muted-foreground">
              {new Date(n.created_at).toLocaleString("pt-BR")}
            </div>
          </article>
        );
          })}
        </div>
      )}
    </div>
  );
}