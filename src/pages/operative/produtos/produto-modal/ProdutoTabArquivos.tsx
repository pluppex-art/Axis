import { useState } from "react";
import { Download, FileText, Image, FileSpreadsheet, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "../../../../lib/supabase";
import { ProductAttachment } from "../../../../types";
import { confirmDialog } from "../../../../components/ui/confirm-dialog";

interface ProdutoTabArquivosProps {
  attachments: ProductAttachment[];
  setAttachments: React.Dispatch<React.SetStateAction<ProductAttachment[]>>;
  productId: string;
  tenantId?: string;
}

export function ProdutoTabArquivos({ attachments, setAttachments, productId, tenantId }: ProdutoTabArquivosProps) {
  const [uploading, setUploading] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    e.target.value = "";
    if (!files || files.length === 0 || !supabase) return;
    if (!tenantId || !productId) {
      toast.error("Não foi possível identificar o tenant/produto para o upload.");
      return;
    }

    setUploading(true);
    try {
      const uploaded: ProductAttachment[] = [];
      for (const file of Array.from(files)) {
        const path = `${tenantId}/${productId}/${Date.now()}-${file.name}`;
        const { error: uploadError } = await supabase.storage.from("products").upload(path, file, { upsert: true });
        if (uploadError) throw uploadError;
        const { data } = supabase.storage.from("products").getPublicUrl(path);
        uploaded.push({
          name: file.name,
          size: (file.size / (1024 * 1024)).toFixed(2) + " MB",
          date: new Date().toLocaleDateString("pt-BR"),
          type: file.name.split('.').pop() || "unknown",
          url: data.publicUrl,
          path,
        });
      }
      setAttachments(prev => [...prev, ...uploaded]);
      toast.success("Arquivo(s) adicionados com sucesso!");
    } catch (err: any) {
      toast.error(`Falha ao enviar arquivo: ${err.message || err}`);
    } finally {
      setUploading(false);
    }
  };

  const removeAttachment = async (idx: number) => {
    const file = attachments[idx];
    if (!(await confirmDialog({
      title: "Remover anexo",
      description: `Remover o arquivo "${file.name}"? Essa ação não pode ser desfeita.`,
    }))) return;
    setAttachments(prev => prev.filter((_, i) => i !== idx));
    if (supabase && file.path) {
      try {
        await supabase.storage.from("products").remove([file.path]);
      } catch (err) {
        console.error("Falha ao remover arquivo do Storage:", err);
      }
    }
    toast.info("Anexo removido.");
  };

  return (
    <div className="space-y-5">
      <div className="bg-[var(--color-surface-elevated)] border border-white/5 p-4 rounded-xl flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-pink-500/10 flex items-center justify-center text-pink-400 shrink-0 font-black text-xs font-mono">4</div>
        <div>
          <h4 className="text-xs font-black text-white uppercase tracking-wider">Mídia & Documentação Relacionada</h4>
          <p className="text-[10px] text-slate-500">Adicione catálogos PDF, manuais técnicos ou imagens.</p>
        </div>
      </div>

      <div className="relative border border-dashed border-[#2563EB]/20 bg-[var(--color-surface-elevated)]/30 hover:bg-[var(--color-surface-elevated)]/50 rounded-2xl p-6 flex flex-col items-center justify-center text-center transition-all cursor-pointer group">
        <input type="file" multiple onChange={handleFileChange} disabled={uploading} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-wait" />
        <div className="w-12 h-12 rounded-full bg-[#2563EB]/10 flex items-center justify-center text-[#2563EB] mb-3 group-hover:scale-110 transition-transform">
          {uploading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Download className="w-6 h-6" />}
        </div>
        <span className="text-slate-200 text-xs font-bold block">{uploading ? "Enviando..." : "Arraste arquivos ou clique para pesquisar"}</span>
        <span className="text-[10px] text-slate-500 mt-1.5 block max-w-sm">Suporta PDF, PNG, JPG, DOCX ou XLSX de até 25MB.</span>
      </div>

      <div className="space-y-2.5">
        <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Arquivos Anexados ({attachments.length})</h5>
        {attachments.length === 0 ? (
          <p className="text-xs text-slate-500 italic p-4 bg-[var(--color-surface-elevated)]/20 border border-white/5 rounded-xl text-center">Nenhum anexo registrado.</p>
        ) : (
          <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
            {attachments.map((file, idx) => {
              const isPDF = file.type === "pdf";
              const isImage = ["png", "jpg", "jpeg", "gif"].includes(file.type);
              return (
                <div key={idx} className="flex items-center justify-between p-3 bg-[var(--color-surface-elevated)] border border-white/5 rounded-xl hover:border-[#2563EB]/25 transition-all">
                  <a href={file.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 min-w-0 flex-1">
                    <div className={`p-2 rounded-lg ${isPDF ? "bg-rose-500/10 text-rose-400" : isImage ? "bg-amber-500/10 text-amber-400" : "bg-blue-500/10 text-blue-400"}`}>
                      {isPDF ? <FileText className="w-4 h-4" /> : isImage ? <Image className="w-4 h-4" /> : <FileSpreadsheet className="w-4 h-4" />}
                    </div>
                    <div className="min-w-0">
                      <span className="block text-xs font-bold text-white truncate max-w-[280px]">{file.name}</span>
                      <span className="text-[9px] font-mono text-slate-500 block">Tamanho: {file.size} • Adicionado em {file.date}</span>
                    </div>
                  </a>
                  <button type="button" onClick={() => removeAttachment(idx)}
                    className="text-slate-500 hover:text-rose-400 bg-rose-500/5 hover:bg-rose-500/10 p-1.5 rounded-lg transition-all shrink-0" title="Remover arquivo">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
