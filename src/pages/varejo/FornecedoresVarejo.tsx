import { useState, useEffect } from "react";
import { PageContainer } from "../../components/PageContainer";
import { Button } from "../../components/ui/button";
import {
  Truck, Plus, Search, Phone, Mail, MapPin,
  Building2, DollarSign, Package, Trash2, X
} from "lucide-react";
import { Card } from "../../components/ui/card";
import { Modal } from "../../components/ui/modal";
import { toast } from "sonner";
import { useAuth } from "../../contexts/AuthContext";
import { supabase } from "../../lib/supabase";
import { confirmDialog } from "../../components/ui/confirm-dialog";

interface FornecedorItem {
  id: string;
  razaoSocial: string;
  cnpj: string;
  contato: string;
  telefone: string;
  email: string;
  prazoEntrega: string;
  categorias: string;
}

function rowToFornecedor(row: any): FornecedorItem {
  return {
    id: row.id,
    razaoSocial: row.razao_social,
    cnpj: row.cnpj || "",
    contato: row.contato || "",
    telefone: row.telefone || "",
    email: row.email || "",
    prazoEntrega: row.prazo_entrega || "3 dias úteis",
    categorias: row.categorias || "",
  };
}

export default function FornecedoresVarejo() {
  const { activeTenantId } = useAuth();

  const [fornecedores, setFornecedores] = useState<FornecedorItem[]>([]);

  useEffect(() => {
    if (!supabase || !activeTenantId) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("varejo_fornecedores")
        .select("*")
        .eq("tenant_id", activeTenantId)
        .order("created_at", { ascending: false });
      if (!cancelled && !error && data) {
        setFornecedores(data.map(rowToFornecedor));
      }
    })();
    return () => { cancelled = true; };
  }, [activeTenantId]);

  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);

  // Form state
  const [razaoSocial, setRazaoSocial] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [contato, setContato] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [prazoEntrega, setPrazoEntrega] = useState("3 dias úteis");
  const [categorias, setCategorias] = useState("");

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!razaoSocial.trim()) {
      toast.error("Informe a Razão Social do fornecedor.");
      return;
    }
    if (!supabase || !activeTenantId) {
      toast.error("Sem conexão com o banco de dados.");
      return;
    }

    const { data, error } = await supabase
      .from("varejo_fornecedores")
      .insert({
        tenant_id: activeTenantId,
        razao_social: razaoSocial.trim(),
        cnpj: cnpj.trim() || "00.000.000/0001-00",
        contato: contato.trim() || "Comercial",
        telefone: telefone.trim(),
        email: email.trim(),
        prazo_entrega: prazoEntrega.trim() || "3 dias úteis",
        categorias: categorias.trim() || "Geral",
      })
      .select()
      .single();

    if (error || !data) {
      toast.error("Erro ao cadastrar fornecedor.");
      return;
    }

    setFornecedores(prev => [rowToFornecedor(data), ...prev]);
    toast.success("Fornecedor cadastrado com sucesso!");
    setModalOpen(false);

    setRazaoSocial("");
    setCnpj("");
    setContato("");
    setTelefone("");
    setEmail("");
    setCategorias("");
  };

  const handleDelete = async (id: string) => {
    if (!supabase) return;
    const fornecedor = fornecedores.find(f => f.id === id);
    if (!(await confirmDialog({
      title: "Excluir fornecedor",
      description: `Excluir o fornecedor "${fornecedor?.razaoSocial || "selecionado"}"? Essa ação não pode ser desfeita.`,
    }))) return;
    const { error } = await supabase.from("varejo_fornecedores").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao remover fornecedor.");
      return;
    }
    setFornecedores(prev => prev.filter(f => f.id !== id));
    toast.info("Fornecedor removido.");
  };

  const filtered = fornecedores.filter(f => (
    f.razaoSocial.toLowerCase().includes(search.toLowerCase()) ||
    f.cnpj.toLowerCase().includes(search.toLowerCase()) ||
    f.categorias.toLowerCase().includes(search.toLowerCase()) ||
    f.contato.toLowerCase().includes(search.toLowerCase())
  ));

  return (
    <PageContainer
      title="Fornecedores de Mercadorias"
      description="Cadastro de distribuidoras, condições de pagamento, prazos de entrega e catálogo de produtos."
      actions={
        <Button onClick={() => setModalOpen(true)} className="h-9 px-4 text-xs font-bold gap-1.5 shadow-xs">
          <Plus className="w-3.5 h-3.5" /> Novo Fornecedor
        </Button>
      }
    >
      {/* Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card className="p-4 bg-[var(--color-surface-elevated)]/40 border border-[var(--color-border-subtle)]">
          <span className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider block mb-1">Fornecedores Cadastrados</span>
          <div className="text-2xl font-black text-[var(--color-text-primary)]">{fornecedores.length}</div>
        </Card>
        <Card className="p-4 bg-[var(--color-surface-elevated)]/40 border border-[var(--color-border-subtle)]">
          <span className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider block mb-1">Prazo Médio de Reposição</span>
          <div className="text-2xl font-black text-blue-500">3.5 dias</div>
        </Card>
        <Card className="p-4 bg-[var(--color-surface-elevated)]/40 border border-[var(--color-border-subtle)]">
          <span className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider block mb-1">Parceiros Homologados</span>
          <div className="text-2xl font-black text-emerald-500">100%</div>
        </Card>
      </div>

      {/* Search Bar */}
      <div className="mb-4">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
          <input
            type="text"
            placeholder="Buscar fornecedor, CNPJ ou categoria..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs bg-[var(--color-surface)] border border-[var(--color-border-default)] rounded-xl text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-primary-blue)]"
          />
        </div>
      </div>

      {/* List */}
      <div className="space-y-3">
        {filtered.map(f => (
          <div key={f.id} className="p-5 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border-default)] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h4 className="text-xs font-bold text-[var(--color-text-primary)]">{f.razaoSocial}</h4>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[var(--color-surface-sunken)] text-[var(--color-text-muted)]">
                  {f.cnpj}
                </span>
              </div>
              <p className="text-[11px] text-[var(--color-text-muted)]">
                Contato: <strong className="text-[var(--color-text-primary)]">{f.contato}</strong> {f.telefone && `(${f.telefone})`} {f.email && `• ${f.email}`} • Prazo: {f.prazoEntrega}
              </p>
              <p className="text-[10px] text-[var(--color-primary-blue)] font-bold mt-1">
                Linhas: {f.categorias}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button size="sm" variant="outline" onClick={() => toast.success(`Pedido para ${f.razaoSocial} iniciado.`)} className="h-8 text-xs font-bold rounded-xl">
                Novo Pedido de Compra
              </Button>
              <Button size="sm" variant="ghost" onClick={() => handleDelete(f.id)} className="h-8 w-8 p-0 text-red-500 hover:bg-red-500/10 rounded-xl">
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="p-8 text-center text-xs text-[var(--color-text-muted)] bg-[var(--color-surface)] border border-[var(--color-border-default)] rounded-2xl">
            Nenhum fornecedor encontrado.
          </div>
        )}
      </div>

      {/* Standardized Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        maxWidth="max-w-md"
        title={
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[var(--color-primary-blue)]/10 text-[var(--color-primary-blue)] flex items-center justify-center shrink-0">
              <Truck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[var(--color-text-primary)]">Cadastrar Novo Fornecedor</h3>
              <p className="text-xs text-[var(--color-text-muted)]">Dados cadastrais e contato comercial do parceiro</p>
            </div>
          </div>
        }
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <Button
              type="button"
              variant="outline"
              onClick={() => setModalOpen(false)}
              className="h-9 px-4 text-xs font-semibold"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              form="form-fornecedores"
              className="h-9 px-4 text-xs font-semibold bg-[var(--color-primary-blue)] hover:bg-[var(--color-primary-blue)]/90 text-white"
            >
              Salvar Fornecedor
            </Button>
          </div>
        }
      >
        <form id="form-fornecedores" onSubmit={handleCreate} className="space-y-3.5 py-1">
          <div>
            <label className="text-xs font-semibold text-[var(--color-text-primary)] block mb-1.5">Razão Social / Nome Fantasia</label>
            <input
              type="text"
              required
              placeholder="Ex: Distribuidora Nacional de Peças SA"
              value={razaoSocial}
              onChange={e => setRazaoSocial(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-[var(--color-surface-sunken)] border border-[var(--color-border-subtle)] rounded-xl text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-primary-blue)]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-[var(--color-text-primary)] block mb-1.5">CNPJ</label>
              <input
                type="text"
                placeholder="00.000.000/0001-00"
                value={cnpj}
                onChange={e => setCnpj(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-[var(--color-surface-sunken)] border border-[var(--color-border-subtle)] rounded-xl text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-primary-blue)]"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-[var(--color-text-primary)] block mb-1.5">Nome do Contato</label>
              <input
                type="text"
                placeholder="Nome completo"
                value={contato}
                onChange={e => setContato(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-[var(--color-surface-sunken)] border border-[var(--color-border-subtle)] rounded-xl text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-primary-blue)]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-[var(--color-text-primary)] block mb-1.5">Telefone / WhatsApp</label>
              <input
                type="text"
                placeholder="(11) 90000-0000"
                value={telefone}
                onChange={e => setTelefone(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-[var(--color-surface-sunken)] border border-[var(--color-border-subtle)] rounded-xl text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-primary-blue)]"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-[var(--color-text-primary)] block mb-1.5">E-mail Comercial</label>
              <input
                type="email"
                placeholder="pedidos@empresa.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-[var(--color-surface-sunken)] border border-[var(--color-border-subtle)] rounded-xl text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-primary-blue)]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-[var(--color-text-primary)] block mb-1.5">Prazo de Entrega</label>
              <input
                type="text"
                placeholder="Ex: 3 dias úteis"
                value={prazoEntrega}
                onChange={e => setPrazoEntrega(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-[var(--color-surface-sunken)] border border-[var(--color-border-subtle)] rounded-xl text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-primary-blue)]"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-[var(--color-text-primary)] block mb-1.5">Linhas / Categorias</label>
              <input
                type="text"
                placeholder="Ex: Acessórios, Cabos"
                value={categorias}
                onChange={e => setCategorias(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-[var(--color-surface-sunken)] border border-[var(--color-border-subtle)] rounded-xl text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-primary-blue)]"
              />
            </div>
          </div>
        </form>
      </Modal>
    </PageContainer>
  );
}
