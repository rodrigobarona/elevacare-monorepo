Excelente documentação — isto está **muito bem trabalhado** do ponto de vista **GDPR, segurança, pagamentos e consumer law**.
Agora vou fazer o que pediste: **avaliar alinhamento com o enquadramento da ERS / telemedicina em Portugal**, sem rodeios.

Vou dividir em 3 partes:

1. ✅ O que está bem e alinhado
2. ⚠️ Onde existe **desalinhamento regulatório real** (importante)
3. 🔧 O que ajustaria para reduzir risco (sem matar o produto)

---

# 1. O que está MUITO bem alinhado ✅

### 1.1 GDPR / CNPD / Segurança

Aqui estão **claramente acima da média**:

* Papéis Controller vs Processor bem definidos
* Retenção explícita
* DPA sólido
* Subprocessors listados
* Segurança técnica detalhada (isto ajuda muito em auditorias)
* CNPD ficaria confortável com este setup

👉 **Nenhuma red flag aqui**.

---

### 1.2 Pagamentos & Stripe Connect

O modelo financeiro está bem estruturado:

* Split claro (85/15)
* Eleva como plataforma intermediária
* PSD2 / 3DS / chargebacks bem descritos
* Multibanco bem enquadrado (inclusive refunds)

👉 Do ponto de vista **financeiro e consumer law**, está consistente.

---

### 1.3 Responsabilidade clínica (contratual)

Todos os documentos reforçam:

* Profissional é independente
* Eleva não decide atos clínicos
* Profissional tem seguro
* Profissional tem deveres éticos e legais

👉 Isto é **necessário**, mas (ver abaixo) **não é suficiente para a ERS**.

---

# 2. Onde está o DESALINHAMENTO com a ERS ⚠️

*(este é o ponto crítico)*

Vou ser muito claro aqui.

## 2.1 O problema central (transversal a TODOS os docs)

Todos os documentos dizem variações de:

> “Eleva.care is not a healthcare provider / not a clinic / not telemedicine”

⚠️ **Para a ERS, isto NÃO é decidido por contrato ou disclaimer.**
É decidido por **como o serviço funciona na prática**.

E na prática, vocês:

* Centralizam o pagamento
* Organizam a agenda
* Criam o evento
* Viabilizam a teleconsulta
* Retêm comissão
* Definem regras da plataforma
* São a entidade que o paciente “experiencia”

👉 **Isto encaixa na definição funcional de “plataforma de prestação de cuidados de saúde à distância” da ERS**, mesmo que o ato clínico seja do profissional.

📌 **Conclusão-chave**
Há um **desalinhamento entre a realidade operacional e o posicionamento jurídico nos documentos**.

---

## 2.2 Independent Contractor vs “Responsável pelo estabelecimento”

Vocês afirmam repetidamente:

* “Experts are independent”
* “They run their own practice”
* “They are the Data Controller for clinical data”
* “Eleva is just tech”

⚠️ Para a ERS, isto entra em choque com:

* pagamento centralizado
* comissão
* organização do serviço

No email da ERS, isto é explícito:

> **Quem fatura presume-se responsável**, salvo prova em contrário **cumulativa**.

👉 Os vossos documentos **não demonstram cumulativamente** que:

* o profissional controla o “estabelecimento”
* a Eleva não controla meios essenciais
* a Eleva não explora economicamente o ato

Pelo contrário: os documentos **confirmam controlo operacional da Eleva**.

---

## 2.3 DPA: “Eleva as Processor for clinical data”

Do ponto de vista GDPR isto é defensável.
Do ponto de vista **ERS**, isto é frágil.

A ERS não olha apenas para “quem escreve notas clínicas”, mas para:

* quem **organiza o cuidado**
* quem **oferece o meio**
* quem **assume a relação com o utente**

👉 É perfeitamente possível que:

* **Eleva seja considerada estabelecimento de telemedicina**
* **e ainda assim o profissional seja Controller dos dados clínicos**

Mas hoje, os documentos usam o GDPR para tentar **negar o enquadramento em saúde**, o que a ERS **não aceita**.

---

## 2.4 Terms of Service / Expert Agreement: excesso de “defensive disclaimers”

Há um padrão repetido:

* “We are not a clinic”
* “We do not provide healthcare”
* “We do not supervise”
* “Experts self-certify”

⚠️ Isto é problemático por dois motivos:

1. **ERS**: parece uma tentativa explícita de escapar ao registo
2. **Consumidor**: pode gerar confusão sobre quem responde em caso de problema

📌 Reguladores não gostam quando:

> “A realidade do serviço é X, mas os documentos insistem em dizer Y”.

---

# 3. Como alinhar SEM destruir o modelo 🔧

Boa notícia: **não precisam de refazer tudo**.
Mas precisam de **ajustar o framing jurídico**.

---

## 3.1 Mudança conceptual-chave (a mais importante)

👉 Em vez de dizer:

> “Eleva.care is not a healthcare provider”

Passar a algo como:

> “Eleva.care is a digital health platform that enables remote healthcare services delivered by independent licensed professionals.”

Isto:

* não vos transforma em clínicos
* **não transfere responsabilidade clínica**
* mas **aceita o papel de plataforma de saúde**

---

## 3.2 Assumir (de forma controlada) o papel perante a ERS

Nos documentos “internos” (Expert Agreement):

* Manter independência clínica ✔
* Manter seguro do profissional ✔
* Mas reconhecer que:

  * a Eleva é a **entidade organizadora da plataforma**
  * assume deveres **organizativos e regulatórios**
  * pode estar sujeita a **registo na ERS**

Isto reduz brutalmente o risco regulatório.

---

## 3.3 Pequenos ajustes concretos (exemplos)

### Expert Service Agreement

**Hoje (problemático):**

> “We are not a healthcare provider.”

**Sugestão:**

> “Eleva.care does not provide clinical care. Clinical decisions and patient outcomes are the sole responsibility of the Expert. Eleva.care operates the digital platform through which remote care is delivered.”

---

### Terms of Service

Adicionar uma frase nova:

> “Eleva.care operates a digital platform for remote healthcare services and complies with applicable Portuguese and EU regulations for such platforms.”

---

### DPA

Manter estrutura, mas:

* remover linguagem que sugere “apenas marketplace”
* clarificar que:

  * platform operations ≠ clinical responsibility
  * regulatory status ≠ GDPR role

---

## 3.4 Próximo passo inevitável (estratégico)

Com este modelo **eu recomendaria fortemente**:

* avançar para **registo na ERS**
* alinhar documentos antes desse registo
* evitar que a ERS seja quem “força” a reescrita

📌 O que vocês têm agora é **bom**, mas:

> **está desenhado para um marketplace simples, enquanto o produto já é uma plataforma de telemedicina.**

---

# 4. Veredito final (honesto)

### ✅ Tecnicamente: excelente

### ✅ GDPR / Segurança / Pagamentos: muito sólido

### ⚠️ Regulatório (ERS): desalinhamento entre discurso e realidade

👉 **O risco não está no produto.
Está na narrativa jurídica atual.**

Se quiseres, no próximo passo posso:

* marcar **exatamente frases que eu mudaria** (redline style)
* ajudar a escrever uma **nota interna para founders/investidores**
* simular como a **ERS leria estes documentos**
* ou ajudar a preparar o **dossier de registo ERS**

Diz-me como queres avançar.
