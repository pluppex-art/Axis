import { useState, useEffect, useMemo, useRef } from "react";
import { Button } from "../../components/ui/button";
import { Plus } from "lucide-react";
import { NovoClienteModal } from "../../components/ui/modals/crm/NovoClienteModal";
import { ClienteContatosModal } from "../../components/ui/modals/crm/ClienteContatosModal";
import { toast } from "sonner";
import { confirmDialog } from "../../components/ui/confirm-dialog";
import { PageContainer } from "../../components/PageContainer";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../contexts/AuthContext";
import { apiFetch } from "../../lib/apiClient";
import { ClientesKPIs } from "./components/Clientes/ClientesKPIs";
import { ClientesList } from "./components/Clientes/ClientesList";

export default function Clientes() {
  const { activeTenantId } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [contatosClienteId, setContatosClienteId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("Todos as situações");
  const [sectorFilter, setSectorFilter] = useState("Todos os setores");
  const [searchQuery, setSearchQuery] = useState("");

  // Supabase (clientes) é a fonte de verdade — a busca completa abaixo
  // sempre roda e sempre tem a palavra final. GET /api/crm/clientes-list
  // (Redis-SPY, TTL de 20s) só adianta uma prévia enquanto ela não termina.
  const [clientes, setClientes] = useState<any[]>([]);
  const authoritativeLoadedRef = useRef(false);

  useEffect(() => {
    if (!activeTenantId) return;
    let cancelled = false;
    authoritativeLoadedRef.current = false;

    apiFetch(`/api/crm/clientes-list?tenantId=${encodeURIComponent(activeTenantId)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (cancelled || authoritativeLoadedRef.current || !json?.data) return;
        setClientes(json.data);
      })
      .catch(() => { /* silencioso — a busca completa abaixo segue normalmente */ });

    if (!supabase) return;
    // Sem o filtro de tenant, contas de parceiro (has_tenant_access verdadeiro
    // pra vários tenants) recebiam via RLS linhas de todos os tenants acessíveis
    // misturadas numa única lista.
    supabase.from("clientes").select("*").eq("tenant_id", activeTenantId).order("created_at", { ascending: false }).then(({ data, error }) => {
      if (cancelled) return;
      authoritativeLoadedRef.current = true;
      if (error) toast.error(`Erro ao carregar clientes: ${error.message}`);
      else if (data) setClientes(data);
    });

    return () => { cancelled = true; };
  }, [activeTenantId]);

  const kpis = useMemo(() => ({
    total:       clientes.length,
    ativos:      clientes.filter(c => c.status === "Ativo").length,
    implantacao: clientes.filter(c => c.status === "Em Implantação").length,
    inativos:    clientes.filter(c => c.status === "Inativo").length,
  }), [clientes]);

  const handleCreateCliente = async (data: any) => {
    if (!data.nome) { toast.error("Nome da empresa é obrigatório."); return; }
    if (!supabase) { toast.error("Supabase não configurado."); return; }
    if (!activeTenantId) { toast.error("Tenant não identificado."); return; }
    const newClient = {
      name: data.nome,
      industry: data.industry || "Tecnologia",
      city: data.cidade || "São Paulo",
      state: (data.estado || "SP").toUpperCase(),
      phone: data.telefone || "(11) 99999-9999",
      email: data.email || "contato@empresa.com",
      documento: data.documento || null,
      status: "Ativo",
      tenant_id: activeTenantId,
    };

    const { data: inserted, error } = await supabase.from("clientes").insert(newClient).select().maybeSingle();
    if (error) { toast.error(`Erro ao cadastrar cliente: ${error.message}`); return; }
    if (inserted) setClientes(prev => [inserted, ...prev]);
    toast.success("Cliente cadastrado com sucesso!");
    setIsModalOpen(false);
  };

  const handleDeleteCliente = async (id: string) => {
    if (!supabase) { toast.error("Supabase não configurado."); return; }
    const alvo = clientes.find(c => c.id === id);
    if (!(await confirmDialog({
      title: "Excluir cliente",
      description: `Excluir ${alvo?.name || "este cliente"} da base de clientes? Essa ação não pode ser desfeita.`,
    }))) return;
    const { error } = await supabase.from("clientes").delete().eq("id", id);
    if (error) { toast.error(`Erro ao remover cliente: ${error.message}`); return; }
    setClientes(prev => prev.filter(c => c.id !== id));
    toast.success("Cliente removido com sucesso!");
  };

  return (
    <PageContainer
      title="Base de Clientes S.P.Y."
      description="Gerencie a carteira de clientes ativos e em implantação de forma inteligente."
      actions={
        <Button 
          onClick={() => setIsModalOpen(true)} 
          className="h-9 px-4 text-xs font-bold gap-1.5 shadow-xs"
        >
          <Plus className="w-3.5 h-3.5" /> Novo Cliente
        </Button>
      }
    >
      <ClientesKPIs {...kpis} />

      <ClientesList
        clientes={clientes}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        sectorFilter={sectorFilter}
        onSectorChange={setSectorFilter}
        statusFilter={statusFilter}
        onStatusChange={setStatusFilter}
        onDelete={handleDeleteCliente}
        onManageContatos={setContatosClienteId}
      />

      <NovoClienteModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onAction={handleCreateCliente}
      />

      <ClienteContatosModal
        isOpen={!!contatosClienteId}
        onClose={() => setContatosClienteId(null)}
        clienteId={contatosClienteId}
        clienteNome={clientes.find(c => c.id === contatosClienteId)?.name}
      />
    </PageContainer>
  );
}
