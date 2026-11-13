# Usar o espaço real do casal

Entre em `/login` com e-mail e senha. Se já usava link mágico e ainda não tem senha, informe seu e-mail e clique em **Entrar**: você receberá um link para cadastrá-la. Para recuperar o acesso, use **Cadastrar ou recuperar senha**. Novas contas usam **Criar conta** e precisam verificar o e-mail antes de entrar. Depois do acesso, o aplicativo abre `/casal`, com as abas Painel, Despesas, Rendas e Ajustes. Essas telas salvam os dados no Neon. A página inicial `/` e suas telas de exemplo continuam sendo uma demonstração e não gravam lançamentos reais.

## Preparar o mês

1. No painel, escolha a competência no campo de mês e clique em **Ver mês**. As setas permitem voltar ou avançar um mês.
2. Se faltar uma pessoa, gere o convite no painel ou em Ajustes. O parceiro deve entrar com seu próprio e-mail e aceitar o link.
3. Em **Rendas**, cada pessoa cadastra sua renda líquida uma vez. Ela é reaproveitada automaticamente nos próximos meses. Se não houve renda, informe `0,00`. A outra pessoa pode ver a renda, mas não editá-la.
4. Para uma alteração pontual, edite a renda no mês escolhido. Marque **Usar a renda líquida também nos próximos meses** para atualizar os meses seguintes ainda não iniciados. Em **Rendas extras do mês**, clique em **Adicionar renda extra** para cada recebimento, informe o valor e uma descrição opcional. Você pode editar ou remover cada item e salvar a renda. Os extras não se repetem. Meses já iniciados mantêm seus valores e meses fechados continuam imutáveis.

Você pode lançar despesas antes de completar o casal. O painel guarda as contas, mas espera dois membros e as duas rendas cadastradas para calcular cotas e repasse.

## Lançar e manter despesas

Clique em **Lançar despesa**, informe descrição, valor, vencimento e categoria. Escolha quem pagou ou deixe **Ainda não foi paga**. As observações são opcionais. Use valores como `1.234,56` ou `1234,56`.

O mês escolhido é a competência da despesa, mesmo que o vencimento seja em outro mês. Uma conta sem pagador entra no total e fica pendente. Para marcar como paga diretamente na lista, clique em **Marcar como paga**, confira **Quem pagou?** e use **Confirmar pagamento**. A lista mantém os filtros e a competência, e o acerto é recalculado. Para corrigir um pagamento, abra **Editar**, ajuste o pagador e salve.

As duas pessoas podem editar ou excluir despesas. A exclusão exige confirmação e não pode ser desfeita. Se a outra pessoa ou outra aba alterou o registro, o aplicativo pede que a tela seja atualizada antes de salvar ou excluir. Reenviar o mesmo formulário de criação não duplica a despesa.

Na lista, busque por descrição ou observações e combine filtros de categoria e pagamento. São exibidas até 25 despesas por página; use **Anterior** e **Próxima** para navegar mantendo os filtros e a competência. O total do mês considera todas as despesas; o total filtrado considera todos os resultados da busca, inclusive de outras páginas. Uma nova busca ou **Limpar filtros** retorna à primeira página. Os dados e filtros da URL continuam disponíveis depois de recarregar a página.

Em **Ajustes → Categorias**, crie categorias próprias, altere nome e cor, ou arquive e reative. Categorias arquivadas continuam identificando despesas antigas e não aparecem em novos lançamentos. Para arquivar uma categoria usada por recorrências ativas, pause essas recorrências primeiro. O casal precisa manter ao menos uma categoria ativa.

## Entender o painel

O painel mostra total, já pago, contas pendentes, cota de cada membro e saldo a cobrir ou a receber. O repasse sugerido usa a regra registrada para a competência. Se ainda há contas sem pagamento, o acerto pode mudar ao registrá-las como pagas.

As alterações que você salva atualizam as telas. Ao voltar à aba ou à janela do aplicativo, os dados são atualizados automaticamente, sem recarregar a página inteira. A atualização também ocorre ao recuperar a conexão. Se houver campos alterados e ainda não enviados, ela fica pausada para preservar sua edição. Você também pode usar **Atualizar** quando precisar.

Em **Repasses**, quem tem saldo a repassar registra o valor que já enviou pelo banco. O destinatário confirma o recebimento e só então o valor é descontado do saldo. São aceitos envios parciais. Enquanto houver um registro pendente, confirme ou cancele esse registro antes de enviar outro valor. O remetente pode cancelar e o destinatário pode recusar um registro pendente; registros confirmados não podem ser cancelados. O app não movimenta dinheiro nem consulta sua conta bancária.

## Ajustar o combinado

Em **Ajustes**, escolha percentual fixo, 50/50 ou proporcional às rendas. Defina também percentual de quem ganha mais, desempate em rendas iguais, pagador responsável e dia de repasse. Em meses curtos, o dia de repasse é limitado ao último dia válido.

A primeira renda ou despesa de uma competência guarda a regra daquele mês. Depois disso, alterações nos Ajustes só afetam competências sem lançamentos; os meses já iniciados mantêm seu combinado. Confira os ajustes antes de fazer o primeiro lançamento do mês.

Quando há pagador responsável, ele aparece selecionado em novas despesas. Confirme se a conta realmente foi paga; caso contrário, troque para **Ainda não foi paga**.

## Despesas recorrentes

Em **Despesas → Gerenciar recorrências**, cadastre descrição, valor, categoria, dia de vencimento e primeira competência. As contas são geradas ao abrir cada mês no aplicativo, sempre como **a pagar**. Se o dia não existir naquele mês, vale o último dia. Não é necessário deixar o aplicativo aberto; as contas serão geradas quando a competência for acessada, sem agendador externo.

Abra uma recorrência da lista para editar ou pausar, desmarcando **Recorrência ativa**. A mudança só afeta novas ocorrências. Editar, pagar ou excluir uma conta gerada não altera o modelo; uma conta excluída não volta a ser gerada naquele mês.

## Fechar ou reabrir o mês

No fim do **Painel**, confira os dados, marque a confirmação e clique em **Fechar mês**. As duas rendas devem estar cadastradas, todas as contas pagas e os repasses concluídos. O sistema guarda um snapshot dos dados e bloqueia novos lançamentos e alterações nessa competência. Se os dados mudarem enquanto você confere a tela, atualize antes de fechar.

Para corrigir algo, marque a confirmação e use **Reabrir mês** no mesmo local. Os lançamentos voltam a aceitar alterações; a regra da competência continua preservada. O último snapshot é mantido e atualizado no próximo fechamento.

## O que ainda falta

Em **Ajustes → Seus dados**, baixe o JSON do perfil e do histórico compartilhado do casal. Em **Excluir conta e dados**, digite `EXCLUIR` para apagar o perfil e o espaço financeiro completo. A exclusão é irreversível e remove o histórico também para o outro membro, que mantém a conta, mas perde o acesso ao casal. Exporte antes de confirmar.

Exportação mensal em CSV permanece como próxima melhoria. Antes da abertura pública, complete os dados legais do controlador e confirme os prazos de retenção dos provedores na política de privacidade.

Na lista de despesas, contas pendentes exibem uma sugestão de quem pode pagar,
quando os dois membros têm renda cadastrada na competência. O plano considera
as contas de todo o mês, a regra congelada (incluindo redistribuição, se aplicada),
os pagamentos e os repasses confirmados; filtros e paginação não mudam a divisão.
O pagador padrão, quando configurado, tem prioridade. Sem ele, contas maiores são
distribuídas primeiro para aproximar os saldos de cada pessoa, com desempate
estável. Essa aproximação pode deixar um repasse residual e é recalculada quando
os dados mudam. A sugestão não registra pagamento nem altera meses fechados;
ao pagar, confirme quem efetivamente pagou em “Marcar como paga”.

## Evolução financeira

Acesse **Evolução** no menu do casal para consultar os últimos 6 ou 12 meses até
a competência escolhida. Selecione um mês no gráfico para ver as cotas, as sobras
por pessoa, as categorias e a comparação com o mês anterior. A tabela oferece os
mesmos valores mensais em números.

A sobra prevista é a renda menos a cota nas despesas registradas, incluindo contas
pendentes. Pagamentos e repasses não são novas despesas: não alteram essa sobra.
Uma sobra negativa indica falta na renda. Os totais e médias incluem apenas
competências iniciadas com as duas rendas disponíveis; meses incompletos ficam
identificados. Meses ainda sem lançamentos podem mostrar a projeção da renda fixa
no detalhe, mas ficam fora dos indicadores. Nos meses fechados, rendas, cotas e
nomes das categorias vêm do snapshot de fechamento.

O simulador calcula uma contribuição de 0% a 100% da sobra positiva do casal,
mostra o total em 12 meses e o prazo para acumular seis meses das despesas daquela
competência. É um cenário sem rendimentos, partindo de zero e mantendo a mesma
contribuição; não registra aportes, metas ou dinheiro guardado. Gastos pessoais
não lançados também precisam ser considerados antes de separar a reserva.

## Perfil, senha e aparência

Use **Perfil**, no cabeçalho da área autenticada, para consultar seu nome e e-mail,
trocar a senha e escolher a aparência do sistema. O acesso também está disponível
em `/perfil`, inclusive antes de criar ou entrar em um casal.

Para trocar a senha, informe a atual, uma nova de 8 a 128 caracteres e confirme.
As outras sessões da sua conta são encerradas após a alteração; este navegador
continua conectado. Se esqueceu a senha ou ainda não cadastrou uma, use o link
para a tela de login e solicite o e-mail de cadastro/recuperação de senha.

Em **Aparência**, escolha **Claro**, **Escuro** ou **Seguir o dispositivo**. A
preferência é aplicada às telas do sistema e guardada neste navegador; não muda
o tema do seu par nem sincroniza automaticamente com outros dispositivos.
