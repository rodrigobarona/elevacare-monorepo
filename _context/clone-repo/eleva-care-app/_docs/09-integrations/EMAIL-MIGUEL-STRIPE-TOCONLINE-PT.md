# Email ao Miguel – Modelo de negócio Eleva.care e integração Stripe + TOConline

> **Idioma:** pt-PT  
> **Destinatário:** Miguel (Tax Manager – Búzios e Tartarugas, Lda)  
> **Objectivo:** Explicar o modelo de marketplace da Eleva.care, a implementação com Stripe (Connect + Identity + payouts) e o plano de integração com TOConline para cumprimento fiscal em Portugal.

---

Assunto: Modelo de negócio Eleva.care e integração Stripe + TOConline para faturação de comissões

Olá Miguel,

Espero que esteja tudo bem consigo.  
Depois da nossa reunião recente, estive a consolidar a arquitectura técnica da Eleva.care e o enquadramento fiscal em Portugal, para garantir que o modelo de marketplace e as comissões cobradas aos especialistas ficam totalmente alinhados com as obrigações da Búzios e Tartarugas, Lda.

Queria partilhar consigo o panorama completo e o plano de integração com o TOConline, para que o possa analisar e validar connosco.

---

## 1. Contexto: o que é a Eleva.care e qual é o modelo de negócio

A Eleva.care é uma plataforma digital (marketplace) operada pela Búzios e Tartarugas, Lda (empresa portuguesa), que:

- Liga **especialistas de saúde** (nutrição, menopausa, saúde sexual, etc.) a **pacientes**;
- Permite aos especialistas configurarem serviços (consultas, sessões, etc.), agenda e preços;
- Permite aos pacientes marcarem e pagarem consultas online.

No modelo actual e previsto:

- O **paciente paga o valor total da consulta** (ex.: 100 €);
- Esse valor é considerado **prestação de serviços do especialista ao paciente**;
- A Eleva.care cobra ao especialista uma **comissão / “service fee” de 15%** sobre o valor da consulta;
  - No exemplo de 100 €, a Eleva.care factura 15 € ao especialista;
  - Os restantes 85 € são receita do especialista.

Ou seja, **não queremos ser “merchant of record” junto do paciente** (como fazem algumas plataformas), mas sim um marketplace que presta um serviço B2B ao especialista (angariação, tecnologia, pagamento, etc.) e cobra uma **comissão de intermediação**.

---

## 2. Como está implementado o fluxo de pagamentos com Stripe

Tecnologicamente usamos a Stripe como PSP (Payment Service Provider) e, em particular, o **Stripe Connect**:

1. **Pagamento do paciente**
   - O paciente entra na página da consulta, escolhe o horário e paga através de **Stripe Checkout** (cartão e, para Portugal, também Multibanco).
   - A Stripe cria um `payment_intent` pelo valor total (ex.: 100 €).

2. **Conta da plataforma e contas dos especialistas**
   - A Búzios e Tartarugas, Lda tem uma **conta Stripe principal**.
   - Cada especialista, após verificação de identidade, tem uma **conta Stripe Connect** (subconta) onde recebe os seus honorários.
   - A verificação de identidade é feita com **Stripe Identity** (documentos, KYC, etc.), e só depois disso permitimos a criação da conta Connect.

3. **Divisão automática do pagamento (split)**
   - Ao criar o pagamento, usamos os mecanismos nativos da Stripe:
     - `application_fee_amount` para definir a **comissão da Eleva** (15%);
     - `transfer_data[destination]` para enviar o **resto do valor para a conta Connect** do especialista.
   - No exemplo:
     - 100 € pagos pelo paciente;
     - 15 € ficam na conta Stripe da Búzios e Tartarugas (comissão);
     - 85 € são transferidos para a conta do especialista.

4. **Payouts para o especialista**
   - Temos jobs/rotinas (cron) que tratam de:
     - Respeitar um **período mínimo de “aging”** (por ex. 7 dias) e uma **margem de 24h após a consulta** para permitir reclamações, semelhante ao modelo da Airbnb;
     - Verificar saldos na conta Connect;
     - Criar **payouts** para a conta bancária do especialista através da Stripe.

Resumindo: **a Stripe já está a fazer a parte de PSP e split de pagamentos**, de forma robusta e auditável. Do ponto de vista económico, a Búzios e Tartarugas reconhece como receita apenas a **comissão (15%)**.

---

## 3. Enquadramento fiscal que pretendemos seguir

Do ponto de vista contabilístico e fiscal em Portugal, o modelo que queremos garantir é:

1. **Entre especialista e paciente**
   - O **especialista (ou a clínica)** é quem presta o serviço ao paciente (ex.: consulta de 100 €);
   - O especialista é responsável por **emitir a fatura de 100 € ao paciente**, com a sua própria série e regras de IVA consoante o enquadramento (consultas de saúde, etc.);
   - A Eleva.care não quer emitir fatura ao paciente pelo valor total.

2. **Entre Eleva.care (Búzios e Tartarugas, Lda) e especialista**
   - A Eleva presta ao especialista um **serviço de plataforma/intermediação**;
   - Por cada consulta, a Eleva cobra uma **comissão de 15%** (no exemplo, 15 €);
   - A Búzios e Tartarugas, Lda tem de **emitir fatura de 15 € ao especialista**, com o tratamento de IVA adequado:
     - Especialista em Portugal (B2B): IVA 23% sobre os 15 €;
     - Especialista B2B na UE (com VAT válido): 0% IVA, **autoliquidação (reverse charge)**;
     - Especialista fora da UE: 0% IVA, **exportação de serviços**.

3. **Obrigação de usar software certificado e SAF-T**
   - Como empresa portuguesa, a Búzios e Tartarugas, Lda deve:
     - Emitir faturas através de **software certificado** (daí a escolha do **TOConline**);
     - Garantir numeração sequencial, ATCUD, e inclusão em **ficheiro SAF-T PT**.

---

## 4. Plano de integração com o TOConline (via API)

Para cumprir estes requisitos de forma totalmente automática, definimos um plano de **integração directa (API)** entre a Eleva.care e o TOConline:

1. **Quando a Stripe confirma o pagamento** (`checkout.session.completed`):
   - O nosso backend recebe um **webhook da Stripe** com:
     - Valor total (100 €);
     - Valor da comissão (15 €);
     - Identificação do especialista e da consulta.

2. **Recolha de dados fiscais do especialista**
   - No registo/“onboarding” do especialista passamos a recolher:
     - NIF / VAT;
     - Nome/razão social;
     - Morada completa, código postal, cidade;
     - País (PT, ES, BR, US, etc.);
     - Informação se é empresa (B2B) ou particular (B2C);
     - Para UE B2B, o VAT será validado via VIES.

3. **Criação automática de cliente no TOConline**
   - Se o especialista ainda não existir no TOConline, a Eleva:
     - Chama a API de `customers` do TOConline;
     - Cria um cliente com NIF/VAT, nome e morada do especialista.

4. **Emissão automática da fatura da Eleva (FT)**
   - Depois disso, a Eleva chama a API `commercial_sales_documents` do TOConline para criar:
     - Uma **FT (Fatura)** numa série própria (ex.: prefixo `ELEVA`), só para comissões da plataforma;
     - Linha de serviço do tipo:
       - Descrição: “Serviço de plataforma Eleva Care – Consulta [ID/Descrição]”;
       - Quantidade: 1;
       - Valor unitário: 15 € (ou o valor da comissão correspondente);
       - Código de IVA:
         - PT: 23% NOR;
         - UE B2B: 0% ISE com motivo `M07 – Autoliquidação`;
         - Extra-UE: 0% ISE com motivo `M99 – Exportação de serviços`.
   - Esta fatura fica com numeração sequencial tipo: `ELEVA FT 2025/123`.

5. **Finalização e SAF-T**
   - A fatura é **finalizada** via API, o que:
     - Gera o número definitivo e o ATCUD;
     - Garante que o documento entra nos **ficheiros SAF-T** que o TOConline gera e comunica à AT.

6. **Acesso à fatura na área reservada do especialista/clínica**
   - No front-end da Eleva (zona `/account/billing` e áreas de “financeiro” em `src/app/(app)`), vamos disponibilizar:
     - Uma lista de **consultas/comissões**;
     - Links para **download do PDF da fatura emitida no TOConline** (via API);
   - O objectivo é que o especialista ou a clínica tenha uma experiência semelhante à da **Airbnb**, onde pode descarregar as faturas das comissões de serviço.

---

## 5. O que gostaríamos que validasse connosco

Para garantir que este desenho está sólido do ponto de vista fiscal, gostava que pudesse validar/ajudar nas seguintes questões:

1. **Modelo de base**
   - Confirma que o modelo “especialista fatura 100 € ao paciente” + “Eleva fatura 15 € ao especialista” é o mais adequado para uma plataforma como a nossa?
   - Vê algum risco ou alternativa recomendável (por ex. modelo “merchant of record”) que devêssemos considerar?

2. **Tratamento de IVA por localização do especialista**
   - PT: IVA 23% sobre a comissão – parece-lhe correcto?
   - UE B2B com VAT válido: 0% IVA com autoliquidação (`M07`), conforme Art. 6.º RITI – está de acordo com este enquadramento?
   - Extra-UE: 0% IVA como exportação de serviços (`M99`, Art. 6.º CIVA) – confirma que é a interpretação correcta?

3. **Obrigações adicionais**
   - Há alguma obrigação adicional (declarações recapitulativas intra-comunitárias, modelos específicos, etc.) que devamos ter em conta dada a natureza digital e transfronteiriça da plataforma?
   - Alguma recomendação específica para o texto a constar nas faturas (menções legais, notas, etc.)?

4. **Implementação técnica**
   - Vê alguma preocupação quanto ao facto de a emissão ser 100% automática via API do TOConline (desde que respeitemos série certificada, ATCUD, SAF-T, etc.)?
   - Sugere algum controlo/manual (por exemplo, reconciliação mensal de amostras de faturas) para auditoria?

Anexo/encaminho também documentação mais técnica que escrevi internamente (fluxos Stripe + TOConline e requisitos de faturação em Portugal), caso queira ver em maior detalhe.

Muito obrigado pela ajuda. Se preferir, posso marcar uma nova reunião depois de rever este email, para ajustarmos o modelo antes de avançarmos com a implementação técnica.

Um abraço,  
Rodrigo

16 Dezembro 2025
