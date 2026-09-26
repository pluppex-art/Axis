/**
 * Teste de regressão do motor de Comparação de Tabelas (Clínicas e Saúde), SEM banco e SEM rede.
 * 70 exames de laboratório + 185 linhas de parceiro com gabarito: sinônimos, abreviações, typos,
 * texto extra e ARMADILHAS (exames parecidos que nunca podem virar correspondência automática).
 *
 *   npx tsx scripts/tableMatchLabTest.ts        → precisão/cobertura + lista de problemas
 *   npx tsx scripts/tableMatchLabTestAurora.ts  → idem com a Aurora real (usa GEMINI_API_KEY do .env)
 *
 * Critério que não pode regredir: "AUTO ERRADO" = 0 (nenhuma automática errada).
 * Dataset sintético — não são dados de nenhum cliente.
 */
import { buildBaseIndex, matchItem, DEFAULT_MATCH_CONFIG, type BaseItem, type MatchConfig } from "../src/lib/tableMatch.ts";

// ── Base do laboratório (id, nome oficial, apelidos, código externo/TUSS opcional) ──
const B: Array<[number, string, string[], string?]> = [
  [1, "Hemograma completo", ["Hemograma", "Eritrograma leucograma plaquetas"], "40304361"],
  [2, "Glicose em jejum", ["Glicemia de jejum"], "40302040"],
  [3, "Glicose pós-prandial", ["Glicemia pós-prandial", "Glicemia 2h pós"]],
  [4, "Hemoglobina glicada", ["HbA1c", "Hemoglobina glicosilada"]],
  [5, "Colesterol total", []],
  [6, "Colesterol HDL", []],
  [7, "Colesterol LDL", []],
  [8, "Triglicerídeos", ["Triglicérides"]],
  [9, "Creatinina", ["Creatinina sérica"]],
  [10, "Ureia", []],
  [11, "Ácido úrico", []],
  [12, "TGO (AST)", ["Transaminase oxalacética", "AST", "TGO"]],
  [13, "TGP (ALT)", ["Transaminase pirúvica", "ALT", "TGP"]],
  [14, "Gama GT", ["Gama glutamil transferase", "GGT"]],
  [15, "Fosfatase alcalina", []],
  [16, "Bilirrubina total", []],
  [17, "Bilirrubina direta", []],
  [18, "Bilirrubina indireta", []],
  [19, "TSH", ["Hormônio tireoestimulante"], "40316521"],
  [20, "T4 livre", ["Tiroxina livre", "FT4"]],
  [21, "T3 total", []],
  [22, "Vitamina D 25-hidroxi", ["Vitamina D", "25-OH Vitamina D", "25 hidroxivitamina D"]],
  [23, "Vitamina B12", ["Cobalamina"]],
  [24, "Ácido fólico", ["Folato"]],
  [25, "Ferritina", []],
  [26, "Ferro sérico", []],
  [27, "PSA total", ["Antígeno prostático específico"]],
  [28, "PSA livre", []],
  [29, "Beta HCG quantitativo", ["BHCG", "Gonadotrofina coriônica"]],
  [30, "EAS", ["Urina tipo I", "Urina rotina", "Sumário de urina"]],
  [31, "Urocultura", ["Cultura de urina"]],
  [32, "Parasitológico de fezes", ["EPF", "Exame parasitológico de fezes"]],
  [33, "Proteína C reativa", ["PCR"]],
  [34, "VHS", ["Velocidade de hemossedimentação"]],
  [35, "Cálcio total", []],
  [36, "Magnésio", []],
  [37, "Potássio", []],
  [38, "Sódio", []],
  [39, "Cortisol", []],
  [40, "Insulina basal", []],
  [41, "Testosterona total", []],
  [42, "Testosterona livre", []],
  [43, "Estradiol", []],
  [44, "Progesterona", []],
  [45, "FSH", []],
  [46, "LH", []],
  [47, "Prolactina", []],
  [48, "Anti-HIV 1 e 2", ["HIV", "Sorologia HIV"]],
  [49, "Hepatite B HBsAg", ["HBsAg"]],
  [50, "Anti-HBs", []],
  [51, "Hepatite C Anti-HCV", ["Anti-HCV"]],
  [52, "VDRL", ["Sífilis VDRL"]],
  [53, "Toxoplasmose IgG", []],
  [54, "Toxoplasmose IgM", []],
  [55, "Rubéola IgG", []],
  [56, "Rubéola IgM", []],
  [57, "Citomegalovírus IgG", ["CMV IgG"]],
  [58, "Citomegalovírus IgM", ["CMV IgM"]],
  [59, "Tempo de protrombina", ["TAP", "TP"]],
  [60, "TTPA", ["Tempo de tromboplastina parcial ativada", "KTTP"]],
  [61, "D-dímero", []],
  [62, "Homocisteína", []],
  [63, "Amilase", []],
  [64, "Lipase", []],
  [65, "LDH", ["Desidrogenase lática"]],
  [66, "CK total", ["CPK", "Creatinofosfoquinase"]],
  [67, "CK-MB", []],
  [68, "Troponina", []],
  [69, "Fibrinogênio", []],
  [70, "Zinco", []],
];
const base: BaseItem[] = B.map(([id, nome, alt, ext]) => ({ id: `b${id}`, nome, nomes_alternativos: alt, codigo_interno: `LV${String(id).padStart(3, "0")}`, codigo_externo: ext ?? null, custo: 5, valor: 12 }));

// ── Linhas do parceiro: [nome, código?, esperado, tipo] ──
// esperado: número = exame da base | null = não existe na base | number[] = ambíguo (qualquer um serve, mas nunca outro)
type Exp = number | null | number[];
const R: Array<[string, string | null, Exp, string]> = [];
const add = (kind: string, rows: Array<[string, Exp] | [string, Exp, string]>) => rows.forEach((r) => R.push([r[0], (r as any)[2] ?? null, r[1], kind]));

add("caixa/acento", [
  ["HEMOGRAMA COMPLETO", 1], ["GLICOSE EM JEJUM", 2], ["ÁCIDO ÚRICO", 11], ["TRIGLICÉRIDES SÉRICOS", 8], ["CREATININA SÉRICA", 9], ["URÉIA", 10],
  ["FOSFATASE ALCALINA", 15], ["MAGNÉSIO", 36], ["POTÁSSIO", 37], ["SÓDIO", 38], ["FERRITINA", 25], ["PROLACTINA", 47], ["PROGESTERONA", 44],
]);
add("sinônimo cadastrado", [
  ["GLICEMIA DE JEJUM", 2], ["Hemoglobina Glicosilada", 4], ["HbA1c", 4], ["Transaminase oxalacética", 12], ["Transaminase pirúvica", 13], ["Gama glutamil transferase", 14],
  ["Tiroxina livre", 20], ["Cobalamina", 23], ["Folato", 24], ["Antígeno prostático específico", 27], ["Urina tipo I", 30], ["Urina rotina", 30], ["Cultura de urina", 31],
  ["Exame parasitológico de fezes", 32], ["Velocidade de hemossedimentação", 34], ["Creatinofosfoquinase", 66], ["Desidrogenase lática", 65],
  ["Tempo de tromboplastina parcial ativada", 60], ["Hormônio tireoestimulante", 19], ["25-OH Vitamina D", 22], ["Vitamina D", 22],
]);
add("abreviação", [
  ["HB GLICADA", 4], ["TGO", 12], ["TGP", 13], ["AST", 12], ["ALT", 13], ["GGT", 14], ["FT4", 20], ["EAS", 30], ["EPF", 32], ["PCR", 33], ["VHS", 34], ["TG", 8],
  ["BHCG", 29], ["VIT D", 22], ["25 OH VIT D", 22], ["VIT B12", 23], ["TAP", 59], ["KTTP", 60], ["CPK", 66], ["LDH", 65], ["HBSAG", 49], ["FSH", 45], ["LH", 46],
  ["CREAT", 9], ["COLEST TOTAL", 5], ["COLEST HDL", 6], ["COLEST LDL", 7], ["GLIC JEJUM", 2], ["HEMOG GLICADA", 4],
]);
add("variação de escrita", [
  ["Colesterol - HDL", 6], ["HDL colesterol", 6], ["Colesterol LDL", 7], ["Colesterol Total", 5], ["Glicose (jejum)", 2], ["Glicemia pós prandial 2h", 3],
  ["Ácido úrico, dosagem", 11], ["Úrico, ácido", 11], ["Vitamina D (25 hidroxi)", 22], ["Vitamina B12 sérica", 23], ["Fosf. alcalina", 15], ["Bilirrubina Total", 16],
  ["Bilirrubina Direta", 17], ["BILIRRUBINA INDIRETA", 18], ["T3 Total", 21], ["PSA TOTAL", 27], ["PSA LIVRE", 28], ["BETA HCG QUANTITATIVO", 29],
  ["HCG quantitativo", 29], ["Toxoplasmose IgG", 53], ["Toxoplasmose IgM", 54], ["Rubéola IgG", 55], ["Rubéola IgM", 56], ["Citomegalovírus IgG", 57], ["Citomegalovírus IgM", 58],
  ["Anti-HIV", 48], ["HIV 1 e 2 anticorpos", 48], ["Anti HCV", 51], ["Anti-HBs", 50], ["VDRL", 52], ["Proteína C reativa", 33], ["Cálcio", 35], ["Cálcio total", 35],
  ["Insulina", 40], ["Insulina basal", 40], ["Testosterona total", 41], ["Testosterona livre", 42], ["Estradiol", 43], ["Cortisol", 39], ["Tempo de protrombina", 59],
  ["D dímero", 61], ["Homocisteína", 62], ["Amilase", 63], ["Lipase", 64], ["CK-MB", 67], ["Fibrinogênio", 69], ["Zinco", 70], ["Ferro sérico", 26], ["Ferro", [26]],
]);
add("erro de digitação", [
  ["HEMOGRAMMA COMPLETO", 1], ["COLESTEROL TOTA", 5], ["creatinnina", 9], ["TRIGLICERIDEOS  ", 8], ["Glicose em jejun", 2], ["Bilirrubina diretta", 17], ["Vitamna D", 22], ["Ferritna", 25],
]);
add("por código do parceiro (TUSS)", [
  ["Exame 40304361", 1, "40304361"], ["Prova 40302040", 2, "40302040"], ["Dosagem X 40316521", 19, "40316521"],
]);
add("com texto extra (adicional)", [
  ["Hemograma completo com plaquetas", 1], ["TSH ultrassensível", 19], ["Glicose em jejum (8h)", 2], ["Creatinina sérica - método enzimático", 9],
  ["Urocultura com antibiograma", 31], ["Troponina I", 68], ["Vitamina B12 (cobalamina)", 23],
]);

// Armadilhas: parecem, mas NÃO são o mesmo exame. Nunca podem virar correspondência automática.
add("ARMADILHA (não existe na base)", [
  ["T4 TOTAL", null], ["T3 LIVRE", null], ["VITAMINA B6", null], ["VITAMINA C", null], ["VITAMINA A", null], ["CÁLCIO IÔNICO", null], ["CORTISOL SALIVAR", null],
  ["TOXOPLASMOSE IgA", null], ["RUBÉOLA IgA", null], ["HEPATITE A ANTI-HAV", null], ["GLICOSE URINÁRIA", null], ["PROTEÍNA URINÁRIA", null], ["CREATININA URINÁRIA", null],
  ["COLESTEROL VLDL", null], ["HEMOGLOBINA", null], ["FERRO TOTAL LIGAÇÃO (TIBC)", null], ["TSH NEONATAL", null], ["PSA COMPLEXADO", null], ["ANTI-TPO", null],
  ["FOSFATASE ÁCIDA", null], ["BILIRRUBINA NEONATAL", null], ["TESTOSTERONA BIODISPONÍVEL", null], ["INSULINA PÓS-PRANDIAL", null], ["CLEARANCE DE CREATININA", null],
  ["GLICEMIA CAPILAR", null], ["CURVA GLICÊMICA", null], ["CITOMEGALOVÍRUS IgA", null], ["HIV CARGA VIRAL", null], ["HEPATITE B ANTI-HBC", null],
]);
add("AMBÍGUO (qualquer um dos corretos, nunca outro)", [
  ["TOXOPLASMOSE", [53, 54]], ["RUBÉOLA", [55, 56]], ["CITOMEGALOVÍRUS", [57, 58]], ["PSA", [27, 28]], ["TESTOSTERONA", [41, 42]], ["BILIRRUBINAS", [16, 17, 18]],
  ["COLESTEROL", [5, 6, 7]], ["GLICOSE", [2, 3]], ["HEPATITE B", [49, 50]], ["CK", [66, 67]], ["Bilirrubinas total e frações", [16, 17, 18]], ["Colesterol total e frações", [5, 6, 7]],
]);
add("fora do escopo do laboratório", [
  ["DENSITOMETRIA ÓSSEA", null], ["RESSONÂNCIA MAGNÉTICA DE JOELHO", null], ["ELETROCARDIOGRAMA", null], ["RAIO X DE TÓRAX", null], ["ULTRASSOM ABDOME TOTAL", null], ["TESTE ERGOMÉTRICO", null],
  ["COLONOSCOPIA", null], ["PAPANICOLAU", null], ["ESPERMOGRAMA", null], ["AUDIOMETRIA", null], ["HORMÔNIO DO CRESCIMENTO GH", null], ["SELÊNIO", null], ["CHUMBO SÉRICO", null], ["COBRE", null],
]);

function run(cfg: MatchConfig, label: string, verbose: boolean) {
  const index = buildBaseIndex(base, [], cfg);
  const cnt = { total: 0, autoOk: 0, autoWrong: 0, autoFalse: 0, revOk: 0, revMiss: 0, naoOk: 0, naoMiss: 0, correctExpected: 0 };
  const perKind: Record<string, { n: number; auto: number; rev: number; nao: number; bad: number }> = {};
  const problems: string[] = [];
  const nameOf = (id: string | null) => (id ? base.find((b) => b.id === id)?.nome : "—");
  for (const [nome, cod, exp, kind] of R) {
    const r = matchItem({ nome, codigo: cod }, index);
    const k = (perKind[kind] ||= { n: 0, auto: 0, rev: 0, nao: 0, bad: 0 });
    k.n++; cnt.total++;
    const id = r.exame_base_id ? Number(r.exame_base_id.slice(1)) : null;
    const okSet = Array.isArray(exp) ? exp : exp === null ? [] : [exp];
    const topCand = r.candidates[0] ? Number(r.candidates[0].exame_base_id.slice(1)) : null;
    if (r.status === "automatico") {
      k.auto++;
      if (id !== null && okSet.includes(id)) cnt.autoOk++;
      else { k[("bad" as const)]++; if (exp === null) cnt.autoFalse++; else cnt.autoWrong++; problems.push(`🔴 AUTO ERRADO   "${nome}" → ${nameOf(r.exame_base_id)} (${r.score}%)  esperado: ${exp === null ? "nada" : okSet.map((i) => base[i - 1].nome).join(" | ")}  [${kind}]`); }
    } else if (r.status === "revisao") {
      k.rev++;
      if (okSet.length && (okSet.includes(id as number) || okSet.includes(topCand as number))) cnt.revOk++;
      else if (okSet.length) { cnt.revMiss++; problems.push(`🟡 revisão sem o certo "${nome}" → ${nameOf(r.exame_base_id)} (${r.score}%) esperado: ${okSet.map((i) => base[i - 1].nome).join(" | ")}`); }
      else cnt.naoOk++; // sugerir algo p/ revisão humana quando não existe é seguro (humano decide)
    } else {
      k.nao++;
      if (okSet.length && !Array.isArray(exp)) { cnt.naoMiss++; problems.push(`⚪ não identificou  "${nome}" (esperado ${base[(exp as number) - 1].nome}) [${kind}]`); }
      else cnt.naoOk++;
    }
  }
  const expectedMatches = R.filter((r) => typeof r[2] === "number").length;
  const autoTotal = cnt.autoOk + cnt.autoWrong + cnt.autoFalse;
  console.log(`\n════ ${label} ════  (auto≥${cfg.autoThreshold}, revisão≥${cfg.reviewThreshold}, margem ${cfg.autoMargin})`);
  console.log(`Linhas: ${cnt.total} | com correspondência real na base: ${expectedMatches}`);
  console.log(`Automáticas: ${autoTotal}  → corretas ${cnt.autoOk}, ERRADAS ${cnt.autoWrong + cnt.autoFalse} (${cnt.autoWrong} trocaram de exame, ${cnt.autoFalse} inventaram correspondência p/ exame inexistente)`);
  console.log(`Precisão das automáticas: ${autoTotal ? ((cnt.autoOk / autoTotal) * 100).toFixed(1) : "—"}%   |   Cobertura automática dos exames que existem: ${((cnt.autoOk / expectedMatches) * 100).toFixed(1)}%`);
  console.log(`Revisão com o exame certo sugerido: ${cnt.revOk} | revisão sem o certo: ${cnt.revMiss} | não identificados que deviam achar: ${cnt.naoMiss}`);
  if (verbose) {
    console.log("\nPor categoria (auto / revisão / não id / erros críticos):");
    for (const [k, v] of Object.entries(perKind)) console.log(`  ${k.padEnd(52)} n=${String(v.n).padStart(3)}  auto ${String(v.auto).padStart(3)}  rev ${String(v.rev).padStart(3)}  não ${String(v.nao).padStart(3)}  erros ${v.bad}`);
    console.log("\nProblemas:"); problems.forEach((p) => console.log("  " + p));
  }
  return { cnt, autoTotal };
}

export { R, base };
if (process.argv[1]?.endsWith("tableMatchLabTest.ts")) run(DEFAULT_MATCH_CONFIG, "PADRÃO", true);
