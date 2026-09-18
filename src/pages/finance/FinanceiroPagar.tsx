import GenericFinanceiroList from "./GenericFinanceiroList";

export default function FinanceiroPagar() {
  return (
    <GenericFinanceiroList
      title="Contas a Pagar"
      desc="Todas as obrigações, pagas ou não — para só o que já foi pago, veja Despesas."
      type="Pagar"
    />
  );
}
