import { Card } from "../../../../components/ui/card";
import { Badge } from "../../../../components/ui/badge";
import { Input } from "../../../../components/ui/input";
import { EmptyState } from "../../../../components/ui/empty-state";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "../../../../components/ui/table";
import { FileText, Search, Edit2, Trash2, ChevronRight } from "lucide-react";

interface Contract {
  id: string;
  client: string;
  plan: string;
  mrr: string | number;
  status: string;
  date: string;
  progress?: number;
}

interface ContractsTableProps {
  contracts: Contract[];
  searchQuery: string;
  onSearchChange: (v: string) => void;
  onDelete: (id: string) => void;
}

function statusBadgeVariant(status: string): "success" | "warning" | "destructive" | "secondary" {
  if (status === "Ativo") return "success";
  if (status === "Inadimplente") return "warning";
  if (status === "Cancelado") return "destructive";
  return "secondary";
}

export function ContractsTable({ contracts, searchQuery, onSearchChange, onDelete }: ContractsTableProps) {
  const filtered = contracts.filter(c =>
    c.client.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.plan.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Card className="overflow-hidden">
      <div className="p-4 border-b border-[var(--color-border-subtle)] flex gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-faint)]" />
          <Input
            type="text"
            placeholder="Buscar contratos..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>
        <select className="bg-[var(--color-surface-elevated)] border border-[var(--color-border-default)] rounded-[var(--radius-control)] px-4 py-2 text-sm text-[var(--color-text-primary)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-blue)]">
          <option>Todos os Planos</option>
          <option>Enterprise</option>
          <option>Pro</option>
          <option>Starter</option>
        </select>
      </div>
      {filtered.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Nenhum contrato encontrado"
          description="Ajuste a busca ou cadastre um novo contrato"
          className="border-none rounded-none"
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead>Plano</TableHead>
              <TableHead>MRR</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Assinatura</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((contract) => (
              <TableRow key={contract.id} className="group cursor-pointer">
                <TableCell>
                  <div className="font-semibold text-[var(--color-text-primary)] group-hover:text-accent transition-colors flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-[var(--color-primary-blue)]/10 border border-[var(--color-primary-blue)]/20 flex items-center justify-center shrink-0">
                      <FileText className="w-3.5 h-3.5 text-[var(--color-primary-blue)]" />
                    </div>
                    {contract.client}
                  </div>
                </TableCell>
                <TableCell className="font-medium text-[var(--color-text-muted)]">{contract.plan}</TableCell>
                <TableCell className="font-mono font-medium text-success">{contract.mrr}</TableCell>
                <TableCell>
                  <Badge variant={statusBadgeVariant(contract.status)}>{contract.status}</Badge>
                </TableCell>
                <TableCell className="text-[var(--color-text-muted)] text-xs">
                  <div className="flex flex-col justify-center gap-1.5 h-[36px]">
                    {contract.date}
                    <div className="w-24 h-1 bg-[var(--color-border-default)] rounded-full overflow-hidden">
                      <div className="h-full bg-[var(--color-primary-blue)]" style={{ width: `${contract.progress ?? 100}%` }} />
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button className="p-2 bg-[var(--color-surface-sunken)] border border-[var(--color-border-subtle)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-elevated)] hover:border-[var(--color-border-default)] rounded-md transition-colors">
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onDelete(contract.id)}
                      className="p-2 bg-[var(--color-surface-sunken)] border border-[var(--color-border-subtle)] text-[var(--color-text-muted)] hover:text-danger hover:bg-danger/10 hover:border-danger/25 rounded-md transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <button className="p-2 bg-[var(--color-surface-sunken)] border border-[var(--color-border-subtle)] text-[var(--color-text-muted)] hover:text-accent hover:bg-accent/10 hover:border-accent/25 rounded-md transition-colors ml-1">
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Card>
  );
}
