import GenericFinanceiroList from "./GenericFinanceiroList";

export default function FinanceiroReceber() {
  return (
    <GenericFinanceiroList
      title="Contas a Receber"
      desc="Todos os títulos, recebidos ou não — para só o que já entrou, veja Receitas."
      type="Receber"
    />
  );
}
