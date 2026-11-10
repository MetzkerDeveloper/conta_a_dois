# Regras de negócio

Valores em centavos inteiros seguros. Dois membros distintos por cálculo. Despesas positivas; renda admite zero. Percentual em basis points de 0 a 10000, padrão 7000.

O maior ganhador recebe round(total × percentual / 10000); a outra cota é total menos a primeira. O motor usa bigint nos produtos e arredonda metade para cima. Modos: fixed, equal e proportional (renda exata, sem truncar para basis points). Renda empatada usa tiebreakUserId no modo fixed; sem desempate, 50/50. Rendas proporcionais ambas zero também usam 50/50. Para divisões iguais com centavo ímpar, a ordem lexicográfica dos IDs define a primeira cota e torna o resultado estável.

Pago é a soma por pagador. Saldo = cota − pago. Positivo indica obrigação remanescente, negativo crédito. Com todas as despesas pagas, os saldos somam zero e o devedor repassa ao credor.

**Ajuste necessário à especificação:** com despesas sem pagador, a soma dos saldos é o total ainda não pago, e não zero. Essas despesas entram no total e em unpaidCents. Só há sugestão de repasse se alguém já financiou mais que sua cota; o valor é limitado a esse crédito. O painel futuro deverá destacar as contas pendentes para não apresentar a obrigação restante como dívida exclusiva ao parceiro.

Exemplos: Ana ganha 700000, Bruno 300000, total 400000, regra 70/30. Cotas 280000/120000. Se Ana paga tudo, Bruno repassa 120000. Se Ana paga 100000 e Bruno 300000, Ana repassa 180000.

Pagador responsável preenche o pagador padrão de novas despesas, sem alterar a fórmula. Repasse registrado é uma entidade separada: o motor retorna a sugestão bruta antes de repasses; a futura conciliação deve descontar apenas os confirmados e exibir pendentes, evitando duplicações.

Renda anterior pode ser sugerida, mas deve ser confirmada para fechar o mês. Fechamento armazena snapshot e bloqueia edição até reabertura. Configurações devem ser versionadas por competência: alterações valem na próxima competência aberta e nunca recalculam meses fechados. Falta definir a política de fechamento para contas e repasses pendentes.

## Redistribuição por capacidade de renda

O painel soma as rendas confirmadas da competência, indicando total parcial enquanto faltar a confirmação de algum membro. Se uma cota ultrapassar a renda da pessoa, o painel sugere transferir o excedente para o par até o limite de renda disponível após a própria cota. O cálculo usa centavos e bigint. Se a renda total não cobrir as despesas, o déficit é informado e permanece atribuído à pessoa cuja cota excedeu a renda; as cotas continuam somando exatamente o total das despesas.

A sugestão só altera o acerto após clicar em **Aplicar redistribuição**. A opção fica registrada em `financial_months.redistribute_by_income`, sem substituir a regra original ou alterar outros meses. Enquanto estiver ativa, mudanças nas rendas ou despesas recalculam a redistribuição nessa competência. **Restaurar divisão original** desativa a opção. Pagamentos são preservados e apenas repasses confirmados são descontados do novo acerto. Adiantar pagamentos acima da própria renda não equivale a ter uma cota acima da renda: o repasse considera o crédito de quem adiantou.

As duas ações usam o lock do casal e verificam o fingerprint do painel, incluindo a opção de redistribuição. Repasses pendentes precisam ser resolvidos antes de aplicar ou restaurar. Meses fechados bloqueiam ambas as ações; o snapshot preserva o resultado ajustado e a opção ativa no fechamento.
