/**
 * Gera os CSVs de exemplo da Comparação de Tabelas a partir do dataset de scripts/tableMatchLabTest.ts.
 *   npx tsx scripts/gerarExemplosComparacao.ts
 * Saída: scripts/exemplos/base-exames-laboratorio.csv e scripts/exemplos/tabela-parceiro-medprev.csv
 * (dados SINTÉTICOS — nenhum cliente real).
 */
import fs from "fs";
import { R, base } from "./tableMatchLabTest.ts";

const q = (v: string | number | null | undefined) => {
  const s = String(v ?? "");
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const money = (n: number) => n.toFixed(2).replace(".", ",");
const line = (cols: Array<string | number | null | undefined>) => cols.map(q).join(";");

const custoDe = (n: number) => 4 + ((n * 7) % 41);
const valorDe = (n: number) => Math.round(custoDe(n) * (1.7 + ((n * 3) % 6) / 10) * 100) / 100;

const cat = (n: number) => (n === 1 ? "Hematologia" : n <= 18 ? "Bioquímica" : n <= 21 ? "Hormônios" : n <= 28 ? "Vitaminas e Marcadores" : n <= 47 ? "Análises clínicas" : n <= 58 ? "Sorologia" : "Bioquímica");

const baseCsv = [
  line(["Nome oficial", "Código interno", "Código externo", "Categoria", "Sinônimos", "Custo", "Valor comercial"]),
  ...base.map((b: any, i: number) => {
    const n = i + 1;
    return line([b.nome, b.codigo_interno, b.codigo_externo, cat(n), (b.nomes_alternativos || []).join(" | "), money(custoDe(n)), money(valorDe(n))]);
  }),
].join("\n");

// Parceiro: o valor cobrado varia em torno do valor comercial da base (às vezes acima, às vezes abaixo).
const parceiroCsv = [
  line(["Nome do exame", "Código", "Quantidade", "Valor"]),
  ...R.map(([nome, cod, exp]: any, i: number) => {
    const alvo = Array.isArray(exp) ? exp[0] : exp;
    const ref = alvo ? valorDe(alvo) : 20 + ((i * 11) % 180);
    const v = Math.round(ref * (0.8 + ((i * 17) % 45) / 100) * 100) / 100;
    return line([nome, cod, 1 + ((i * 5) % 40), money(v)]);
  }),
].join("\n");

fs.writeFileSync(new URL("./exemplos/base-exames-laboratorio.csv", import.meta.url), "\ufeff" + baseCsv + "\n");
fs.writeFileSync(new URL("./exemplos/tabela-parceiro-medprev.csv", import.meta.url), "\ufeff" + parceiroCsv + "\n");
console.log(`base: ${base.length} exames | parceiro: ${R.length} linhas`);
