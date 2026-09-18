import GenericFinanceiroList from "./GenericFinanceiroList";

export default function FinanceiroReceitas() {
  return (
    <GenericFinanceiroList
      title="Receitas"
      desc="Receita já realizada (recebida) — para o que ainda está por vir, veja Contas a Receber."
      type="Receber"
      statusFilter="Pago"
      defaultStatus="Pago"
    />
  );
}
