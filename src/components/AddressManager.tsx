import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, MapPin, Plus, Star, Trash2, Pencil, X } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

export type Address = {
  id: string;
  user_id: string;
  label: string;
  zip_code: string;
  street: string;
  number: string;
  complement: string | null;
  neighborhood: string;
  city: string;
  state: string;
  is_default: boolean;
};

const addressSchema = z.object({
  label: z.string().trim().min(1, "Informe um nome").max(40),
  zip_code: z
    .string()
    .trim()
    .regex(/^\d{5}-?\d{3}$/, "CEP inválido (use 00000-000)"),
  street: z.string().trim().min(1, "Informe a rua").max(120),
  number: z.string().trim().min(1, "Informe o número").max(20),
  complement: z.string().trim().max(60).optional().or(z.literal("")),
  neighborhood: z.string().trim().min(1, "Informe o bairro").max(80),
  city: z.string().trim().min(1, "Informe a cidade").max(80),
  state: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{2}$/, "UF deve ter 2 letras")
    .transform((s) => s.toUpperCase()),
});

type FormData = {
  label: string;
  zip_code: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  is_default: boolean;
};

const emptyForm: FormData = {
  label: "Casa",
  zip_code: "",
  street: "",
  number: "",
  complement: "",
  neighborhood: "",
  city: "",
  state: "",
  is_default: false,
};

export function formatAddress(a: Address): string {
  const comp = a.complement ? `, ${a.complement}` : "";
  return `${a.street}, ${a.number}${comp} — ${a.neighborhood}, ${a.city}/${a.state} (CEP ${a.zip_code})`;
}

export function AddressManager() {
  const [items, setItems] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("addresses")
      .select("*")
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setItems((data as Address[]) ?? []);
    setLoading(false);
  }

  function startNew() {
    setEditingId(null);
    setForm({ ...emptyForm, is_default: items.length === 0 });
    setShowForm(true);
  }

  function startEdit(a: Address) {
    setEditingId(a.id);
    setForm({
      label: a.label,
      zip_code: a.zip_code,
      street: a.street,
      number: a.number,
      complement: a.complement ?? "",
      neighborhood: a.neighborhood,
      city: a.city,
      state: a.state,
      is_default: a.is_default,
    });
    setShowForm(true);
  }

  async function lookupCep(cep: string) {
    const clean = cep.replace(/\D/g, "");
    if (clean.length !== 8) return;
    try {
      const r = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
      const d = await r.json();
      if (d.erro) return;
      setForm((f) => ({
        ...f,
        street: f.street || d.logradouro || "",
        neighborhood: f.neighborhood || d.bairro || "",
        city: f.city || d.localidade || "",
        state: f.state || d.uf || "",
      }));
    } catch {
      // silencioso
    }
  }

  async function submit() {
    const parsed = addressSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setSaving(true);
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      toast.error("Sessão expirada");
      setSaving(false);
      return;
    }
    const payload = {
      ...parsed.data,
      complement: parsed.data.complement || null,
      is_default: form.is_default,
      user_id: auth.user.id,
    };
    const { error } = editingId
      ? await supabase.from("addresses").update(payload).eq("id", editingId)
      : await supabase.from("addresses").insert(payload);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(editingId ? "Endereço atualizado" : "Endereço adicionado");
    setShowForm(false);
    setEditingId(null);
    void load();
  }

  async function setDefault(id: string) {
    const { error } = await supabase
      .from("addresses")
      .update({ is_default: true })
      .eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Endereço padrão atualizado");
      void load();
    }
  }

  async function remove(id: string) {
    if (!confirm("Excluir este endereço?")) return;
    const { error } = await supabase.from("addresses").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Endereço removido");
      void load();
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Cadastre seus endereços e o assistente já saberá onde o serviço será feito.
        </p>
        {!showForm && (
          <Button size="sm" onClick={startNew}>
            <Plus className="mr-1.5 h-4 w-4" /> Novo endereço
          </Button>
        )}
      </div>

      {showForm && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
          className="space-y-3 rounded-2xl border border-border bg-card p-4"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">
              {editingId ? "Editar endereço" : "Novo endereço"}
            </h3>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setShowForm(false);
                setEditingId(null);
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-1">
              <Label className="text-xs">Identificação</Label>
              <Input
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
                placeholder="Casa, Trabalho..."
                maxLength={40}
              />
            </div>
            <div className="sm:col-span-1">
              <Label className="text-xs">CEP</Label>
              <Input
                value={form.zip_code}
                onChange={(e) => setForm({ ...form, zip_code: e.target.value })}
                onBlur={(e) => void lookupCep(e.target.value)}
                placeholder="00000-000"
                maxLength={9}
                inputMode="numeric"
              />
            </div>
            <div className="sm:col-span-2">
              <Label className="text-xs">Rua / Logradouro</Label>
              <Input
                value={form.street}
                onChange={(e) => setForm({ ...form, street: e.target.value })}
                maxLength={120}
              />
            </div>
            <div>
              <Label className="text-xs">Número</Label>
              <Input
                value={form.number}
                onChange={(e) => setForm({ ...form, number: e.target.value })}
                maxLength={20}
              />
            </div>
            <div>
              <Label className="text-xs">Complemento (opcional)</Label>
              <Input
                value={form.complement}
                onChange={(e) => setForm({ ...form, complement: e.target.value })}
                placeholder="Apto, bloco..."
                maxLength={60}
              />
            </div>
            <div>
              <Label className="text-xs">Bairro</Label>
              <Input
                value={form.neighborhood}
                onChange={(e) => setForm({ ...form, neighborhood: e.target.value })}
                maxLength={80}
              />
            </div>
            <div>
              <Label className="text-xs">Cidade</Label>
              <Input
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                maxLength={80}
              />
            </div>
            <div>
              <Label className="text-xs">UF</Label>
              <Input
                value={form.state}
                onChange={(e) => setForm({ ...form, state: e.target.value.toUpperCase() })}
                maxLength={2}
                placeholder="SP"
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={form.is_default}
              onChange={(e) => setForm({ ...form, is_default: e.target.checked })}
              className="h-4 w-4 rounded border-border"
            />
            Usar como endereço padrão
          </label>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setShowForm(false);
                setEditingId(null);
              }}
            >
              Cancelar
            </Button>
            <Button type="submit" size="sm" disabled={saving}>
              {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              {editingId ? "Salvar alterações" : "Adicionar endereço"}
            </Button>
          </div>
        </form>
      )}

      {items.length === 0 && !showForm ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
          <MapPin className="mx-auto h-6 w-6 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">
            Nenhum endereço cadastrado ainda.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((a) => (
            <article
              key={a.id}
              className={`rounded-2xl border p-4 shadow-sm ${
                a.is_default ? "border-primary/40 bg-primary/5" : "border-border bg-card"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground">{a.label}</span>
                    {a.is_default && (
                      <span className="flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
                        <Star className="h-3 w-3 fill-current" /> Padrão
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{formatAddress(a)}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {!a.is_default && (
                    <Button size="sm" variant="outline" onClick={() => setDefault(a.id)}>
                      <Star className="mr-1.5 h-3.5 w-3.5" /> Tornar padrão
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => startEdit(a)}>
                    <Pencil className="mr-1.5 h-3.5 w-3.5" /> Editar
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => remove(a.id)}>
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Excluir
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}