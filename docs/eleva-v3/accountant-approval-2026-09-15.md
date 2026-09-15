# Accountant written reply — Eleva v3 invoicing (2026-09-15)

Status: **Aprovado com condições**

- Date: 2026-09-15
- Accountant: `Manolo (MB)`
- Recorded in: [`decision-log.md`](./decision-log.md) (D-03, D-09, and the 2026-09-15 Current Entries entry)
- Source: founder paste of the accountant's written reply. This file is the durable verbatim copy. Do not invent commercial or legal terms beyond this text.

This reply authorizes recording the approval in the decision diary as **"Aprovado com condições"**, with the date and the accountant's name. It does **not** authorize activating automatic issuance or any flow whose fiscal configuration is not yet validated.

## Verbatim reply

Após revisão do modelo proposto para a faturação da Eleva v3, confirmo a minha aprovação dos pontos abaixo, nos termos e com as condições expressamente indicadas.

1. Modelo de faturação — Aprovado
   Aprovo a separação entre:

- a fatura emitida pela Eleva ao profissional, relativa à comissão da plataforma;
- a fatura emitida pelo profissional ao cliente, relativa ao serviço prestado, através do software de faturação do profissional.
  Esta aprovação pressupõe que os contratos e a operação efetiva enquadram a Eleva como intermediária, sendo os montantes cobrados por conta dos profissionais tratados contabilisticamente nessa qualidade.

2. Reservas históricas — Aprovado
   Aprovo a classificação interna das reservas anteriores à transição como legacy ou legacy_missing e a sua exclusão da emissão automática da v3, para evitar duplicações ou documentos incorretos.
   Esta exclusão não dispensa eventuais obrigações de regularização da Eleva. Os casos sem documento deverão ser enviados para análise, com os respetivos valores, datas e documentos disponíveis. A regularização será efetuada por procedimento separado, sob orientação contabilística.

3. Tratamento de IVA — Aprovado com condições
   Aprovo a implementação de uma matriz fiscal que distinga:

- Portugal: aplicação da taxa legalmente devida, considerando as regras territoriais aplicáveis;
- Outros Estados-Membros da UE, operações B2B abrangidas pela regra geral: não liquidação de IVA português e aplicação de autoliquidação pelo adquirente, quando reunidos os requisitos legais;
- UE sem NIF válido no VIES: análise do estatuto fiscal do profissional e dos elementos comprovativos disponíveis, sem classificação automática como consumidor;
- Fora da UE: determinação do tratamento em função do estatuto do adquirente e das regras de localização, sem aplicação indiscriminada de “taxa zero”.
  A eventual utilização do OSS dependerá da classificação do serviço e das operações abrangidas.
  Aprovo a consulta ao VIES no registo e antes da emissão, com conservação da evidência. A reutilização de resultados durante 24 horas e o procedimento em caso de indisponibilidade ficam sujeitos a validação específica antes de ativar os fluxos intra-UE.
  Os códigos fiscais, taxas e menções legais deverão estar confirmados antes da entrada em produção.

4. Momento de emissão e comissão — Aprovado
   Aprovo que a emissão não dependa do repasse ao profissional. A emissão na cobrança deverá respeitar o momento em que a comissão se torna devida, o tratamento de eventuais adiantamentos e os prazos legais.
   Aprovo que a comissão anunciada seja o montante total deduzido ao profissional, incluindo IVA quando devido.
   No exemplo de uma reserva de 100,00 €, com comissão total de 15,00 € e sem outras deduções: o profissional recebe 85,00 €; com IVA de 23%, a comissão corresponde a 12,20 € de base tributável + 2,80 € de IVA; em autoliquidação, corresponde a 15,00 € de base tributável, sem IVA liquidado pela Eleva.
   Este modelo deverá constar claramente das condições comerciais.

5. Reembolsos e notas de crédito — Aprovado
   Aprovo a emissão de nota de crédito quando exista redução ou anulação da comissão faturada, com referência à fatura original.
   A emissão não ficará exclusivamente dependente do sucesso técnico do reembolso: deverá acompanhar o facto que determina a correção e os requisitos legais aplicáveis.
   Nos reembolsos parciais, a correção será proporcional quando as condições contratuais determinem uma redução proporcional da comissão. Um reembolso ao cliente sem redução da comissão não origina, por si só, uma nota de crédito da Eleva.
   Deverão ser cumpridos os requisitos de comunicação e prova necessários à regularização do IVA.

6. Dados de faturação e arredondamento — Aprovado
   Aprovo a recolha do nome ou denominação legal, identificação fiscal, morada e país do profissional, com validação dos requisitos aplicáveis a cada caso.
   Aprovo a utilização de precisão decimal e arredondamento comercial ao cêntimo, desde que o cálculo da base tributável, IVA e total seja compatível com as regras legais e com o TOConline. Não deverá ser aplicada uma regra de “arredondamento único” que produza divergências nesses valores.

7. Testes e séries — Aprovado
   Confirmo que não deverão ser finalizados documentos fiscais fictícios no TOConline nem usadas séries de produção para simular operações.
   As séries TEST não deverão ser comunicadas à AT no âmbito deste plano de testes. A sua não comunicação não as transforma num ambiente fiscal de testes nem autoriza a emissão de documentos fictícios.
   A utilização das séries ELEVA em produção dependerá da conclusão dos procedimentos legalmente exigidos, incluindo comunicação de séries e configuração dos elementos fiscais aplicáveis.

8. Registo da aprovação e ativação — Aprovado com condições
   Autorizo o registo desta resposta no diário de decisões como “Aprovado com condições”, com a data e o meu nome.
   A emissão automática apenas deverá ser ativada após cumprimento das condições acima e confirmação dos parâmetros fiscais pendentes. Esta resposta não autoriza a ativação de fluxos cuja configuração fiscal ainda não esteja validada.
