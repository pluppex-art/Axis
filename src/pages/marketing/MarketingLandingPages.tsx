import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageContainer } from "../../components/PageContainer";
import { Card } from "../../components/ui/card";
import { Globe, Plus, Link as LinkIcon, Pencil, ExternalLink } from "lucide-react";
import { Button } from "../../components/ui/button";
import { motion } from "motion/react";
import { toast } from "sonner";
import { useData } from "../../contexts/DataContext";
import { confirmDialog } from "../../components/ui/confirm-dialog";
import { LandingPageCard } from "./components/LandingPages/LandingPageCard";
import { LandingPageCreateModal } from "./components/LandingPages/LandingPageCreateModal";
import { LandingPageTrackingModal } from "./components/LandingPages/LandingPageTrackingModal";

const PREVIEW_URL = "https://escolaempreendamais.pluppex.com.br";

export default function MarketingLandingPages() {
  const navigate = useNavigate();
  const { marketingLandingPages: pages, addMarketingLandingPage, updateMarketingLandingPage, deleteMarketingLandingPage } = useData();

  const [isTrackingModalOpen, setIsTrackingModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedPage, setSelectedPage] = useState<any>(null);
  const [newName, setNewName] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [pixelId, setPixelId] = useState("");
  const [gtagId, setGtagId] = useState("");

  const toggleStatus = (id: string) => {
    const page = pages.find(p => p.id === id);
    if (!page) return;
    const newStatus = page.status === 'published' ? 'draft' : 'published';
    updateMarketingLandingPage(id, { status: newStatus });
    toast.success(`Página alterada para: ${newStatus === 'published' ? 'Publicada' : 'Rascunho'}`);
  };

  const openTrackingModal = (page: any) => {
    setSelectedPage(page);
    setPixelId(page.meta_pixel_id || "");
    setGtagId(page.google_analytics_id || "");
    setIsTrackingModalOpen(true);
  };

  const handleCreatePage = (e: { preventDefault(): void }) => {
    e.preventDefault();
    if (!newName || !newSlug) { toast.error("Preencha todos os campos obrigatórios."); return; }
    addMarketingLandingPage({
      name: newName,
      url: `lp.seussistema.com/${newSlug.replace(/\s+/g, "-").toLowerCase()}`,
      status: "published", views: 0, conversions: 0, conversion_rate: 0,
      meta_pixel_id: pixelId, google_analytics_id: gtagId
    });
    toast.success("Landing Page criada e publicada com sucesso!");
    setIsCreateModalOpen(false);
    setNewName(""); setNewSlug(""); setPixelId(""); setGtagId("");
  };

  const handleDeletePage = async (id: string) => {
    const page = pages.find((p: any) => p.id === id);
    if (!(await confirmDialog({
      title: "Excluir landing page",
      description: `Excluir a página "${page?.name || "selecionada"}"? Essa ação não pode ser desfeita.`,
    }))) return;
    deleteMarketingLandingPage(id);
    toast.success("Página excluída com sucesso.");
  };

  const handleSaveTracking = async () => {
    if (!selectedPage) return;
    await updateMarketingLandingPage(selectedPage.id, { meta_pixel_id: pixelId, google_analytics_id: gtagId });
    setIsTrackingModalOpen(false);
  };

  return (
    <PageContainer
      title="Landing Pages"
      subtitle="Crie e publique páginas de captura. Rastreamento automático de visitas/conversões ainda não está disponível — os números abaixo precisam ser atualizados manualmente."
    >
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-black text-white">Suas Páginas ({pages.length})</h3>
        <Button onClick={() => setIsCreateModalOpen(true)} className="bg-[#2563EB] hover:bg-blue-600 shadow-xl gap-2 font-bold text-xs uppercase tracking-wider px-6 rounded-xl h-11">
          <Plus className="w-4 h-4" /> Criar Página
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 mb-2">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="p-5 bg-gradient-to-r from-orange-500/5 to-transparent border border-orange-500/20 hover:border-orange-500/40 transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="flex items-start gap-4 flex-1">
              <div className="p-3 rounded-2xl bg-orange-500/10 border border-orange-500/20 text-orange-400 shrink-0">
                <Globe className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1">
                  <h4 className="font-bold text-white text-base">E-EMPREENDA+</h4>
                  <span className="text-[9px] font-black text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full uppercase">Online</span>
                  <span className="text-[9px] font-black text-orange-400 bg-orange-500/10 border border-orange-500/20 px-2 py-0.5 rounded-full uppercase">Conectado</span>
                </div>
                <a href={PREVIEW_URL} target="_blank" rel="noreferrer" className="text-xs text-blue-400 hover:text-blue-300 hover:underline flex items-center gap-1">
                  <LinkIcon className="w-3 h-3" /> {PREVIEW_URL.replace("https://", "")}
                </a>
              </div>
            </div>
            <div className="flex justify-end gap-2 shrink-0">
              <Button variant="ghost" size="icon" asChild className="hover:bg-white/5 text-slate-400 hover:text-white" title="Abrir site">
                <a href={PREVIEW_URL} target="_blank" rel="noreferrer"><ExternalLink className="w-4 h-4" /></a>
              </Button>
              <Button onClick={() => navigate("/app/marketing/landing-pages/eempreenda")}
                className="bg-orange-500 hover:bg-orange-600 text-white gap-2 font-bold text-xs uppercase tracking-wider px-5 rounded-xl h-9">
                <Pencil className="w-3.5 h-3.5" /> Editar Conteúdo
              </Button>
            </div>
          </Card>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {pages.map((page, index) => (
          <LandingPageCard
            key={page.id}
            page={page}
            index={index}
            onToggleStatus={toggleStatus}
            onOpenTracking={openTrackingModal}
            onEdit={(p) => {
              setSelectedPage(p);
              setNewName(p.name);
              setNewSlug(p.url.split('/').pop() || "");
              setPixelId(p.meta_pixel_id || "");
              setGtagId(p.google_analytics_id || "");
              setIsCreateModalOpen(true);
            }}
            onDelete={handleDeletePage}
          />
        ))}
      </div>

      <LandingPageCreateModal
        isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)}
        newName={newName} setNewName={setNewName}
        newSlug={newSlug} setNewSlug={setNewSlug}
        pixelId={pixelId} setPixelId={setPixelId}
        gtagId={gtagId} setGtagId={setGtagId}
        onSubmit={handleCreatePage}
      />
      <LandingPageTrackingModal
        isOpen={isTrackingModalOpen} onClose={() => setIsTrackingModalOpen(false)}
        selectedPage={selectedPage}
        pixelId={pixelId} setPixelId={setPixelId}
        gtagId={gtagId} setGtagId={setGtagId}
        onSave={handleSaveTracking}
      />
    </PageContainer>
  );
}
