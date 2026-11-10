# Usar o espaço real do casal

Entre em `/login`. Depois do acesso, o aplicativo abre `/casal`, com as abas Painel, Despesas, Rendas e Ajustes. Essas telas salvam os dados no Neon. A página inicial `/` e suas telas de exemplo continuam sendo uma demonstração e não gravam lançamentos reais.

## Preparar o mês

1. No painel, escolha a competência no campo de mês e clique em **Ver mês**. As setas permitem voltar ou avançar um mês.
2. Se faltar uma pessoa, gere o convite no painel ou em Ajustes. O parceiro deve entrar com seu próprio e-mail e aceitar o link.
3. Em **Rendas**, cada pessoa informa e confirma a própria renda líquida daquele mês. Se não houve renda, informe `0,00`. A outra pessoa pode ver a renda, mas não editá-la.
4. A renda do mês imediatamente anterior pode aparecer como sugestão. Ela só entra no cálculo depois da confirmação.

Você pode lançar despesas antes de completar o casal. O painel guarda as contas, mas espera dois membros e as duas rendas confirmadas para calcular cotas e repasse.

## Lançar e manter despesas

Clique em **Lançar despesa**, informe descrição, valor, vencimento e categoria. Escolha quem pagou ou deixe **Ainda não foi paga**. As observações são opcionais. Use valores como `1.234,56` ou `1234,56`.

O mês escolhido é a competência da despesa, mesmo que o vencimento seja em outro mês. Uma conta sem pagador entra no total e fica pendente. Para marcar como paga, abra **Editar**, selecione o membro que pagou e salve.

As duas pessoas podem editar ou excluir despesas. A exclusão exige confirmação e não pode ser desfeita. Se a outra pessoa ou outra aba alterou o registro, o aplicativo pede que a tela seja atualizada antes de salvar ou excluir. Reenviar o mesmo formulário de criação não duplica a despesa.

Na lista, busque por descrição ou observações e combine filtros de categoria e pagamento. São exibidas até 25 despesas por página; use **Anterior** e **Próxima** para navegar mantendo os filtros e a competência. O total do mês considera todas as despesas; o total filtrado considera todos os resultados da busca, inclusive de outras páginas. Uma nova busca ou **Limpar filtros** retorna à primeira página. Os dados e filtros da URL continuam disponíveis depois de recarregar a página.

Em **Ajustes → Categorias**, crie categorias próprias, altere nome e cor, ou arquive e reative. Categorias arquivadas continuam identificando despesas antigas e não aparecem em novos lançamentos. Para arquivar uma categoria usada por recorrências ativas, pause essas recorrências primeiro. O casal precisa manter ao menos uma categoria ativa.

## Entender o painel

O painel mostra total, já pago, contas pendentes, cota de cada membro e saldo a cobrir ou a receber. O repasse sugerido usa a regra registrada para a competência. Se ainda há contas sem pagamento, o acerto pode mudar ao registrá-las como pagas.

As alterações que você salva atualizam as telas. Para trazer alterações feitas pela outra pessoa ou em outra aba, use **Atualizar** ou recarregue a página.

Em **Repasses**, quem tem saldo a repassar registra o valor que já enviou pelo banco. O destinatário confirma o recebimento e só então o valor é descontado do saldo. São aceitos envios parciais. Enquanto houver um registro pendente, confirme ou cancele esse registro antes de enviar outro valor. O remetente pode cancelar e o destinatário pode recusar um registro pendente; registros confirmados não podem ser cancelados. O app não movimenta dinheiro nem consulta sua conta bancária.

## Ajustar o combinado

Em **Ajustes**, escolha percentual fixo, 50/50 ou proporcional às rendas. Defina também percentual de quem ganha mais, desempate em rendas iguais, pagador responsável e dia de repasse. Em meses curtos, o dia de repasse é limitado ao último dia válido.

A primeira renda ou despesa de uma competência guarda a regra daquele mês. Depois disso, alterações nos Ajustes só afetam competências sem lançamentos; os meses já iniciados mantêm seu combinado. Confira os ajustes antes de fazer o primeiro lançamento do mês.

Quando há pagador responsável, ele aparece selecionado em novas despesas. Confirme se a conta realmente foi paga; caso contrário, troque para **Ainda não foi paga**.

## Despesas recorrentes

Em **Despesas → Gerenciar recorrências**, cadastre descrição, valor, categoria, dia de vencimento e primeira competência. As contas são geradas ao abrir cada mês no aplicativo, sempre como **a pagar**. Se o dia não existir naquele mês, vale o último dia. Não é necessário deixar o aplicativo aberto; as contas serão geradas quando a competência for acessada, sem agendador externo.

Abra uma recorrência da lista para editar ou pausar, desmarcando **Recorrência ativa**. A mudança só afeta novas ocorrências. Editar, pagar ou excluir uma conta gerada não altera o modelo; uma conta excluída não volta a ser gerada naquele mês.

## Fechar ou reabrir o mês

No fim do **Painel**, confira os dados, marque a confirmação e clique em **Fechar mês**. As duas rendas devem estar confirmadas, todas as contas pagas e os repasses concluídos. O sistema guarda um snapshot dos dados e bloqueia novos lançamentos e alterações nessa competência. Se os dados mudarem enquanto você confere a tela, atualize antes de fechar.

Para corrigir algo, marque a confirmação e use **Reabrir mês** no mesmo local. Os lançamentos voltam a aceitar alterações; a regra da competência continua preservada. O último snapshot é mantido e atualizado no próximo fechamento.

## O que ainda falta

Em **Ajustes → Seus dados**, baixe o JSON do perfil e do histórico compartilhado do casal. Em **Excluir conta e dados**, digite `EXCLUIR` para apagar o perfil e o espaço financeiro completo. A exclusão é irreversível e remove o histórico também para o outro membro, que mantém a conta, mas perde o acesso ao casal. Exporte antes de confirmar.

Exportação mensal em CSV permanece como próxima melhoria. Antes da abertura pública, complete os dados legais do controlador e confirme os prazos de retenção dos provedores na política de privacidade.
