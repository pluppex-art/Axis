import { useState } from 'react';
import { GitBranch, GitFork, Star, Lock, Globe, Plus, Search, Clock, Code2, Archive, CheckCircle2, ExternalLink, Unlink } from 'lucide-react';
import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { PageContainer } from "../../components/PageContainer";
import { NovoRepositorioDevModal, type NovoRepositorioPayload } from "./modals/NovoRepositorioDevModal";
import { ConectarGitHubModal } from "./modals/ConectarGitHubModal";
import { useDevRepositorios } from "./hooks/useDevRepositorios";
import { useAuth } from "../../contexts/AuthContext";

const LANG_COLORS: Record<string, string> = {
  TypeScript: '#3B82F6',
  JavaScript: '#F59E0B',
  Python: '#10B981',
  Go: '#06B6D4',
  Rust: '#F97316',
  'C#': '#8B5CF6',
  Dart: '#22D3EE',
};

const STATUS_STYLE: Record<string, string> = {
  ativo: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
  'em desenvolvimento': 'bg-blue-500/15 text-blue-400 border-blue-500/25',
  arquivado: 'bg-slate-500/15 text-slate-400 border-slate-500/25',
};

export default function Repositorios() {
  const { user, activeTenantId } = useAuth();
  const { repos, addRepo, githubConn, setGithubConn, disconnectGitHub } = useDevRepositorios();
  const [search, setSearch] = useState('');
  const [filterVisibility, setFilterVisibility] = useState<'todos' | 'public' | 'private'>('todos');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isGitHubModalOpen, setIsGitHubModalOpen] = useState(false);

  const handleSaveRepo = async (data: NovoRepositorioPayload) => {
    await addRepo(data);
  };

  const handleGitHubConnected = (username: string) => {
    setGithubConn({ username, avatar: '', connected_at: new Date().toISOString() });
  };

  const filtered = repos.filter(r => {
    const matchSearch = r.name.toLowerCase().includes(search.toLowerCase()) || r.description.toLowerCase().includes(search.toLowerCase());
    const matchVis = filterVisibility === 'todos' || r.visibility === filterVisibility;
    return matchSearch && matchVis;
  });

  const totalStars = repos.reduce((s, r) => s + r.stars, 0);
  const totalPRs = repos.reduce((s, r) => s + r.openPRs, 0);
  const activeRepos = repos.filter(r => r.status !== 'arquivado').length;
  const ghRepos = repos.filter(r => r.fromGitHub).length;

  return (
    <PageContainer
      title="Repositórios"
      description="Gerencie todos os repositórios de código da organização."
      breadcrumb={[{ label: "Dev & Tecnologia", path: "/app/dev/painel" }, { label: "Repositórios" }]}
      actions={
        <div className="flex items-center gap-3">
          {githubConn ? (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl h-10 px-4">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">
                  @{githubConn.username}
                </span>
                {ghRepos > 0 && (
                  <span className="text-[9px] text-emerald-500/70 font-bold">· {ghRepos} repos</span>
                )}
              </div>
              <button
                onClick={disconnectGitHub}
                title="Desconectar GitHub"
                className="h-10 w-10 flex items-center justify-center rounded-xl border border-white/5 hover:bg-white/5 text-slate-500 hover:text-red-400 transition-colors"
              >
                <Unlink className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <Button
              variant="outline"
              onClick={() => setIsGitHubModalOpen(true)}
              className="h-10 rounded-xl border-white/5 text-[10px] font-black uppercase tracking-widest gap-2"
            >
              <GitFork className="w-4 h-4" /> Conectar GitHub
            </Button>
          )}
          <Button onClick={() => setIsModalOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl h-10 px-5 text-[10px] font-black uppercase tracking-widest gap-2">
            <Plus className="w-4 h-4" /> Novo Repo
          </Button>
        </div>
      }
    >
      <div className="space-y-6 pb-10">

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Repositórios", value: repos.length, icon: Code2, color: "text-indigo-500" },
            { label: "Ativos", value: activeRepos, icon: CheckCircle2, color: "text-emerald-500" },
            { label: "Stars Total", value: totalStars, icon: Star, color: "text-amber-500" },
            { label: "PRs em Aberto", value: totalPRs, icon: GitBranch, color: "text-blue-500" },
          ].map((s, i) => (
            <Card key={i} className="p-6 bg-[var(--color-surface-elevated)]/50 border hover:border-white/10 border-white/5 backdrop-blur-md transition-all">
              <s.icon className={`w-5 h-5 ${s.color} mb-4`} />
              <div className="text-2xl font-display font-black text-white mb-1 italic">{s.value}</div>
              <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{s.label}</div>
            </Card>
          ))}
        </div>

        {/* Filtros */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Buscar repositório..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-[var(--color-surface-elevated)] border border-white/5 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50"
            />
          </div>
          <div className="flex gap-2">
            {(['todos', 'private', 'public'] as const).map(v => (
              <button
                key={v}
                onClick={() => setFilterVisibility(v)}
                className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border flex items-center gap-1.5 ${filterVisibility === v ? 'bg-blue-600 text-white border-blue-500' : 'bg-white/[0.02] text-slate-400 border-white/5 hover:bg-white/[0.05]'}`}
              >
                {v === 'private' && <Lock className="w-3 h-3" />}
                {v === 'public' && <Globe className="w-3 h-3" />}
                {v === 'todos' ? 'Todos' : v === 'private' ? 'Privados' : 'Públicos'}
              </button>
            ))}
          </div>
        </div>

        {/* Lista */}
        <Card className="bg-[var(--color-surface-elevated)]/80 border-white/5 overflow-hidden">
          <div className="divide-y divide-white/5">
            {filtered.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-slate-500">
                <Code2 className="w-8 h-8 mb-3 opacity-30" />
                <p className="text-sm font-bold">Nenhum repositório encontrado</p>
              </div>
            )}
            {filtered.map(repo => (
              <div key={String(repo.id)} className="flex items-start gap-4 p-5 hover:bg-white/[0.02] transition-colors group cursor-pointer">
                <div className="p-2.5 rounded-xl bg-white/5 shrink-0">
                  {repo.status === 'arquivado'
                    ? <Archive className="w-4 h-4 text-slate-500" />
                    : <Code2 className="w-4 h-4 text-blue-400" />
                  }
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h4 className="text-sm font-black text-white group-hover:text-blue-300 transition-colors">
                      {repo.name}
                    </h4>
                    <div className={`flex items-center gap-1 text-[9px] font-black px-2 py-0.5 rounded border ${repo.visibility === 'private' ? 'bg-slate-500/10 text-slate-400 border-slate-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'}`}>
                      {repo.visibility === 'private' ? <Lock className="w-2.5 h-2.5" /> : <Globe className="w-2.5 h-2.5" />}
                      {repo.visibility}
                    </div>
                    <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-lg border ${STATUS_STYLE[repo.status] || ''}`}>
                      {repo.status}
                    </span>
                    {repo.fromGitHub && (
                      <span className="flex items-center gap-1 text-[9px] font-black px-2 py-0.5 rounded border bg-white/5 text-slate-400 border-white/8">
                        <GitFork className="w-2.5 h-2.5" /> GitHub
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-slate-400 mb-3 line-clamp-1">{repo.description}</p>

                  <div className="flex items-center gap-4 text-[10px] text-slate-500 font-bold flex-wrap">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: LANG_COLORS[repo.language] || '#64748B' }} />
                      {repo.language}
                    </div>
                    <div className="flex items-center gap-1">
                      <Star className="w-3 h-3" /> {repo.stars}
                    </div>
                    <div className="flex items-center gap-1">
                      <GitFork className="w-3 h-3" /> {repo.forks}
                    </div>
                    <div className="flex items-center gap-1">
                      <GitBranch className="w-3 h-3" /> {repo.branches} branches
                    </div>
                    {repo.openPRs > 0 && (
                      <div className="flex items-center gap-1 text-indigo-400">
                        <GitBranch className="w-3 h-3" /> {repo.openPRs} PRs abertos
                      </div>
                    )}
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {repo.lastCommit}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  {repo.contributors.length > 0 && (
                    <div className="flex -space-x-1.5">
                      {repo.contributors.slice(0, 3).map((c, i) => (
                        <div key={i} className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-[8px] font-black text-white border border-white/10">
                          {c.split('.')[0]}
                        </div>
                      ))}
                    </div>
                  )}
                  <span className="text-[10px] text-slate-500 hidden md:block">{repo.size}</span>
                  {repo.githubUrl ? (
                    <a
                      href={repo.githubUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={e => e.stopPropagation()}
                      className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 hover:border-blue-500/25 transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  ) : (
                    <button className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 hover:border-blue-500/25 transition-colors">
                      <ExternalLink className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <NovoRepositorioDevModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveRepo}
      />

      <ConectarGitHubModal
        isOpen={isGitHubModalOpen}
        onClose={() => setIsGitHubModalOpen(false)}
        onConnected={handleGitHubConnected}
        tenantId={activeTenantId || user?.tenantId}
      />
    </PageContainer>
  );
}
