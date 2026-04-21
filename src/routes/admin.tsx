import { createFileRoute, Link } from "@tanstack/react-router";
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

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!session) return <LoginCard />;
  if (!isAdmin) return <NoAccessCard />;
  return <Dashboard />;
}

function LoginCard() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === "signup") {
      if (password.length < 8) {
        toast.error("A senha deve ter no mínimo 8 caracteres.");
        return;
      }
      if (!/[A-Z]/.test(password)) {
        toast.error("A senha deve conter ao menos uma letra maiúscula.");
        return;
      }
      if (!/[^A-Za-z0-9]/.test(password)) {
        toast.error("A senha deve conter ao menos um caractere especial.");
        return;
      }
    }
    setLoading(true);
    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) toast.error(error.message);
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/admin` },
      });
      if (error) toast.error(error.message);
      else
        toast.success(
          "Conta criada! Confirme seu email e faça login para acessar o painel.",
        );
    }
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
          <h1 className="text-lg font-bold text-foreground">Painel ResolveJá</h1>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              type="password"
              required
              minLength={mode === "signup" ? 8 : undefined}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {mode === "signup" && (
              <p className="mt-1 text-[11px] text-muted-foreground">
                Mínimo 8 caracteres, 1 maiúscula e 1 caractere especial.
              </p>
            )}
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : mode === "signin" ? (
              "Entrar"
            ) : (
              "Criar conta"
            )}
          </Button>
        </form>
        <button
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="mt-3 w-full text-center text-xs text-muted-foreground hover:text-foreground"
        >
          {mode === "signin"
            ? "Não tem conta? Criar uma"
            : "Já tem conta? Entrar"}
        </button>
        <Link
          to="/"
          className="mt-4 block text-center text-xs text-muted-foreground hover:text-foreground"
        >
          ← Voltar ao chat
        </Link>
      </div>
    </div>
  );
}

function NoAccessCard() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[image:var(--gradient-soft)] px-4">
      <Toaster richColors position="top-center" />
      <div className="max-w-md rounded-2xl border border-border bg-card p-6 text-center shadow-[var(--shadow-elegant)]">
        <h2 className="text-lg font-bold text-foreground">Sem acesso</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Sua conta não tem permissão de administrador. Peça a um admin para
          adicionar a role <code className="font-mono">admin</code> ao seu
          usuário na tabela <code className="font-mono">user_roles</code>.
        </p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => supabase.auth.signOut()}
        >
          <LogOut className="mr-2 h-4 w-4" /> Sair
        </Button>
      </div>
    </div>
  );
}

function Dashboard() {
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
          </TabsList>
          <TabsContent value="requests">
            <RequestsTab />
          </TabsContent>
          <TabsContent value="professionals">
            <ProfessionalsTab />
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
    if (error) toast.error(error.message);
    else {
      toast.success("Atualizado");
      load();
    }
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
                  {c.replace(/_/g, " ")}
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
            <span className="rounded-full bg-primary px-2.5 py-0.5 text-xs font-semibold uppercase text-primary-foreground">
              {pro.category.replace(/_/g, " ")}
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
            <span className="rounded-full bg-primary px-2.5 py-0.5 text-xs font-semibold uppercase text-primary-foreground">
              {req.category.replace(/_/g, " ")}
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
                {req.location}
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