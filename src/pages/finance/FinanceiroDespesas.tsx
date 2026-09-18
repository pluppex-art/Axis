import GenericFinanceiroList from "./GenericFinanceiroList";

export default function FinanceiroDespesas() {
  return (
    <GenericFinanceiroList
      title="Despesas"
      desc="Despesas já realizadas (pagas) — para o que ainda está por vir, veja Contas a Pagar."
      type="Pagar"
      statusFilter="Pago"
      defaultStatus="Pago"
    />
  );
}
