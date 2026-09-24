import { motion, useScroll, useTransform, useSpring, useMotionValue } from "motion/react";
import { Link } from "react-router-dom";
import { 
  Zap, BarChart3, ShieldCheck, 
  Activity, Sparkles, ChevronRight,
  Cpu, GraduationCap, Component, Star
} from "lucide-react";
import { Button } from "../../components/ui/button";
import { useRef, useEffect } from "react";
import { HeroSection } from "./components/HeroSection";
import { NeuralSection } from "./components/NeuralSection";

export default function LandingPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll();
  
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const springConfig = { damping: 25, stiffness: 100 };
  const smoothMouseX = useSpring(mouseX, springConfig);
  const smoothMouseY = useSpring(mouseY, springConfig);

  const rotateX = useTransform(smoothMouseY, [-300, 300], [10, -10]);
  const rotateY = useTransform(smoothMouseX, [-300, 300], [-10, 10]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const { clientX, clientY } = e;
      const { innerWidth, innerHeight } = window;
      mouseX.set(clientX - innerWidth / 2);
      mouseY.set(clientY - innerHeight / 2);
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [mouseX, mouseY]);

  return (
    <div ref={containerRef} className="min-h-screen bg-[var(--color-surface)] text-[var(--color-text-primary)] font-sans selection:bg-blue-500/30 overflow-x-hidden relative">
      <div className="noise-overlay" />

      {/* Background System - Interactive Parallax */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <motion.div 
          style={{ 
            x: useTransform(smoothMouseX, (v) => v * -0.05),
            y: useTransform(smoothMouseY, (v) => v * -0.05)
          }}
          className="absolute inset-0 [mask-image:radial-gradient(ellipse_at_center,black,transparent)] opacity-[0.05]" 
        />
        <motion.div 
          style={{ 
            x: useTransform(smoothMouseX, (v) => v * 0.1),
            y: useTransform(smoothMouseY, (v) => v * 0.1)
          }}
          className="absolute top-[-10%] left-[-10%] w-[800px] h-[800px] bg-blue-600/10 blur-[160px] rounded-full" 
        />
        <motion.div 
          style={{ 
            x: useTransform(smoothMouseX, (v) => v * -0.15),
            y: useTransform(smoothMouseY, (v) => v * -0.15)
          }}
          className="absolute bottom-[-10%] right-[-10%] w-[900px] h-[900px] bg-indigo-600/10 blur-[180px] rounded-full" 
        />
      </div>

      {/* Futuristic Navbar */}
      <nav className="fixed top-0 w-full z-[110] px-3 py-3 sm:px-6 sm:py-6 lg:px-12 pointer-events-none">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 glass-card px-4 py-3 sm:px-8 sm:py-5 rounded-xl sm:rounded-[2.5rem] border-white/5 shadow-2xl pointer-events-auto">
          <motion.div 
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-2 sm:gap-4 group cursor-pointer shrink-0 pr-4 lg:pr-12"
          >
            <div className="w-8 h-8 sm:w-12 sm:h-12 bg-[#0B1120] border border-blue-500/30 rounded-lg sm:rounded-2xl flex items-center justify-center shadow-[0_0_25px_rgba(37,99,235,0.3)] group-hover:rotate-12 transition-transform duration-500 overflow-hidden p-1">
              <img src="/logo-icon.png" alt="S.P.Y. Icon" className="w-full h-full object-contain rounded-md" />
            </div>
            <span className="text-lg sm:text-3xl font-display font-black tracking-[-0.05em] group-hover:tracking-[0.05em] transition-all text-white">S.P.Y.</span>
          </motion.div>

          <div className="hidden lg:flex items-center justify-center gap-6 xl:gap-8 text-[10px] xl:text-[11px] font-black uppercase tracking-[0.2em] xl:tracking-[0.3em] text-slate-500 whitespace-nowrap flex-1">
            {["Explorar", "Neural", "Rede", "Planos"].map((item) => (
              <a key={item} href={`#${item.toLowerCase()}`} className="hover:text-blue-400 transition-all hover:scale-110">
                {item}
              </a>
            ))}
            
            <div className="relative group cursor-pointer inline-flex items-center">
               <span className="hover:text-amber-400 transition-all hover:scale-110 flex items-center gap-1 text-amber-500 shrink-0">
                  DEMOS_CAPTAÇÃO <ChevronRight className="w-3 h-3 rotate-90" />
               </span>
               <div className="absolute top-full left-0 mt-4 bg-[#0F172A]/90 backdrop-blur-xl border border-white/10 rounded-2xl p-3 w-64 shadow-2xl opacity-0 translate-y-4 pointer-events-none group-hover:opacity-100 group-hover:translate-y-0 group-hover:pointer-events-auto transition-all duration-300 z-[200]">
                  <Link to="/f/varejo" className="flex items-center gap-3 px-4 py-3 text-sm text-slate-300 hover:bg-white/5 hover:text-white rounded-xl transition-colors font-medium">🛒 Varejo</Link>
                  <Link to="/f/automotivo" className="flex items-center gap-3 px-4 py-3 text-sm text-slate-300 hover:bg-white/5 hover:text-white rounded-xl transition-colors font-medium">🚗 Automotivo</Link>
                  <Link to="/f/solar" className="flex items-center gap-3 px-4 py-3 text-sm text-slate-300 hover:bg-white/5 hover:text-white rounded-xl transition-colors font-medium">⚡ Energia Solar</Link>
                  <Link to="/f/imobiliaria" className="flex items-center gap-3 px-4 py-3 text-sm text-slate-300 hover:bg-white/5 hover:text-white rounded-xl transition-colors font-medium">🏢 Imobiliárias</Link>
                  <Link to="/f/clinica" className="flex items-center gap-3 px-4 py-3 text-sm text-slate-300 hover:bg-white/5 hover:text-white rounded-xl transition-colors font-medium">🏥 Clínicas Saúde</Link>
                  <Link to="/f/educacao" className="flex items-center gap-3 px-4 py-3 text-sm text-slate-300 hover:bg-white/5 hover:text-white rounded-xl transition-colors font-medium">🎓 Educação</Link>
               </div>
            </div>
          </div>

          <div className="flex items-center shrink-0 gap-2 sm:gap-4 pl-4 lg:pl-12">
            <Link to="/login" className="px-2 sm:px-4 py-2 sm:py-3 text-[9px] sm:text-xs font-black uppercase tracking-widest text-slate-400 hover:text-white transition-all hover:-translate-y-1">Acessar</Link>
            <Link to="/f/spy">
              <Button className="bg-[#F8FAFC] hover:bg-white text-black rounded-lg sm:rounded-[1.5rem] px-3 py-2.5 sm:px-8 sm:py-5 h-auto font-black uppercase tracking-widest text-[8px] sm:text-[11px] shadow-2xl shadow-blue-600/20 active:scale-95 transition-all shrink-0">
                Implantar
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      <main className="relative z-10 w-full">
        
        {/* Kinetic Hero Section Component */}
        <HeroSection rotateX={rotateX} rotateY={rotateY} />

        {/* The Interface Horizon - Depth Effect */}
        <section className="py-16 sm:py-32 lg:py-40 relative px-4 sm:px-6 perspective-1000">
           <motion.div 
             style={{ rotateX: 20 }}
             className="max-w-[1500px] mx-auto overflow-hidden rounded-3xl sm:rounded-[4rem] border border-white/10 bg-black/40 backdrop-blur-3xl shadow-[0_100px_200px_-50px_rgba(37,99,235,0.4)] relative p-4 sm:p-0 isolate"
           >
              <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent z-10 pointer-events-none" />
              <motion.img 
                initial={{ opacity: 0, scale: 1.2, y: 100 }}
                whileInView={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 1.5, ease: "easeOut" }}
                src="/logo-full.png" 
                alt="S.P.Y. Commercial Interface"
                className="w-full opacity-100 rounded-2xl sm:rounded-none p-4 sm:p-12 mix-blend-screen"
              />
              <div className="relative sm:absolute bottom-4 left-4 sm:bottom-10 sm:left-10 lg:bottom-20 lg:left-20 z-20 mt-4 sm:mt-0">
                 <div className="glass-card p-6 sm:p-10 rounded-2xl sm:rounded-[2.5rem] border-white/20 max-w-full sm:max-w-md">
                    <h3 className="text-xl sm:text-3xl font-display font-black mb-3 sm:mb-6 uppercase italic">Visualize o Futuro.</h3>
                    <p className="text-slate-400 text-xs sm:text-sm leading-relaxed mb-4 sm:mb-8">Nossa interface imersiva foi projetada para reduzir a carga cognitiva em 60%, permitindo que sua mente foque apenas no que importa: <span className="text-white font-bold italic">Crescimento Exponencial.</span></p>
                    <div className="flex gap-2 sm:gap-4">
                       <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-blue-500 animate-[pulse_2s_infinite]" />
                       <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-blue-500/30" />
                       <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-blue-500/10" />
                    </div>
                 </div>
              </div>
           </motion.div>
        </section>

        {/* Bento Vision - Interactive Grid */}
        <section id="explorar" className="py-12 sm:py-24 lg:py-32 px-4 sm:px-6 bg-[var(--color-surface)] relative border-t border-white/5">
           <div className="max-w-7xl mx-auto">
              <div className="flex flex-col lg:flex-row items-center justify-between mb-8 sm:mb-16 lg:mb-20 gap-8 lg:gap-16">
                 <div className="max-w-3xl">
                    <motion.span 
                       initial={{ letterSpacing: "1em", opacity: 0 }}
                       whileInView={{ letterSpacing: "0.5em", opacity: 1 }}
                       className="text-[10px] sm:text-[12px] font-black text-blue-500 uppercase mb-4 sm:mb-8 block"
                    >
                       ENGENHARIA_SUPERIOR
                    </motion.span>
                    <h2 className="text-4xl sm:text-6xl md:text-8xl font-display font-bold tracking-tighter mb-6 sm:mb-10 leading-[0.9] sm:leading-[0.85]">
                       MÓDULOS DE <br /><span className="text-blue-500">ALTA INTENSIDADE.</span>
                    </h2>
                 </div>
                 <motion.div 
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 40, ease: "linear" }}
                    className="relative w-28 h-28 sm:w-48 sm:h-48 border-4 border-dashed border-white/5 rounded-full flex items-center justify-center p-4 sm:p-8 group"
                 >
                    <div className="w-full h-full border-4 border-blue-500/20 rounded-full animate-pulse group-hover:scale-125 transition-transform duration-700" />
                    <Sparkles className="absolute w-6 h-6 sm:w-10 sm:h-10 text-blue-500" />
                 </motion.div>
              </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-12 gap-4 sm:gap-8">
               <motion.div 
                  whileHover={{ y: -10 }}
                  className="col-span-1 sm:col-span-2 md:col-span-8 glass-card rounded-2xl sm:rounded-[3.5rem] p-6 sm:p-10 lg:p-16 flex flex-col justify-end relative overflow-hidden group min-h-[350px] sm:min-h-[450px] lg:min-h-[500px]"
               >
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-all duration-1000 pointer-events-none" />
                  <BarChart3 className="w-10 h-10 sm:w-16 lg:w-24 lg:h-24 text-blue-500 mb-4 sm:mb-10 lg:mb-12 transform group-hover:rotate-12 transition-transform duration-700" />
                  <h3 className="text-2xl sm:text-4xl lg:text-5xl font-display font-bold mb-3 sm:mb-8 uppercase tracking-tighter italic">Arquitetura de Pipeline</h3>
                  <p className="text-slate-400 text-xs sm:text-sm lg:text-xl max-w-2xl leading-relaxed">
                     Não é apenas um funil convencional. É uma simulação viva do seu motor de faturamento, perfeitamente otimizada para ciclos ágeis de SDR/Closures, vendas de alta escala educacional ou nichos de comércio premium como revendedores Apple em Palmas, garantindo rastreamento preciso de inventário de iPhones e margens financeiras robustas.
                  </p>
               </motion.div>
               
               <motion.div 
                  whileHover={{ scale: 1.02 }}
                  className="col-span-1 sm:col-span-1 md:col-span-4 glass-card rounded-2xl sm:rounded-[3.5rem] p-6 sm:p-10 lg:p-16 flex flex-col justify-center items-center text-center bg-blue-600 border-none group relative overflow-hidden h-[300px] sm:h-[450px] lg:h-[500px]"
               >
                  <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
                  <Zap className="w-10 h-10 sm:w-16 lg:w-24 lg:h-24 text-white mb-4 sm:mb-10 lg:mb-12 animate-bounce" />
                  <h4 className="font-display font-bold uppercase tracking-widest text-lg sm:text-2xl text-white mb-2 sm:mb-6 italic underline underline-offset-8">Gatilhos_Ativos</h4>
                  <p className="text-blue-100 text-[10px] sm:text-sm lg:text-lg font-medium leading-relaxed">
                     Acelere a execução com automações que respondem ao pulso do seu lead em nanossegundos.
                  </p>
               </motion.div>

               <div className="col-span-1 sm:col-span-1 md:col-span-4 glass-card rounded-2xl sm:rounded-[3.5rem] p-6 sm:p-10 lg:p-12 flex flex-col justify-center items-center text-center h-[200px] sm:h-[350px] lg:h-[400px]">
                  <ShieldCheck className="w-10 h-10 sm:w-16 sm:h-16 text-indigo-500 mb-4 sm:mb-10" />
                  <h5 className="font-display font-black text-base sm:text-xl uppercase italic mb-1 sm:mb-4">Criptografia_Pure</h5>
                  <p className="text-slate-500 text-[8px] sm:text-sm font-bold uppercase tracking-widest">Segurança de Grado Militar</p>
               </div>

               <div className="col-span-1 sm:col-span-1 md:col-span-4 glass-card rounded-2xl sm:rounded-[3.5rem] p-6 sm:p-10 lg:p-12 flex flex-col justify-center items-center text-center h-[200px] sm:h-[350px] lg:h-[400px] border-blue-500/20">
                  <GraduationCap className="w-10 h-10 sm:w-16 sm:h-16 text-blue-500 mb-4 sm:mb-10" />
                  <h5 className="font-display font-black text-base sm:text-xl uppercase italic mb-1 sm:mb-4">Núcleo_Escolar</h5>
                  <p className="text-slate-500 text-[8px] sm:text-sm font-bold uppercase tracking-widest leading-relaxed">Gestão de Turmas, Alunos e Matrículas com Inteligência Pedagógica.</p>
               </div>

               <div className="col-span-1 sm:col-span-1 md:col-span-4 glass-card rounded-2xl sm:rounded-[3.5rem] p-6 sm:p-10 lg:p-12 flex flex-col justify-center items-center text-center h-[200px] sm:h-[350px] lg:h-[400px]">
                  <Activity className="w-10 h-10 sm:w-16 sm:h-16 text-emerald-500 mb-4 sm:mb-10" />
                  <h5 className="font-display font-black text-base sm:text-xl uppercase italic mb-1 sm:mb-4">Fluxo_Dinâmico</h5>
                  <p className="text-slate-500 text-[8px] sm:text-sm font-bold uppercase tracking-widest">Financeiro em Tempo Real</p>
               </div>

                 <div className="col-span-1 md:col-span-4 glass-card rounded-3xl sm:rounded-[3.5rem] p-6 sm:p-10 lg:p-12 flex flex-col justify-center items-center text-center h-[250px] sm:h-[350px] lg:h-[400px]">
                    <Cpu className="w-10 h-10 sm:w-16 sm:h-16 text-cyan-500 mb-4 sm:mb-10" />
                    <h5 className="font-display font-black text-lg sm:text-xl uppercase italic mb-2 sm:mb-4">Open_Kernel</h5>
                    <p className="text-slate-500 text-[10px] sm:text-sm font-bold uppercase tracking-widest">Full API Scalability</p>
                 </div>
              </div>
            </div>
         </section>

        {/* Master AI Visual Interface Prototype */}
        <NeuralSection rotateX={rotateX} rotateY={rotateY} />

        {/* Scalability Grid - Massive Logos & Stats */}
        <section id="rede" className="py-12 sm:py-24 lg:py-32 px-4 sm:px-6 relative border-y border-white/5 bg-[var(--color-surface)]">
           <div className="max-w-7xl mx-auto">
              <div className="text-center mb-16 sm:mb-20 lg:mb-28">
                 <motion.h2 
                    initial={{ opacity: 0, scale: 0.8 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    className="text-5xl sm:text-7xl md:text-9xl font-display font-bold tracking-tighter mb-4 sm:mb-10 italic"
                 >
                    RED_GLOBAL.
                 </motion.h2>
                 <p className="text-slate-500 uppercase font-black text-[10px] sm:text-[12px] tracking-[0.25em] sm:tracking-[0.6em]">Ecossistema Corporativo de Alta Densidade</p>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-10 sm:gap-16 lg:gap-20">
                 {[
                    { l: "Empresas_Ativas", v: "1.2k+" },
                    { l: "Leads_Processados", v: "45M+" },
                    { l: "ROI_Médio", v: "312%" },
                    { l: "Latência", v: "4ms" }
                 ].map((stat, i) => (
                    <motion.div 
                       key={i}
                       viewport={{ once: true }}
                       initial={{ opacity: 0, y: 50 }}
                       whileInView={{ opacity: 1, y: 0 }}
                       transition={{ delay: i * 0.2 }}
                       className="flex flex-col items-center gap-6"
                    >
                       <div className="text-6xl font-display font-black text-white italic underline decoration-blue-800 decoration-8">{stat.v}</div>
                       <div className="text-[11px] font-black uppercase tracking-[0.4em] text-slate-600">{stat.l}</div>
                    </motion.div>
                 ))}
              </div>
           </div>
        </section>

        {/* Final Ascension CTA - Bombastic End */}
        <section className="py-20 sm:py-32 lg:py-40 px-4 sm:px-6 relative overflow-hidden bg-[var(--color-surface)]">
           <motion.div 
             animate={{ 
               scale: [1, 1.2, 1],
               opacity: [0.05, 0.1, 0.05]
             }}
             transition={{ repeat: Infinity, duration: 10 }}
             className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1500px] h-[1500px] bg-blue-600 rounded-full blur-[300px] z-0" 
           />
           
           <div className="max-w-6xl mx-auto text-center relative z-10 space-y-16">
              <motion.h2 
                initial={{ opacity: 0, scale: 0.5 }}
                whileInView={{ opacity: 1, scale: 1 }}
                className="text-8xl md:text-[14rem] font-display font-bold tracking-[-0.08em] leading-[0.75] text-glow italic"
              >
                ASCENSÃO <br /><span className="text-blue-500">TOTAL.</span>
              </motion.h2>
              <p className="text-2xl md:text-4xl text-slate-400 max-w-4xl mx-auto leading-relaxed font-medium italic">
                Você não está contratando uma ferramenta. Você está assinando um <span className="text-white font-black underline decoration-blue-500 decoration-8">Novo Destino Comerical.</span>
              </p>
              <Link to="/login" className="inline-block">
                <motion.div
                  whileHover={{ scale: 1.1, rotateX: 5 }}
                  whileTap={{ scale: 0.9 }}
                >
                  <Button className="h-16 sm:h-24 lg:h-32 px-8 sm:px-16 lg:px-24 bg-white text-black hover:bg-slate-100 rounded-full font-black uppercase tracking-[0.2em] sm:tracking-[0.5em] text-sm sm:text-lg lg:text-xl shadow-[0_0_100px_rgba(255,255,255,0.4)] transition-all">
                     ASSUMIR_O_EIXO
                  </Button>
                </motion.div>
              </Link>
           </div>
        </section>

      </main>

      {/* Industrial Monolithic Footer - Tightened Size */}
      <footer className="border-t border-white/5 bg-black/80 backdrop-blur-3xl px-4 sm:px-12 py-6 sm:py-10 relative z-[110]">
         <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8 sm:gap-12 lg:gap-16">
            <div className="md:col-span-2">
               <div className="flex items-center gap-4 sm:gap-6 mb-4 sm:mb-6">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 bg-[#0B1120] border border-blue-500/30 rounded-lg sm:rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(37,99,235,0.25)] overflow-hidden p-1">
                    <img src="/logo-icon.png" alt="S.P.Y. Logo" className="w-full h-full object-contain rounded" />
                  </div>
                  <span className="text-xl sm:text-2xl font-display font-black tracking-[-0.05em] italic">S.P.Y._CORE_SYSTEMS</span>
               </div>
               <p className="text-slate-500 text-[10px] sm:text-xs lg:text-sm leading-relaxed max-w-lg italic font-medium">
                 Definindo o padrão ouro para a infraestrutura de dados corporativos de próxima geração. A inteligência agora é o seu único patrimônio.
               </p>
            </div>
            <div className="space-y-4 sm:space-y-6">
               <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-[0.4em] text-slate-700 block">PROTOCOLOS</span>
               <div className="flex flex-col gap-1.5 sm:gap-3">
                 {["Manifesto_Rede", "Kernel_Status", "Arquitetura_IA", "Conformidade"].map(link => (
                   <a key={link} href="#" className="text-[9px] sm:text-[11px] font-black text-slate-400 hover:text-blue-500 transition-colors uppercase tracking-widest">{link}</a>
                 ))}
               </div>
            </div>
            <div className="space-y-4 sm:space-y-6">
               <div>
                  <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-[0.4em] text-slate-700 block mb-4">ESTAÇÃO_SYNC</span>
                  <div className="flex items-center gap-2 sm:gap-3">
                     {[Star, Zap, ShieldCheck, Component].map((Icon, i) => (
                       <motion.div 
                         key={i} 
                         whileHover={{ y: -3 }}
                         className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-white/5 border border-white/5 flex items-center justify-center hover:bg-blue-600/20 hover:border-blue-500 transition-all cursor-pointer font-black text-slate-500 hover:text-blue-500"
                       >
                          <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                       </motion.div>
                     ))}
                  </div>
               </div>
               <p className="text-[7px] sm:text-[8px] text-slate-800 uppercase font-black tracking-[0.3em] sm:tracking-[0.4em]">©MMXXVI_PLUPPEX_NEURAL_DIV • ALL_SYNC_VERIFIED_V.2.0.4</p>
            </div>
         </div>
      </footer>
    </div>
  );
}

