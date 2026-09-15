import { useState } from "react";
import { Button } from "../../components/ui/button";
import { Modal } from "../../components/ui/modal";
import { Input } from "../../components/ui/input";
import { FormField } from "../../components/ui/form-field";
import { ConfirmModal } from "../../components/ui/modals/shared/ConfirmModal";
import { Plus } from "lucide-react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useData } from "../../contexts/DataContext";
import { useAuth } from "../../contexts/AuthContext";
import { ContractsKPIs } from "./components/Contracts/ContractsKPIs";
import { ContractsTable } from "./components/Contracts/ContractsTable";
import { handleDownloadPdf } from "./utils/proposalPdf";
import { parseCurrencyBR as toNumberMRR } from "../../lib/utils";
import type { Contract } from "../../types";

const contractSchema = z.object({
  cliente: z.string().min(1, "O cliente é obrigatório"),
  plano:   z.string().min(1, "O plano é obrigatório"),
  valor:   z.string().refine((val) => {
    const clean = val.replace(/[^0-9,.]/g, "");
    return !isNaN(parseFloat(clean.replace(",", "."))) && clean.length > 0;
  }, "Formato de valor inválido. Use formato monetário, ex: 1500,00"),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Insira uma data válida"),
});
type ContractFormData = z.infer<typeof contractSchema>;

export default function Contracts() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingContract, setEditingContract] = useState<Contract | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [contractToDelete, setContractToDelete] = useState<string | null>(null);
  const { contracts, addContract, updateContract, deleteContract, appSettings } = useData();
  const { activeTenantName } = useAuth();

  const { register, handleSubmit, formState: { errors }, reset } = useForm<ContractFormData>({
    resolver: zodResolver(contractSchema),
  });

  const isEditing = !!editingContract;

  const onSubmit = (data: ContractFormData) => {
    const formattedData = data.data.split("-").reverse().join("/");
    const cleanValue = parseFloat(data.valor.replace(/[^0-9,.]/g, "").replace(",", "."));
    const formattedValue = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 }).format(cleanValue);
    if (isEditing && editingContract) {
      updateContract(editingContract.id, { client: data.cliente, plan: data.plano, mrr: formattedValue, date: formattedData });
      toast.success("Contrato atualizado com sucesso!");
    } else {
      addContract({ client: data.cliente, plan: data.plano, mrr: formattedValue, status: "Ativo", date: formattedData, progress: 100 });
      toast.success("Contrato criado com sucesso!");
    }
    reset();
    setIsModalOpen(false);
    setEditingContract(null);
  };

  const handleModalClose = () => { setIsModalOpen(false); setEditingContract(null); reset(); };

  const handleEditContract = (contract: Contract) => {
    setEditingContract(contract);
    const [dd, mm, yyyy] = (contract.date || "").split("/");
    reset({
      cliente: contract.client,
      plano: contract.plan,
      valor: String(typeof contract.mrr === "number" ? contract.mrr : contract.mrr).replace(/[^\d,.-]/g, ""),
      data: dd && mm && yyyy ? `${yyyy}-${mm}-${dd}` : "",
    });
    setIsModalOpen(true);
  };

  // Mesmo gerador/branding (logo do tenant) já usado no PDF de Propostas — o
  // contrato é montado como uma "Proposta" equivalente pra reaproveitar o
  // layout, em vez de duplicar a lógica de PDF com um visual diferente.
  const handleContractPdf = (contract: Contract) => {
    const empresaDados = appSettings?.empresa_dados || {};
    const mrrNumber = typeof contract.mrr === "number"
      ? contract.mrr
      : parseFloat(String(contract.mrr).replace(/[^\d,.-]/g, "").replace(",", ".")) || 0;
    handleDownloadPdf(
      {
        id: contract.id,
        cliente: contract.client,
        titulo: contract.plan,
        valor: mrrNumber,
        created_at: undefined,
        validade: undefined,
        status: contract.status === "Ativo" ? "Aceita" : "Enviada",
        vendedor: activeTenantName || "S.P.Y.",
      } as any,
      [],
      { logoUrl: empresaDados?.logoUrl, tenantName: activeTenantName }
    );
  };

  const totalMRR = contracts.filter(c => c.status !== "Cancelado").reduce((acc, curr) => acc + toNumberMRR(curr.mrr), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Gestão de Contratos</h1>
          <p className="text-sm text-[var(--color-text-muted)]">Contratos ativos, MRR e saúde financeira.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="gap-2">Exportar CSV</Button>
          <Button onClick={() => setIsModalOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" /> Novo Contrato
          </Button>
        </div>
      </div>

      <ContractsKPIs
        totalMRR={totalMRR}
        ativos={contracts.filter(c => c.status === "Ativo").length}
        inadimplentes={contracts.filter(c => c.status === "Inadimplente").length}
      />

      <ContractsTable
        contracts={contracts}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onDelete={(id) => setContractToDelete(id)}
        onEdit={handleEditContract}
        onDownloadPdf={handleContractPdf}
      />

      <Modal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        title={isEditing ? "Editar Contrato" : "Novo Contrato"}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={handleModalClose}>Cancelar</Button>
            <Button onClick={handleSubmit(onSubmit)}>{isEditing ? "Salvar Alterações" : "Salvar Contrato"}</Button>
          </div>
        }
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <FormField label="Cliente" error={errors.cliente?.message}>
            <select {...register("cliente")} className="w-full h-10 rounded-[var(--radius-control)] border border-[var(--color-border-default)] bg-[var(--color-surface-elevated)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-blue)]">
              <option value="">Selecione o Cliente</option>
              <option value="TechCorp Brasil">TechCorp Brasil</option>
              <option value="Construtora RS">Construtora RS</option>
              <option value="Clínica Vida">Clínica Vida</option>
              <option value="Mendes Consultoria">Mendes Consultoria</option>
            </select>
          </FormField>
          <FormField label="Plano Acordado" error={errors.plano?.message}>
            <select {...register("plano")} className="w-full h-10 rounded-[var(--radius-control)] border border-[var(--color-border-default)] bg-[var(--color-surface-elevated)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-blue)]">
              <option value="">Selecione o Plano</option>
              <option value="Starter">Starter</option>
              <option value="Pro">Pro</option>
              <option value="Enterprise">Enterprise</option>
              <option value="Consultoria Avulsa">Consultoria Avulsa</option>
            </select>
          </FormField>
          <FormField label="Valor (MRR)" error={errors.valor?.message}>
            <Input type="text" {...register("valor")} placeholder="Ex: 1500,00" />
          </FormField>
          <FormField label="Data de Assinatura" error={errors.data?.message}>
            <Input type="date" {...register("data")} />
          </FormField>
        </form>
      </Modal>

      <ConfirmModal
        isOpen={contractToDelete !== null}
        onClose={() => setContractToDelete(null)}
        onConfirm={() => {
          if (contractToDelete) {
            deleteContract(contractToDelete);
            toast.success("Contrato excluído com sucesso!");
          }
        }}
        title="Confirmar Exclusão de Contrato"
        message="Tem certeza de que deseja remover permanentemente este contrato? Os dados associados não poderão ser recuperados."
      />
    </div>
  );
}
