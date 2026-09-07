import { useState } from "react";
import { useData } from "../../../contexts/DataContext";
import { toast } from "sonner";

export interface TeamMember {
  id?: string;
  name: string;
  role: string;
  email: string;
  phone: string;
  deals: number;
  revenue: string;
  status: string;
  squad: string;
}

export interface Squad {
  name: string;
  leader: string;
}

export interface AuditLog {
  name: string;
  from: string;
  to: string;
  date: string;
}

function rowToMember(row: any, idx: number): TeamMember {
  return {
    id: String(row.id || `colab-${idx + 1}`),
    name: row.nome || row.name || 'Colaborador',
    role: row.cargo || row.role || 'Geral',
    email: row.email || '',
    phone: row.phone || '',
    deals: row.deals || 0,
    revenue: row.revenue || 'R$ 0',
    status: row.status || 'Ativo',
    squad: row.squad || 'Sem squad',
  };
}

export function useEquipe() {
  const { colaboradores, addColaborador, updateColaborador, deleteColaborador, squads: dataSquads, addSquad: dataAddSquad } = useData();

  const [activeTab, setActiveTab] = useState("visao-geral");
  const [memberSearch, setMemberSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSquadModalOpen, setIsSquadModalOpen] = useState(false);
  const [newSquadExpanded, setNewSquadExpanded] = useState(false);
  const [newSquadData, setNewSquadData] = useState({ name: "", leader: "" });
  const [expandedSquads, setExpandedSquads] = useState<string[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);

  // Squads come from DataContext (single source of truth)
  const squads: Squad[] = dataSquads.map(s => ({
    name: s.nome,
    leader: s.leader || '',
  }));

  // Team derived from DataContext colaboradores
  const team = colaboradores.map(rowToMember);

  const addMember = async (member: TeamMember) => {
    await addColaborador({
      id: member.id || `colab-${Date.now()}`,
      nome: member.name,
      cargo: member.role,
      email: member.email,
      phone: member.phone,
      deals: member.deals || 0,
      revenue: member.revenue || "R$ 0",
      status: member.status || "Ativo",
      squad: member.squad || "Sem squad",
    });
  };

  const editMember = async (id: string, member: Partial<TeamMember>) => {
    await updateColaborador(id, {
      ...(member.name !== undefined ? { nome: member.name } : {}),
      ...(member.role !== undefined ? { cargo: member.role } : {}),
      ...(member.email !== undefined ? { email: member.email } : {}),
      ...(member.phone !== undefined ? { phone: member.phone } : {}),
      ...(member.status !== undefined ? { status: member.status } : {}),
      ...(member.squad !== undefined ? { squad: member.squad } : {}),
    });
  };

  const removeMember = async (id: string) => {
    await deleteColaborador(id);
    toast.info("Colaborador removido da equipe.");
  };

  const toggleMemberStatus = async (id: string, currentStatus: string) => {
    const nextStatus = currentStatus === "Ativo" ? "Inativo" : "Ativo";
    await updateColaborador(id, { status: nextStatus });
    toast.success(`Colaborador marcado como ${nextStatus}!`);
  };

  const addSquad = async (squad: Squad) => {
    await dataAddSquad({
      nome: squad.name,
      leader: squad.leader,
      departamento: 'Geral',
      focoComercial: '',
      membros: [],
    });
  };

  const toggleSquad = (squadName: string) => {
    setExpandedSquads(prev =>
      prev.includes(squadName) ? prev.filter(n => n !== squadName) : [...prev, squadName]
    );
  };

  const [filter, setFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  const filteredLogs = logs.filter(l =>
    l.name.toLowerCase().includes(filter.toLowerCase()) ||
    l.date.includes(filter)
  );

  const filteredTeam = team.filter(m =>
    m.name.toLowerCase().includes(memberSearch.toLowerCase()) ||
    m.role.toLowerCase().includes(memberSearch.toLowerCase()) ||
    m.squad.toLowerCase().includes(memberSearch.toLowerCase())
  );

  const paginatedLogs = filteredLogs.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage);

  const moveMember = (name: string, newSquad: string) => {
    const member = team.find(m => m.name === name);
    if (!member || member.squad === newSquad) return;
    setLogs(prev => [{ name, from: member.squad, to: newSquad, date: new Date().toISOString().split('T')[0] }, ...prev]);
  };

  return {
    activeTab,
    setActiveTab,
    memberSearch,
    setMemberSearch,
    isModalOpen,
    setIsModalOpen,
    isSquadModalOpen,
    setIsSquadModalOpen,
    newSquadExpanded,
    setNewSquadExpanded,
    newSquadData,
    setNewSquadData,
    expandedSquads,
    setExpandedSquads,
    squads,
    team,
    logs,
    setLogs,
    toggleSquad,
    filter,
    setFilter,
    currentPage,
    setCurrentPage,
    itemsPerPage,
    filteredLogs,
    filteredTeam,
    paginatedLogs,
    totalPages,
    moveMember,
    addMember,
    editMember,
    removeMember,
    toggleMemberStatus,
    addSquad,
  };
}
