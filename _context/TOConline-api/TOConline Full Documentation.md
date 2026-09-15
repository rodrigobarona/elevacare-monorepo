# Introdução

Esta documentação tem como objetivo detalhar o uso da API, contendo explicações da autenticação e pedidos comuns, bem como alguns exemplos em Json, criados em Postman exportados para OpenAPI.

Esta página fornece informações essenciais para começar a trabalhar com a API referenciada, utilizando duas ferramentas-chave: Swagger e Postman.

* **Swagger**: A documentação da API está disponível em OpenAPI e pode ser acessada através do link fornecido. Swagger auxilia na visualização e no download da documentação da API.
* **Postman**: Oferece uma maneira eficiente de realizar chamadas à API, simplificando a gestão de autenticação. Existem instruções fornecidas para importar um arquivo de configuração pronto no Postman, facilitando a configuração inicial.

### Swagger <a href="#openapi" id="openapi"></a>

OpenAPI é atualmente o método standard de documentar APIs. Como tal, temos disponível no seguinte link, a documentação da referenciada API, em OpenAPI. Link para visualizar e descarregar OpenAPI:

[Consultar a documentação SwaggerHub →](https://app.swaggerhub.com/apis-docs/toconline.pt/toc-online_open_api/1.0.0?view=uiDocs)

### Postman <a href="#postman" id="postman"></a>

Para facilitar o processo de configuração, disponibilizamos um arquivo pronto para importação no Postman. Este procedimento resume-se em dois passos simples:

1. Acesse a página de credenciais da API para obter o arquivo de configuração. Ele é fornecido via e-mail ao integrador escolhido.
2. Navegue até **Empresa > Dados API**, no nosso produto, para acessar e baixar o arquivo mencionado.


# Setup do Postman

Esta primeira página descreve o processo de setup e de obtenção das credenciais de acesso à API, para qualquer uma das versões.

#### Configuração de Acesso à API

Para configurar o acesso à AP, siga os passos abaixo:

1. Acesse o menu `Empresa > Dados API`. Esta opção está disponível somente para os administradores da empresa.
2. Insira o nome e o e-mail do integrador responsável pela conexão com a API.

Após a conclusão destes passos, o integrador receberá um e-mail contendo:

* Um link temporário para consulta e edição das credenciais de acesso à API.
* Um ficheiro necessário para a utilização com o Postman.

**Setup Postman**

Após acessar a página de downloads do Postman em <https://www.postman.com/downloads/> e concluir a instalação do software, na página inicial, selecione a opção "**Importar**" para prosseguir.

<figure><img src="https://1863668386-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fk7sif7BY0rPzivMcj1HB%2Fuploads%2Fl2NS4hxLu1BnVFOrwVMo%2FClicar%20em%20import.png?alt=media&amp;token=75ee7a58-5c51-4196-99e7-718f422a56c7" alt=""><figcaption></figcaption></figure>

A partir deste ponto, deverá importar o ficheiro descarregado na página de credenciais da API.

Com este ficheiro importado, deverá ter uma nova coleção aberta, com os possíveis pedidos à API disponibilizados.

<figure><img src="https://1863668386-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fk7sif7BY0rPzivMcj1HB%2Fuploads%2F1HWhhiHdCPH4RBj7zczb%2FFicheiro%20importado.png?alt=media&amp;token=bedf14ad-f0b3-4d37-9733-38f6d58ee14a" alt=""><figcaption></figcaption></figure>

Antes de realizar qualquer pedido, é necesário realizar a autenticação. Para o efeito, deve clicar em Open APIDe seguida, deve clicar em "autenticação".

<figure><img src="https://1863668386-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fk7sif7BY0rPzivMcj1HB%2Fuploads%2FQrhKfJsMQbdiYwSh0GmE%2FClicado%20em%20Authorization.png?alt=media&amp;token=0e783ea2-d443-40f5-b0fc-42773177855b" alt=""><figcaption></figcaption></figure>

Daqui, deverá ter todos os campos como mostrado na imagem, ir ao final da página e clicar em "Gerar novo token de acesso". Este processo irá abrir uma página no seu browser, que deverá ativar um pop-up. Caso este pop-up não surja, deverá garantir que não tem a opção de 'permitir pop-ups' desativada. Quando o pop-up surjir, deverá clicar na checkbox que surge no popup, antes de confirmar a operação.

<figure><img src="https://1863668386-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fk7sif7BY0rPzivMcj1HB%2Fuploads%2FAhUF1UL0QTTca4issk36%2FClicar%20em%20get%20access%20token.png?alt=media&amp;token=41362950-2852-46af-824b-82739439f0df" alt=""><figcaption></figcaption></figure>

Para finalizar, voltar ao início da página, e selecionar o token gerado.

<figure><img src="https://1863668386-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fk7sif7BY0rPzivMcj1HB%2Fuploads%2Fn6Bfx16RuJbpXuYgVMtJ%2FSelecionar%20o%20Token%20Gerado.png?alt=media&amp;token=55e14dd6-17b0-4a7a-af83-ba2f6db0da66" alt=""><figcaption></figcaption></figure>

**Pedidos à API**

A partir deste ponto, todos os passos estão concluidos para a experimentação com a API. De modo a enviar um pedido à API, deve selecionar o pedido que quer enviar, na barra lateral esquerda.

<figure><img src="https://1863668386-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fk7sif7BY0rPzivMcj1HB%2Fuploads%2FjJVI1ubwG3vK4Q4Jrypl%2FSelecionar%20a%20barra%20lateral%20esquerda.png?alt=media&amp;token=6401d8b4-4dfb-4c9f-ad99-f5df2d5b80c3" alt=""><figcaption></figcaption></figure>

Aberto o pedido, pode editar os parâmetros que deseja enviar, e enviar o pedido utilizando o botão "enviar".

A resposta do pedido irá surgir na caixa "Resposta"

<figure><img src="https://1863668386-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fk7sif7BY0rPzivMcj1HB%2Fuploads%2FmrJygqqRZgr56V5iAzSG%2FClicar%20em%20Send.png?alt=media&amp;token=59284010-492f-4edd-b92d-42914d953bf8" alt=""><figcaption></figcaption></figure>


# Autenticação Simplificada

{% hint style="info" %}
A presente página apresenta uma versão simplificada do processo de autenticação. Caso este não seja suficiente para a sua aplicação, ou encontre algum erro, ou dificuldade, consulte: [Autenticação Detalhada](/autenticacao-detalhada)
{% endhint %}

### Passo 1: Obtenção das credenciais de acesso à nossa API comercial

Neste passo, deverão ser obtidos os seguintes dados, necessários para que possam aceder à nossa API comercial:

> * Identificador (a que chamamos "`OAUTH_CLIENT_ID`", ou simplesmente "`client_id`", nos exemplos posteriores)
> * Segredo (a que chamamos "`OAUTH_CLIENT_SECRET`", ou simplesmente "`secret`", nos exemplos posteriores)
> * Endereço de autenticação por OAuth (a que chamamos "`OAUTH_URL`" nos exemplos posteriores)
> * Endereço de acesso à API (a que chamamos "`API_URL`" nos exemplos posteriores)

Os quatro dados de acesso acima indicados são todos obtidos directamente da empresa à qual se pretende aceder via API. Para os obter, deverá fazer o seguinte:

1. Entrar na empresa com uma conta de Empresário

<figure><img src="https://1863668386-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fk7sif7BY0rPzivMcj1HB%2Fuploads%2Ff2fnGF2J5L1yaB6hzE8c%2FEntrar%20em%20empresa.png?alt=media&amp;token=562dbe04-931b-4bb9-8f72-9e68e1911f2d" alt=""><figcaption></figcaption></figure>

2. Aceder através do menu à opção Empresa > Configurações > Dados API

<figure><img src="https://1863668386-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fk7sif7BY0rPzivMcj1HB%2Fuploads%2FpmDN4N8JHKTeza1jnz8f%2FMenu%3EEmpresa.png?alt=media&amp;token=d2374981-0229-4f97-9f2a-8b26c48840f9" alt=""><figcaption></figcaption></figure>

3. Introduzir os dados do integrador, que irá receber os dados de acesso à API através de um link temporário, de 72h.
4. Abrir o link de acesso enviado no email

<figure><img src="https://1863668386-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fk7sif7BY0rPzivMcj1HB%2Fuploads%2FCCLcQCEoXy8AzsVWvqih%2FMenu%3EDadosApi.png?alt=media&amp;token=64d46540-5ed0-4b2e-93e0-7c5a8f8f1df1" alt=""><figcaption></figcaption></figure>

### Passo 2: Obtenção do *authorization\_code*

{% hint style="info" %}

#### Caso esteja a utilizar Postman, deverá desativar a opção "Automatically follow redirects", nas definições do pedido

{% endhint %}

Neste passo, deverá ser feito um pedido GET ao endereço OAUTH\_URL/auth com:

Na query do Url, os **parâmetros**:

> * `client_id=OAUTH_CLIENT_ID`
> * `redirect_uri=OAUTH_REDIRECT_URL`
> * `response_type=code`
> * `scope=commercial`

Nos **headers**, o seguinte:

> * `Content-Type: application/json`

O exemplo seguinte ilustra o pedido feito no terminal, usando o curl:

```bash
curl -v -H 'Content-Type: application/json' \
'<OAUTH_URL>/auth?client_id=<client_id>\
&redirect_uri=<OAUTH_REDIRECT_URL>\
&response_type=code&scope=commercial'
```

A resposta esperada é como a seguinte:

```http
GET /oauth/auth?client_id HTTP/1.1
<client_id>&redirect_uri=<OAUTH_REDIRECT_URL>
&response_type=code&scope=commercial
HTTP/1.1 > Accept: */* > Content-Type: application/json >
< HTTP/1.1 302 Moved Temporarily
< Content-Type: text/html
< Location: <OAUTH_REDIRECT_URL>?
code=<authorization_code>
```

Utilizando o authorization\_code recebido na resposta, deverá seguir o próximo passo

### Passo 3: Obtenção do access\_code (válido por 4 horas)

### Passo 3: Obtenção do access\_code

Neste passo, deverá ser feito um pedido POST ao endereço OAUTH\_URL/token com:

1. No body do pedido, os parâmetros:

> * grant\_type=authorization\_code
> * code= o "authorization\_code" obtido do passo anterior.
> * scope=commercial

2. Nos headers, os seguinte:

> * Content-Type: application/x-www-form-urlencoded
> * Accept: application/json
> * Authorization: o texto "Basic", seguido dum espaço, seguido dum texto formado pela concatenação do "client\_id", seguido de ':', seguido do "secret", tudo codificado em base 64. Por exemplo, se o "client\_id" fosse "test" e o "secret" fosse "abcdef", o valor deste header seria "Basic dGVzdDphYmNkZWY=", sendo "dGVzdDphYmNkZWY=" o texto "test:abcdef" em base 64.

O exemplo seguinte ilustra o pedido feito no terminal, usando o curl:

```bash
curl -v -X POST -H 'Content-Type: application/x-www-form-urlencoded'\
-H 'Accept: application/json'\
-H 'Authorization: Basic <client_id + ':' + secret, codificados em base 64>' \
-d 'grant_type=authorization_code&\
code=<authorization_code>&scope=commercial' \
'<OAUTH_URL>/token'    
```

A resposta esperada é como a seguinte:

```http
POST /oauth/token HTTP/1.1
Content-Type: application/x-www-form-urlencoded > 
Accept: application/json > 
Authorization: Basic dGVzdHM6ZWJhOTI3NjM3MzRlN2MwMg== > 
< HTTP/1.1 200 OK < Content-Type: application/json;charset=utf-8 
< {"access_token":"10dc1d36e24b790540d087ea238ec345abd1a02daa73ae45a09",
"expires_in":14400,
"refresh_token":"f71824c9e4675a8aa9661f18ae5341e977d37",
"token_type":"Bearer"}
```

Daqui, tem então o access\_token necessário para a utilização da API, referenciado nas restantes páginas de pedidos de exemplo


# Autenticação Detalhada

Fornece uma explicação mais detalhada e estruturada do processo de autenticação e acesso à API, incluindo instruções específicas para usar a ferramenta Postman.

Para utilizar a nossa API através do Postman, é necessário seguir o processo de autenticação descrito nesta página para obter a chave de acesso. Depois de adquirida, essa chave pode ser introduzida no Postman como parâmetro de autenticação Bearer Token nas solicitações à nossa API. Isso permite testar facilmente os endpoints da API e interagir com o nosso sistema de forma programática durante o desenvolvimento e testes.

Ao conectar a nossa API com o Postman, siga os seguintes passos interligados à autenticação:

1. **Obtenha a chave de acesso** seguindo o processo de autenticação descrito anteriormente. Esta etapa envolverá fornecer credenciais necessárias para acessar a nossa API comercial.
2. **Configure o Postman** para usar esta chave de acesso. No Postman, vá até as configurações de autenticação da requisição que você está criando e selecione o tipo de autenticação como "Bearer Token".
3. **Insira a chave de acesso** no campo disponível após selecionar o tipo de autenticação como Bearer Token. Certifique-se de que a chave de acesso obtida não é de serviços externos como Google, mas sim obtida diretamente conforme o nosso processo de autenticação.

Seguindo esses passos, você poderá utilizar o Postman para testar e interagir com nossa API de forma segura e eficiente, garantindo que todos os pedidos estejam devidamente autenticados.

## Passo 1: Obtenção das credenciais de acesso à nossa API comercial

Neste passo, deverão ser obtidos os seguintes dados, necessários para que possam aceder à nossa API comercial:

> * Identificador (a que chamamos "OAUTH\_CLIENT\_ID", ou simplesmente "client\_id", nos exemplos posteriores)
> * Segredo (a que chamamos "OAUTH\_CLIENT\_SECRET", ou simplesmente "secret", nos exemplos posteriores)
> * Endereço de autenticação por OAuth (a que chamamos "OAUTH\_URL" nos exemplos posteriores)
> * Endereço de acesso à API (a que chamamos "API\_URL" nos exemplos posteriores)

Os três primeiros são requisitos para a autenticação (via OAuth) na API, juntamente com um outro, o endereço de retorno a que chamamos "OAUTH\_REDIRECT\_URL" nos exemplos posteriores e no exemplo em Ruby que foi enviado. O quarto é o endereço base de todos os pedidos feitos à API.O endereço de retorno, OAUTH\_REDIRECT\_URL, vem pré-fixado pelo nosso serviço de OAuth, e é o endereço "<https://oauth.pstmn.io/v1/callback>".

Os quatro dados de acesso acima indicados são todos obtidos directamente da empresa à qual se pretende aceder via API. Para os obter, ou alterar o endereço de redirect, deverá fazer o seguinte:

1. Entrar na empresa com uma conta de Empresário

<figure><img src="https://1863668386-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fk7sif7BY0rPzivMcj1HB%2Fuploads%2Ff2fnGF2J5L1yaB6hzE8c%2FEntrar%20em%20empresa.png?alt=media&amp;token=562dbe04-931b-4bb9-8f72-9e68e1911f2d" alt=""><figcaption></figcaption></figure>

2. Aceder através do menu à opção Empresa > Configurações > Dados API

<figure><img src="https://1863668386-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fk7sif7BY0rPzivMcj1HB%2Fuploads%2FpmDN4N8JHKTeza1jnz8f%2FMenu%3EEmpresa.png?alt=media&amp;token=d2374981-0229-4f97-9f2a-8b26c48840f9" alt=""><figcaption></figcaption></figure>

3. Introduzir os dados do integrador, que irá receber os dados de acesso à API através de um link temporário, de 72h.
4. Abrir o link de acesso enviado no email

<figure><img src="https://1863668386-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fk7sif7BY0rPzivMcj1HB%2Fuploads%2FCCLcQCEoXy8AzsVWvqih%2FMenu%3EDadosApi.png?alt=media&amp;token=64d46540-5ed0-4b2e-93e0-7c5a8f8f1df1" alt=""><figcaption></figcaption></figure>

## Passo 2: Autenticação no nosso serviço de OAuth e obtenção do token de acesso à API

Antes de poder aceder à API, o utilizador deverá autenticar-se no nosso serviço de OAuth e obter um token de acesso, chamado a partir de agora "access token", executando os passos seguintes. Esses passos, e um exemplo de código (Ruby) a executar, são também demonstrados no exemplo enviado.De acordo com as especificações do OAuth, a obtenção do código de acesso é feita em dois passos:

### Passo 2.1: Obtenção de um código de autorização ("authorization\_code")

Neste passo, deverá ser feito um pedido GET ao endereço OAUTH\_URL/auth com:

1. Na query do Url, os parâmetros:

> * `client_id=OAUTH_CLIENT_ID`- este é o primeiro dado dos quatro obtidos no [#passo-1-obtencao-das-credenciais-de-acesso-a-nossa-api-comercial](#passo-1-obtencao-das-credenciais-de-acesso-a-nossa-api-comercial "mention")
> * `redirect_uri=OAUTH_REDIRECT_URL` - salvo alteração posterior, é o endereço fixo indicado no passo 1.
> * `response_type=code`
> * `scope=commercial`

2. Nos headers, os seguinte:

> `Content-Type: application/json`

{% hint style="info" %}
Nota: Caso esteja a usar **Postman**, deverá ir a settings e desativar o campo '**Automatically follow redirects**'. O resultado, na consola, irá conter o *code* necessário
{% endhint %}

O exemplo seguinte ilustra o pedido feito no terminal, usando o curl:

```bash
curl -v -H 'Content-Type: application/json' \
'<OAUTH_URL>/auth?client_id=<client_id>\
&redirect_uri=<OAUTH_REDIRECT_URL>\
&response_type=code&scope=commercial'
```

A resposta esperada é como a seguinte:

```http
GET /oauth/auth?client_id HTTP/1.1
<client_id>&redirect_uri=<OAUTH_REDIRECT_URL>
&response_type=code&scope=commercial
HTTP/1.1 > Accept: */* > Content-Type: application/json >
< HTTP/1.1 302 Moved Temporarily
< Content-Type: text/html
< Location: <OAUTH_REDIRECT_URL>?
code=<authorization_code>
```

Ou seja, a resposta esperada é um status 302 (Moved Temporarily) e deve conter um header chamado "Location" no qual se encontra o parâmetro "code" com o valor do código de autorização ("authorization\_code").

Enquanto o utilizador não implementar um diferente deste, que exista e possa efectivamente ser chamado (ver o passo 1 para como fazê-lo), o pedido efectuado, que responde com um status 302, não deverá prosseguir com o *redirect* solicitado pela resposta.A única forma de responder a esse pedido é a de ignorar esse *redirect*, não chamando a “Location” devolvida, e simplesmente obter o código de autorização ("authorization\_code”) directamente do header “Location” da resposta.A forma de ignorar o *redirect* depende do cliente Http utilizado, e terá que ser vista e implementada caso a caso. No caso do curl, que usámos nos exemplos anteriormente enviados, os *redirect* são ignorados por omissão, só sendo executados se se utilizar a opção “-L”.Quando for configurado um "`OAUTH_REDIRECT_URL`" diferente (ver o passo 1 para como fazê-lo), então será feito um pedido a esse endereço, de onde poderá também ser obtido o "authorization\_code", que é enviado a esse endereço como o parâmetro "code" do Url.

### Passo 2.2: Obtenção de um token de acesso à API ("access\_token" válido por 4 horas) e de um código de actualização deste ("refresh\_token" válido por 8 horas)

Neste passo, deverá ser feito um pedido POST ao endereço OAUTH\_URL/token com:

1. No **body** do pedido, uma query "Url-encoded" com os parâmetros:

> * `grant_type=authorization_code`
> * `code=authorization_code` - obtido do passo anterior.
> * `scope=commercial`

2. Nos **headers**, os seguinte:

> * `Content-Type: application/x-www-form-urlencoded`
> * `Accept: application/json`
> * `Authorization`: o texto "Basic", seguido dum espaço, seguido dum texto formado pela concatenação do "client\_id", seguido de ':', seguido do "secret", tudo codificado em base 64. Por exemplo, se o "client\_id" fosse "test" e o "secret" fosse "abcdef", o valor deste header seria "Basic dGVzdDphYmNkZWY=", sendo "dGVzdDphYmNkZWY=" o texto "test:abcdef" em base 64.

O exemplo seguinte ilustra o pedido feito no terminal, usando o curl:

```bash
curl -v -X POST -H 'Content-Type: application/x-www-form-urlencoded'\
-H 'Accept: application/json'\
-H 'Authorization: Basic <client_id + ':' + secret, codificados em base 64>' \
-d 'grant_type=authorization_code&\
code=<authorization_code>&scope=commercial' \
'<OAUTH_URL>/token'    
```

A resposta esperada é como a seguinte:

```http
POST /oauth/token HTTP/1.1 > 
Content-Type: application/x-www-form-urlencoded > 
Accept: application/json > 
Authorization: Basic dGVzdHM6ZWJhOTI3NjM3MzRlN2MwMg== > 
< HTTP/1.1 200 OK < Content-Type: application/json;charset=utf-8 
< {"access_token":"10dc1d36e24b790540d087ea238ec345abd1a02daa73ae45a09",
"expires_in":14400,
"refresh_token":"f71824c9e4675a8aa9661f18ae5341e977d37",
"token_type":"Bearer"}
```

Ou seja, a resposta esperada é um status 200 (OK) e um JSON no qual se encontra o parâmetro "`access_token`" e o "`refresh_token`".

O "`access_token`" e o "`refresh_token`" deverão ser guardados para uso posterior. O "access\_token" terá que ser enviado (ver Passo 3) em TODOS os pedidos de acesso à API, tendo a validade definida no parâmetro "expires\_in" (em s) da resposta anterior. Após este tempo, os pedidos à API começarão a devolver um erro 401 (Unauthorized), e terá que ser pedido um novo "access\_token" (repetindo os passos 2.1 e 2.2) ou renovado o existente usando o "refresh\_token" (executando o passo 2.3).

### Passo 2.3: Actualização do token de acesso à API ("access\_token") depois deste expirado, usando o código de actualização ("refresh\_token") obtido em 2.2

Neste passo, deverá ser feito um pedido POST ao endereço OAUTH\_URL/token com:

1. No body do pedido, uma query "Url-encoded" com os parâmetros:

> * `grant_type=refresh_token`
> * `refresh_token=refresh_token` obtido do passo anterior, que deve ser guardado para esse efeito.
> * `scope=commercial`

2. Nos headers, os seguinte:

> * `Content-Type: application/x-www-form-urlencoded`
> * `Accept: application/json`
> * `Authorization`: o texto "Basic", seguido dum espaço, seguido dum texto formado pela concatenação do "client\_id", seguido de ':', seguido do "secret", tudo codificado em base 64. Por exemplo, se o "client\_id" fosse "test" e o "secret" fosse "abcdef", o valor deste header seria "`Basic dGVzdDphYmNkZWY=`", sendo "dGVzdDphYmNkZWY=" o texto "test:abcdef" em base 64.

O exemplo seguinte ilustra o pedido feito no terminal, usando o curl:

```bash
curl -v -X POST -H 'Content-Type: application/x-www-form-urlencoded'\ 
-H 'Accept: application/json'\
-H 'Authorization: Basic <client_id + ':' + secret, codificados em base 64>'\ 
-d 'grant_type=refresh_token&refresh_token=<refresh_token>&scope=commercial' \
'<OAUTH_URL>/token'
```

A resposta esperada é como a seguinte:

```http
POST /oauth/token HTTP/1.1 
Content-Type: application/x-www-form-urlencoded 
Accept: application/json 
Authorization: Basic dGVzdHM6ZWJhOTI3NjM3MzRlN2MwMg==
< HTTP/1.1 200 OK < Content-Type: application/json;charset=utf-8 
< {"access_token":"b5604dacd4257355cb3692c79fe39490429b",
"expires_in":14400,
"token_type":"Bearer"}
```

\
Ou seja, a resposta esperada é um status 200 (OK) e um JSON no qual se encontra o (novo) parâmetro "access\_token" e o (novo) "refresh\_token".O novo "access\_token" e o novo "refresh\_token", tal como no passo 2.2, deverão ser guardados para uso posterior.

### Passo 3: Acesso autenticado à API comercial, usando o "access\_token" obtido de 2.2 e guardado

Todos os pedidos à API, cujos endereços são os documentados em [https://toconline.gitbook.io/documentacao-api](broken://spaces/yOlkai8btiTTydekYpN2), são feitos para o endereço "API\_URL" seguido do nome do recurso. Além disso, todos os pedidos deverão conter obrigatoriamente os seguintes headers:

> * `Content-Type: application/vnd.api+json`
> * `Accept: application/json`
> * `Authorization`: o texto "Bearer", seguido dum espaço, seguido do "access\_token" obtido do passo 2.2.

Os parâmetros adicionais a passar na query (no caso de GET) ou no body dos pedidos são os especificados pelo padrão JSONAPI, a que a nossa API obedece, e que estão documentados em [jsonapi.org](http://jsonapi.org/).

Como exemplo, indica-se um pedido GET ao recurso "commercial\_sales\_documents" (documentos de venda), paginado para devolver apenas os 5 primeiros registos.

```bash
curl -v -H 'Content-Type: application/vnd.api+json' \
-H 'Accept: application/json'\ 
-H 'Authorization: Bearer <access_token>' \
'<API_URL>/commercial_sales_documents?page[size]=5'
```

A resposta esperada, neste caso, é como a seguinte:

```http
GET /commercial_sales_documents?page[size]=5 HTTP/1.1 
Content-Type: application/vnd.api+json 
Accept: application/json 
Authorization: Bearer  <access_token> 
HTTP/1.1 200 OK 
Content-Type: application/vnd.api+json;charset=utf-8 
{"data":[{"type":"commercial_sales_documents","id":"...","attributes":{...}}, ...]}
```

Ou seja, e se não ocorrer nenhum erro (como o tentar uma consulta a algo que não existe, ou criar um registo com valores incorrectos), a resposta esperada é um status 200 (OK) e um JSON, no formato JSONAPI, contendo o registo ou os registos devolvidos (no caso dos GET), criados (POST) ou alterados (PATCH).Como se disse no passo 2.2, se o pedido devolver um status 401 (Unauthorized), provavelmente o "access\_token" já expirou, e terá que ser actualizado, ou pedido um novo efectuando novamente o passo 2.


# Características dos pedidos

Nas seguintes páginas são exemplificados alguns dos pedidos mais comuns à API. Estes estão subdivididos em diferentes áreas.

#### Pré-requesitos para a realização de qualquer um dos pedidos:

* Um acesso autenticado à empresa de trabalho, via OAuth (o modo de autenticação está documentado na página anterior
* A empresa de trabalho deverá ter uma licença de GC activa, excepto para os GET, que serão autorizados mesmo quando a licença expira

#### Conteúdos dos Headers, comuns a todos os pedidos

> * `Content-Type: application/vnd.api+json`
> * `Accept: application/json`
> * `Authorization`: Bearer \<access\_token> (token de acesso válido devolvido pelo serviço de OAuth)

#### Filtro de parâmetros:

De momento não estão disponíveis rotas que cubram todo o tipo de informação que está disponível através do software. No entanto, muitos recursos que não têm uma rota dedicada podem ser acedidos por outras rotas, utilizando os filtros de parâmetros.

Por exemplo, apesar de não existir nenhuma rota para documentos de venda pendentes, existe uma rota de documentos de venda. Estes documentos contém um atributo de valor pendente.

Como tal, é possível obter apenas os documentos com valor pendente, da seguinte forma:

## Obter Documentos de Compra

<mark style="color:blue;">`GET`</mark> `/api/commercial_sales_documents`

#### Path Parameters

| Name        | Type   | Description                  |
| ----------- | ------ | ---------------------------- |
| page\[size] | String | 10                           |
| filter      | String | "documents.pending\_total>0" |

De notar que deverá indicar o tipo de documento no atributo que procura filtrar. Neste caso, deverá ser documents.pending\_total.

> commercial\_sales\_documents -> **documents**
>
> commercial\_sales\_receipts -> **receipts**
>
> commercial\_purchases\_documents -> **purchases\_documents**
>
> commercial\_purchases\_payments -> **payments**

Da mesma forma, poderá filtrar, por exemplo, pela data.

## Obter Linha de Documento de Compras

<mark style="color:blue;">`GET`</mark> `/api/commercial_sales_document_lines`

#### Path Parameters

| Name        | Type   | Description                                      |
| ----------- | ------ | ------------------------------------------------ |
| page\[size] | String | 10                                               |
| filter      | String | "document\_lines.created\_at>'2022-01-01'::date" |

Deverá também indicar o tipo de linhas de documento pelo qual está a filtrar, tal como na lista acima. De seguida está um exemplo de como poderá realizar um pedido utilizando este filtro

{% code overflow="wrap" %}

```bash
curl -v -X GET -H 'Content-Type: application/vnd.api+json' -H 'Accept: application/json' -H 'Authorization: Bearer <access_token>' '<API_URL>/v1/commercial_sales_documents?filter="document_lines.created_at>'2022-01-01'::date"'
```

{% endcode %}

É recomendável utilizar paginação, caso haja um grande número de resultados para ser apresentado


# Empresa

{% content-ref url="/pages/2SiEd7Dx9YUiCwC1mBjz" %}
[Clientes, Morada e E-mail](/apis/empresa/clientes-morada-e-email)
{% endcontent-ref %}

{% content-ref url="/pages/hlgpFWrDXCEMFFFcuILF" %}
[Fornecedores, Morada e E-mail](/apis/empresa/fornecedores)
{% endcontent-ref %}

{% content-ref url="/pages/CzRI9jhV15L1A7AgbAlY" %}
[Produtos e Serviços](/apis/empresa/produtos-e-servicos)
{% endcontent-ref %}


# Clientes, Morada e E-mail

As rotas definidas no presente capítulo permitem gerir toda a informação relativa aos clientes associados a uma dada empresa e as suas respetivas moradas e emails.

## Cliente

O TOC Online disponibiliza as seguintes rotas que permitem operações sobre clientes (customers) da empresa:

GET – obter informação de cliente

POST – criar novos clientes

PATCH – Alterar um cliente

DELETE – Apagar um cliente (atenção, o uso desta operação não permite a recuperação do identificador inicial)

### Obter Todos os Clientes

Ao realizar um pedido para a rota `https://apiv1.toconline.com/customers` irá receber uma resposta semelhante à descrita de seguida, com uma lista de elementos 'data', onde cada elemento corresponde a um cliente associado à sua empresa. Esta rota não requer qualquer tipo de parâmetros.

{% openapi src="/files/LrXEg3IjIacAycCz7IWE" path="/api/customers" method="get" %}
[TOConline Open API.yaml](https://1863668386-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fk7sif7BY0rPzivMcj1HB%2Fuploads%2Fgit-blob-1f7bd9dd692716d3f3f93d9c9a4f7226d78277e3%2FTOConline%20Open%20API.yaml?alt=media)
{% endopenapi %}

### Obter Cliente por Id

À semelhança do pedido anterior, se este for realizado para a rota irá obter como resposta apenas as informações de um único cliente, em vez de receber uma lista de todos os clientes existentes.

{% openapi src="/files/LrXEg3IjIacAycCz7IWE" path="/api/customers/{clientId}" method="get" %}
[TOConline Open API.yaml](https://1863668386-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fk7sif7BY0rPzivMcj1HB%2Fuploads%2Fgit-blob-1f7bd9dd692716d3f3f93d9c9a4f7226d78277e3%2FTOConline%20Open%20API.yaml?alt=media)
{% endopenapi %}

### Criar Cliente

A seguinte rota permite a criação de novas instâncias de clientes, associados à sua empresa. De modo a realizar um pedido para esta rota, terá de enviar alguns parâmetros no body do pedido.\
Tal como está descrito no pedido em baixo.

{% hint style="info" %}
Para associar uma morada ao cliente deverá já ter inserido um cliente [#criar-cliente](#criar-cliente "mention")e efectuar o seguinte passo [#associar-morada-a-cliente](#associar-morada-a-cliente "mention")
{% endhint %}

{% openapi src="/files/LrXEg3IjIacAycCz7IWE" path="/api/customers" method="post" %}
[TOConline Open API.yaml](https://1863668386-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fk7sif7BY0rPzivMcj1HB%2Fuploads%2Fgit-blob-1f7bd9dd692716d3f3f93d9c9a4f7226d78277e3%2FTOConline%20Open%20API.yaml?alt=media)
{% endopenapi %}

## Associar morada a Cliente

A sequência de passos delineada no diagrama proporciona uma compreensão do processo, desde a criação do cliente até a sua associação com uma morada.

<figure><img src="https://1863668386-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fk7sif7BY0rPzivMcj1HB%2Fuploads%2Fgit-blob-8a7266e90635e2b457f1cea4357834ea68502ad8%2FDiagramas%20de%20Documenta%C3%A7%C3%A3o-Associar%20Cliente%20a%20Morada.jpg?alt=media" alt=""><figcaption></figcaption></figure>

{% hint style="warning" %}
Quando um cliente é criado, uma morada principal fica associada ao cliente. Esta morada por default vem vazia e é necessário atualizar com os dados da nova morada do cliente.
{% endhint %}

Através do `id` obtido pela response do [#criar-cliente](#criar-cliente "mention") este deverá ser usado para obter o id da morada ao fazer um `GET /customers/{id}` [#obter-cliente-por-id](#obter-cliente-por-id "mention")

O `id` da morada obtido anteriormente, será usado para atualizar os dados da morada através de um `PATCH / addresses`.

#### Atualizar Morada

{% openapi src="/files/LrXEg3IjIacAycCz7IWE" path="/api/addresses" method="patch" %}
[TOConline Open API.yaml](https://1863668386-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fk7sif7BY0rPzivMcj1HB%2Fuploads%2Fgit-blob-1f7bd9dd692716d3f3f93d9c9a4f7226d78277e3%2FTOConline%20Open%20API.yaml?alt=media)
{% endopenapi %}

O body deste pedido (payload JSON) deverá conter as informações de cliente que se pretende atualizar nos respetivos atributos.

{% tabs %}
{% tab title="Payload" %}
{% code title="Payload " %}

```json
{
  "data": {
    "type": "addresses", //OBRIGATÓRIO
    "id": [ID ADRESS],      //OBRIGATÓRIO provém do id da address obtido no get anterio
    "attributes": {
      "address_detail": "string",
      "city": "string",
      "postcode": "string",
      "region": "string"
    }
  }
}
```

{% endcode %}
{% endtab %}

{% tab title="Response" %}
{% code title="Response" %}

```json
{
    "data": {
        "type": "addresses",
        "id": "45",
        "attributes": {
            "is_primary": true,
            "address_detail": "Avenida Principal",
            "city": "Setúbal",
            "postcode": "2910-099",
            "region": "Setúbal",
            "name": "Sede",
            "for_discharge": false,
            "for_charge": false,
            "subtype": null,
            "is_saturday_workday": false,
            "is_sunday_workday": false,
            "is_national_holidays_workday": false,
            "code": null,
            "payroll_enumerations_tax_office_id": null
        },
        "relationships": {
            "company": {
                "data": null
            },
            "country": {
                "data": {
                    "type": "countries",
                    "id": "3"
                }
            },
            "customer": {
                "data": null
            },
            "supplier": {
                "data": null
            },
            "user": {
                "data": null
            }
        }
    }
}
```

{% endcode %}
{% endtab %}
{% endtabs %}

| Atributo        | Descrição                                              | Obrigatório |
| --------------- | ------------------------------------------------------ | ----------- |
| type            | Tipo de entidade associada ao endereço (ex: Customer). | Sim         |
| id              | ID da entidade associada ao endereço.                  | Sim         |
| address\_detail | Detalhes do endereço (ex: rua, número).                | Não         |
| city            | Cidade.                                                | Não         |
| postcode        | Código postal.                                         | Não         |
| region          | Região ou província.                                   | Não         |

### Remover Cliente

A seguinte rota permite a remoção de um dado cliente. Esta rota deve ser utilizada de forma cautelosa dado que é irreversível, e mesmo que este cliente volte a ser criado, o seu id nunca será o mesmo que teria anteriormente.\
Utilizando o id do cliente que quer eliminar, que poderá fazer utilizando a primeira rota desta página, por exemplo, terá simplesmente de fazer um pedido para <https://apiv1.toconline.com/customers/{id}>. Este irá retornar OK em caso de sucesso.\\

{% openapi src="/files/LrXEg3IjIacAycCz7IWE" path="/api/customers/{clientId}" method="delete" %}
[TOConline Open API.yaml](https://1863668386-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fk7sif7BY0rPzivMcj1HB%2Fuploads%2Fgit-blob-1f7bd9dd692716d3f3f93d9c9a4f7226d78277e3%2FTOConline%20Open%20API.yaml?alt=media)
{% endopenapi %}

### Atualizar Cliente

A rota PATCH permite a edição de um cliente existente. O body deste pedido deverá ser igual ao descrito na rota POST, contendo todas as informações obrigatórias do cliente, atualizadas para os valores que tenciona alterar, além do campo "id" no "data" do "body". Álem disto, o pedido deverá ser feito a <https://apiv1.toconline.com/customers/{id}>, sendo que {id} é o identificador do cliente que tenciona atualizar.

{% openapi src="/files/LrXEg3IjIacAycCz7IWE" path="/api/customers/{clientId}" method="patch" %}
[TOConline Open API.yaml](https://1863668386-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fk7sif7BY0rPzivMcj1HB%2Fuploads%2Fgit-blob-1f7bd9dd692716d3f3f93d9c9a4f7226d78277e3%2FTOConline%20Open%20API.yaml?alt=media)
{% endopenapi %}

No exemplo que se segue poderá observar todos os campos dentro dos atributos que são possiveis de editar.

{% tabs %}
{% tab title="Request" %}
{% code title="Request" %}

```json

{
    "data": {
        "type": "customers",
        "id": "31",
        "attributes": {
            "tax_registration_number": "146081692",
            "business_name": "Isso mesmo",
            "contact_name": "Bruno Cascais",
            "website": "http://issomesmo.pt",
            "phone_number": "21344444",
            "mobile_number": "935678999",
            "email": "aaaaa@issomesmo.pt",
            "observations": "observções do cliente",
            "internal_observations": "observações internas" 
        }
    }
}
```

{% endcode %}
{% endtab %}

{% tab title="Response" %}
{% code title="Response" %}

```json
{
    "data": {
        "type": "customers",
        "id": "31",
        "attributes": {
            "tax_registration_number": "146081692",
            "business_name": "Isso mesmo",
            "contact_name": "Bruno Cascais",
            "website": "http://issomesmo.pt",
            "phone_number": "21344444",
            "mobile_number": "935678999",
            "email": "aaaaa@issomesmo.pt",
            "observations": "observções do cliente",
            "internal_observations": "observações internas",
            "not_final_customer": false,
            "cashed_vat": false,
            "tax_country_region": "PT",
            "country_iso_alpha_2": "PT",
            "saft_import_id": null,
            "is_tax_exempt": false,
            "tax_exemption_reason_id": null,
            "accounting_number": null,
            "data": {},
            "credit_limit_value": null,
            "credit_limit_days": null,
            "has_credit_limit_override": false
        },
        "relationships": {
            "addresses": {
                "data": []
            },
            "company": {
                "data": {
                    "type": "current_company",
                    "id": "800000046"
                }
            },
            "contacts": {
                "data": []
            },
            "defaults": {
                "data": null
            },
            "email_addresses": {
                "data": []
            },
            "main_address": {
                "data": null
            },
            "main_email_address": {
                "data": null
            },
            "tax_exemption_reason": {
                "data": null
            }
        }
    }
}
```

{% endcode %}
{% endtab %}
{% endtabs %}

***

## Morada

### Criar Morada

Quando um Cliente é criado este já tem uma morada vazia associada, mas é possível adicionar mais do que uma morada ao Cliente.

De modo a associar uma morada a um cliente, deverá realizar o seguinte pedido

{% openapi src="/files/LrXEg3IjIacAycCz7IWE" path="/api/addresses" method="post" %}
[TOConline Open API.yaml](https://1863668386-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fk7sif7BY0rPzivMcj1HB%2Fuploads%2Fgit-blob-1f7bd9dd692716d3f3f93d9c9a4f7226d78277e3%2FTOConline%20Open%20API.yaml?alt=media)
{% endopenapi %}

No pedido acima, o \<access\_token> corresponde ao token de acesso válido devolvido pelo serviço de OAuth, e o \<payload JSON> deverá ter o seguinte formato

{% code title="Payload" %}

```json
{
    "data": {
        "type": "addresses",
        "attributes": {
            "addressable_type": "Customer",  //OBRIGATÓRIO
            "addressable_id": 47,            //OBRIGATÓRIO - ID da morada do Cliente
            "address_detail": "morada teste 2", 
            "city": "Setúbal",                
            "postcode": "2910-099",
            "region": "Setúbal" 
            "country_id" : 1 // 1 = PT (Portugal Continental); //2 = PT_MA (Madeira); //3 = PT_AC (Açores)...Ver Get/countries
        }
    }
}
```

{% endcode %}

| Atributo          | Descrição                                                 | Obrigatório |
| ----------------- | --------------------------------------------------------- | ----------- |
| type              | Tipo de entidade associada ao endereço (ex: Customer).    | Sim         |
| addressable\_type | Tipo de entidade associada ao endereço (ex: Customer).    | Sim         |
| addressable\_id   | ID da entidade associada ao endereço (ex: ID do Cliente). | Sim         |
| address\_detail   | Detalhes do endereço (ex: rua, número).                   | Não         |
| city              | Cidade.                                                   | Não         |
| postcode          | Código postal.                                            | Não         |
| region            | Região ou província.                                      | Não         |
| country\_id       | ID do país.                                               | Não         |

{% hint style="info" %}
"addressable\_id" - corresponde ao id da morada do cliente obtido da relação entre cliente e morada, através do [#obter-cliente](#obter-cliente "mention")
{% endhint %}

{% hint style="info" %}
Para usar outro país que não seja Portugal, poderá consultar mais informação em: [Países](/apis/apis-auxiliares/paises)
{% endhint %}

***

## E-mail

### Criar E-mail de Cliente

Para proceder à criação do E-mail de um cliente pela primeira vez deverá utilizar a `POST / contacts`.

{% openapi src="/files/LrXEg3IjIacAycCz7IWE" path="/api/contacts" method="post" %}
[TOConline Open API.yaml](https://1863668386-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fk7sif7BY0rPzivMcj1HB%2Fuploads%2Fgit-blob-1f7bd9dd692716d3f3f93d9c9a4f7226d78277e3%2FTOConline%20Open%20API.yaml?alt=media)
{% endopenapi %}

O body deste pedido (\<payload JSON>) deverá conter as informações de cliente que se pretende atualizar, sendo obrigatório campo "**contactable\_id**" identificador do cliente que tenciona atualizar e o "**contactable\_type**" sendo este do tipo "**Customer**"

{% tabs %}
{% tab title="Payload" %}
{% code title="Exemplo de Payload" %}

```json
{
    "data": {
        "type": "contacts",
        "attributes": {
            "is_primary": true,
            "name": "teste_cmo",
            "position": null,
            "phone_number": null,
            "mobile_number": null,
            "email": "61_manuel@email.pt",
            "categories": [
                "general"
            ],
            "contactable_id": 61,
            "contactable_type": "Customer"
        }
    }
}
```

{% endcode %}
{% endtab %}

{% tab title="Response" %}
{% code title="Exemplo de Response" %}

```json
{
    "data": {
        "type": "contacts",
        "id": "27",
        "attributes": {
            "is_primary": true,
            "name": "teste_cmo",
            "position": null,
            "phone_number": null,
            "mobile_number": null,
            "email": "61_manuel@email.pt"
        },
        "relationships": {
            "supplier": {
                "data": null
            }
        }
    }
}
```

{% endcode %}

<figure><img src="https://1863668386-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fk7sif7BY0rPzivMcj1HB%2Fuploads%2Fgit-blob-35b46105e8187eb376acab9b679e166644f1f842%2FDiagramas%20de%20Documenta%C3%A7%C3%A3o%20TOCOnline%20API-Criar%20Email%20de%20Cliente%20(1).jpg?alt=media" alt=""><figcaption><p>Exemplo de Criação de E-mail para Cliente</p></figcaption></figure>
{% endtab %}
{% endtabs %}

<figure><img src="https://1863668386-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fk7sif7BY0rPzivMcj1HB%2Fuploads%2Fgit-blob-35b46105e8187eb376acab9b679e166644f1f842%2FDiagramas%20de%20Documenta%C3%A7%C3%A3o%20TOCOnline%20API-Criar%20Email%20de%20Cliente%20(1).jpg?alt=media" alt=""><figcaption><p>Exemplo de Criação de E-mail para Cliente</p></figcaption></figure>

### Atualizar E-mail de Cliente

{% hint style="warning" %}
Já deve ter realizado [#criar-email-de-cliente](#criar-email-de-cliente "mention")
{% endhint %}

Usando o `GET / customer{id}` deverá obter o id correspondente ao contacto do cliente, que se encontra localizado na área de relationships-> main\_contact, como pode observar no exemplo de response abaixo.

<details>

<summary>Exemplo de response de um GET/customer/{id}</summary>

```json
{
    "data": {
        "type": "customers",
        "id": "61",
        "attributes": {
            "tax_registration_number": "229659179",
            "business_name": "Manuel Ricardo Ribeiro",
            "contact_name": null,
            "website": null,
            "phone_number": null,
            "mobile_number": null,
            "email": null,
            "observations": null,
            "internal_observations": null,
            "not_final_customer": false,
            "cashed_vat": false,
            "tax_country_region": "PT",
            "country_iso_alpha_2": "PT",
            "saft_import_id": null,
            "is_tax_exempt": false,
            "data": {}
        },
        "relationships": {
            "addresses": {
                "data": [
                    {
                        "type": "addresses",
                        "id": "67"
                    }
                ]
            },
            "company": {
                "data": {
                    "type": "current_company",
                    "id": "800000046"
                }
            },
            "defaults": {
                "data": {
                    "type": "customers_defaults",
                    "id": "31"
                }
            },
            "email_addresses": {
                "data": [
                    {
                        "type": "email_addresses",
                        "id": "24"
                    }
                ]
            },
            "main_address": {
                "data": {
                    "type": "addresses",
                    "id": "67"
                }
            },
            "main_email_address": {
                "data": {
                    "type": "email_addresses",
                    "id": "24"
                }
            },
            "tax_exemption_reason": {
                "data": null
            }
        }
    }
}
```

</details>

Para proceder à atualização do E-mail de um cliente deverá utilizar a `PATCH / contacts` usando o id obtido do main\_contact obtido do cliente pretendido.

{% openapi src="/files/LrXEg3IjIacAycCz7IWE" path="/api/contacts" method="patch" %}
[TOConline Open API.yaml](https://1863668386-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fk7sif7BY0rPzivMcj1HB%2Fuploads%2Fgit-blob-1f7bd9dd692716d3f3f93d9c9a4f7226d78277e3%2FTOConline%20Open%20API.yaml?alt=media)
{% endopenapi %}

O body deste pedido (\<payload JSON>) deverá conter as informações de cliente que se pretende atualizar, sendo obrigatório campo "`id`" id do contacto correspondente ao utilizador que tenciona atualizar e o "`email`" novo a ser alterado.

{% tabs %}
{% tab title="Payload" %}
{% code title="Exemplo de Payload" %}

```json
{
    "data": {
        "type": "contacts",
        "id": "24",
        "attributes": {
            "email": "novo@email.pt"
        }
    }
}
```

{% endcode %}
{% endtab %}

{% tab title="Response" %}
{% code title="Exemplo de Response" %}

```json
{
    "data": {
        "type": "contacts",
        "id": "24",
        "attributes": {
            "is_primary": true,
            "name": "teste",
            "position": null,
            "phone_number": null,
            "mobile_number": null,
            "email": "novo@email.pt"
        },
        "relationships": {
            "supplier": {
                "data": null
            }
        }
    }
}
```

{% endcode %}
{% endtab %}
{% endtabs %}

<figure><img src="https://1863668386-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fk7sif7BY0rPzivMcj1HB%2Fuploads%2Fgit-blob-583638adc5394cd2cfdef0e8758d2795881a6585%2FDiagramas%20de%20Documenta%C3%A7%C3%A3o%20TOCOnline%20API-Atualizar%20Email%20de%20Cliente%20(1).jpg?alt=media" alt=""><figcaption><p>Exemplo de Atualização de E-mail para Cliente</p></figcaption></figure>


# Fornecedores, Morada e E-mail

As rotas definidas no presente capítulo permitem gerir toda a informação relativa a fornecedores: criação, edição, remoção, etc

### Obter Todos os Fornecedores

Esta primeira rota permite obter a informação de todos os fornecedores disponíveis. Para tal, deve apenas realizar o seguinte pedido:

{% openapi src="/files/LrXEg3IjIacAycCz7IWE" path="/api/suppliers" method="get" %}
[TOConline Open API.yaml](https://1863668386-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fk7sif7BY0rPzivMcj1HB%2Fuploads%2Fgit-blob-1f7bd9dd692716d3f3f93d9c9a4f7226d78277e3%2FTOConline%20Open%20API.yaml?alt=media)
{% endopenapi %}

{% tabs %}
{% tab title="Endpoint" %}

<pre data-title="Endpoint"><code><strong>https://api/v1.toconline.com/api/suppliers
</strong></code></pre>

{% endtab %}

{% tab title="cURL" %}
{% code title="cURL" overflow="wrap" %}

```
curl -v -X GET -H 'Content-Type: application/vnd.api+json' -H 'Accept: application/json' -H 'Authorization: Bearer <access_token>' '<API_URL>/api/suppliers'
```

{% endcode %}
{% endtab %}
{% endtabs %}

### Obter Fornecedor por Id

Se pretender obter a informação de um fornecedor específico, deverá realizar o mesmo pedido, especificando o id do fornecedor que deseja consultar

{% openapi src="/files/LrXEg3IjIacAycCz7IWE" path="/api/addresses/{id}" method="get" %}
[TOConline Open API.yaml](https://1863668386-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fk7sif7BY0rPzivMcj1HB%2Fuploads%2Fgit-blob-1f7bd9dd692716d3f3f93d9c9a4f7226d78277e3%2FTOConline%20Open%20API.yaml?alt=media)
{% endopenapi %}

<details>

<summary>Exemplo de Resposta</summary>

{% code title="Response" %}

```json
{
    "data": {
        "type": "suppliers",
        "id": "7",
        "attributes": {
            "tax_registration_number": "533186331",
            "business_name": "A Empresa",
            "website": "www.a_empresa.pt",
            "is_taxable": false,
            "is_tax_exempt": false,
            "tax_exemption_reason_id": null,
            "self_billing": null,
            "document_series_id": null,
            "internal_observations": null,
            "tax_country_region": "PT-AC",
            "is_independent_worker": false,
            "country_iso_alpha_2": "PT-AC",
            "saft_import_id": null,
            "accounting_number": null,
            "trusted_email_source": false
        },
        "relationships": {
            "addresses": {
                "data": [
                    {
                        "type": "addresses",
                        "id": "45"
                    }
                ]
            },
            "bank_accounts": {
                "data": [
                    {
                        "type": "bank_accounts",
                        "id": "4"
                    }
                ]
            },
            "company": {
                "data": {
                    "type": "current_company",
                    "id": "800000046"
                }
            },
            "contacts": {
                "data": [
                    {
                        "type": "contacts",
                        "id": "17"
                    }
                ]
            },
            "defaults": {
                "data": {
                    "type": "suppliers_defaults",
                    "id": "4"
                }
            },
            "main_address": {
                "data": {
                    "type": "addresses",
                    "id": "45"
                }
            },
            "main_contact": {
                "data": {
                    "type": "contacts",
                    "id": "17"
                }
            },
            "tax_exemption_reason": {
                "data": null
            }
        }
    }
}
```

{% endcode %}

</details>

### Criar Fornecedor

Permite a criação de novas instâncias de fornecedores. De modo a realizar um pedido para esta rota, terá de enviar alguns parâmetros no body do pedido.\
Tal como está descrito no pedido em baixo.\
Dentro de data, deverá colocar todos os parâmetros obrigatórios e poderá também colocar os restantes parâmetros, se for do seu interesse. O tipo dos parâmetros está também especificado.

{% openapi src="/files/LrXEg3IjIacAycCz7IWE" path="/api/suppliers" method="post" %}
[TOConline Open API.yaml](https://1863668386-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fk7sif7BY0rPzivMcj1HB%2Fuploads%2Fgit-blob-1f7bd9dd692716d3f3f93d9c9a4f7226d78277e3%2FTOConline%20Open%20API.yaml?alt=media)
{% endopenapi %}

{% tabs %}
{% tab title="Payload" %}

<pre class="language-json" data-title="Payload"><code class="lang-json"><strong>{
</strong>    "data": {
        "type": "suppliers",
        "attributes": {
            "tax_registration_number": 533186331,    //OBRIGATÓRIO
            "business_name": "A Empresa",           //OBRIGATÓRIO  
            "website": null,
            "is_taxable": null,
            "is_tax_exempt": null,
            "self_billing": null,
            "document_series_id": null,
            "internal_observations": null,
            "tax_country_region": null,
            "is_independent_worker": null
        }
    }
}
</code></pre>

{% endtab %}

{% tab title="Response" %}

<pre class="language-json" data-title="Response"><code class="lang-json"><strong>{
</strong>    "data": {
        "type": "suppliers",
        "id": "7",
        "attributes": {
            "tax_registration_number": "533186331",
            "business_name": "A Empresa",
            "website": null,
            "is_taxable": false,
            "is_tax_exempt": false,
            "tax_exemption_reason_id": null,
            "self_billing": null,
            "document_series_id": null,
            "internal_observations": null,
            "tax_country_region": "PT",
            "is_independent_worker": false,
            "country_iso_alpha_2": "PT",
            "saft_import_id": null,
            "accounting_number": null,
            "trusted_email_source": false
        },
        "relationships": {
            "addresses": {
                "data": []
            },
            "bank_accounts": {
                "data": []
            },
            "company": {
                "data": {
                    "type": "current_company",
                    "id": "800000046"
                }
            },
            "contacts": {
                "data": []
            },
            "defaults": {
                "data": null
            },
            "main_address": {
                "data": null
            },
            "main_contact": {
                "data": null
            },
            "tax_exemption_reason": {
                "data": null
            }
        }
    }
}
</code></pre>

{% endtab %}
{% endtabs %}

<table><thead><tr><th>Atributo</th><th width="360">Descrição</th><th>Obrigatório</th></tr></thead><tbody><tr><td>type</td><td>Tipo de entidade (neste caso, fornecedor).</td><td>Sim</td></tr><tr><td>tax_registration_number</td><td>Número de identificação fiscal do fornecedor.</td><td>Sim</td></tr><tr><td>business_name</td><td>Nome comercial ou razão social do fornecedor.</td><td>Sim</td></tr><tr><td>website</td><td>Website do fornecedor (opcional).</td><td>Não</td></tr><tr><td>is_taxable</td><td>Indica se o fornecedor é tributável (opcional).</td><td>Não</td></tr><tr><td>is_tax_exempt</td><td>Indica se o fornecedor está isento de impostos (opcional).</td><td>Não</td></tr><tr><td>self_billing</td><td>Indica se o fornecedor permite a autogestão de faturas (opcional).</td><td>Não</td></tr><tr><td>document_series_id</td><td>ID da série de documentos associada ao fornecedor (opcional).</td><td>Não</td></tr><tr><td>internal_observations</td><td>Observações internas sobre o fornecedor (opcional).</td><td>Não</td></tr><tr><td>tax_country_region</td><td>Região fiscal do fornecedor (opcional).</td><td>Não</td></tr><tr><td>is_independent_worker</td><td>Indica se o fornecedor é um trabalhador independente (opcional).</td><td>Não</td></tr></tbody></table>

### Associar morada a Fornecedor

A sequência de passos delineada no diagrama proporciona uma compreensão do processo, desde a criação do forncedor até a sua associação com uma morada.

<figure><img src="https://1863668386-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fk7sif7BY0rPzivMcj1HB%2Fuploads%2Fgit-blob-6da55ddc70e3a9a7c4a545d106ab174fe4351992%2FDiagramas%20de%20Documenta%C3%A7%C3%A3o-Associar%20Fornecedor%20a%20Morada.jpg?alt=media" alt=""><figcaption></figcaption></figure>

{% hint style="warning" %}
Quando um forncedor é criado, uma morada principal fica associada ao fornecedor. Esta morada por default vem vazia e é necessário atualizar com os dados da nova morada do fornecedor.
{% endhint %}

Através do `id` obtido pela response do [#criar-fornecedor](#criar-fornecedor "mention") este deverá ser usado para obter o id da morada ao fazer um `GET /suppliers/{id}`

<details>

<summary>Exemplo de resposta de um GET Supplier por ID</summary>

{% code title="Response" %}

```json
{
    "data": {
        "type": "suppliers",
        "id": "7",
        "attributes": {
            "tax_registration_number": "533186331",
            "business_name": "A Empresa",
            "website": "www.a_empresa.pt",
            "is_taxable": false,
            "is_tax_exempt": false,
            "tax_exemption_reason_id": null,
            "self_billing": null,
            "document_series_id": null,
            "internal_observations": null,
            "tax_country_region": "PT-AC",
            "is_independent_worker": false,
            "country_iso_alpha_2": "PT-AC",
            "saft_import_id": null,
            "accounting_number": null,
            "trusted_email_source": false
        },
        "relationships": {
            "addresses": {
                "data": [
                    {
                        "type": "addresses",
                        "id": "45"
                    }
                ]
            },
            "bank_accounts": {
                "data": [
                    {
                        "type": "bank_accounts",
                        "id": "4"
                    }
                ]
            },
            "company": {
                "data": {
                    "type": "current_company",
                    "id": "800000046"
                }
            },
            "contacts": {
                "data": [
                    {
                        "type": "contacts",
                        "id": "17"
                    }
                ]
            },
            "defaults": {
                "data": {
                    "type": "suppliers_defaults",
                    "id": "4"
                }
            },
            "main_address": {
                "data": {
                    "type": "addresses",
                    "id": "45"
                }
            },
            "main_contact": {
                "data": {
                    "type": "contacts",
                    "id": "17"
                }
            },
            "tax_exemption_reason": {
                "data": null
            }
        }
    }
}
```

{% endcode %}

</details>

O `id` da morada obtido anteriormente, será usado para atualizar os dados da morada através de um `PATCH / addresses`.

{% openapi src="/files/LrXEg3IjIacAycCz7IWE" path="/api/addresses" method="patch" %}
[TOConline Open API.yaml](https://1863668386-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fk7sif7BY0rPzivMcj1HB%2Fuploads%2Fgit-blob-1f7bd9dd692716d3f3f93d9c9a4f7226d78277e3%2FTOConline%20Open%20API.yaml?alt=media)
{% endopenapi %}

O body deste pedido (payload JSON) deverá conter as informações de cliente que se pretende atualizar nos respetivos atributos.

{% tabs %}
{% tab title="Payload" %}
{% code title="Payload " %}

```json
{
    "data": {
        "type": "addresses",
        "id": "45",
        "attributes": {
             "address_detail": "Avenida Principal",
            "city": "Setúbal",
            "postcode": "2910-099",
            "region": "Setúbal",
            "country_id": "3"
        }
    }
}
```

{% endcode %}
{% endtab %}

{% tab title="Response" %}
{% code title="Response" %}

```json
{
    "data": {
        "type": "addresses",
        "id": "45",
        "attributes": {
            "is_primary": true,
            "address_detail": "Avenida Principal",
            "city": "Setúbal",
            "postcode": "2910-099",
            "region": "Setúbal",
            "name": "Sede",
            "for_discharge": false,
            "for_charge": false,
            "subtype": null,
            "is_saturday_workday": false,
            "is_sunday_workday": false,
            "is_national_holidays_workday": false,
            "code": null,
            "payroll_enumerations_tax_office_id": null
        },
        "relationships": {
            "company": {
                "data": null
            },
            "country": {
                "data": {
                    "type": "countries",
                    "id": "3"
                }
            },
            "customer": {
                "data": null
            },
            "supplier": {
                "data": null
            },
            "user": {
                "data": null
            }
        }
    }
}
```

{% endcode %}
{% endtab %}
{% endtabs %}

### Remover Fornecedor

A seguinte rota permite a remoção de um dado fornecedor. Esta rota deve ser utilizada de forma cautelosa dado que é irreversível, e mesmo que este cliente volte a ser criado, o seu id nunca será o mesmo que teria anteriormente.

\
Utilizando o id do forncedor que quer eliminar, que poderá fazer utilizando a primeira rota desta página, por exemplo, terá simplesmente de fazer o pedido:

{% openapi src="/files/LrXEg3IjIacAycCz7IWE" path="/api/suppliers/{supplierId}" method="delete" %}
[TOConline Open API.yaml](https://1863668386-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fk7sif7BY0rPzivMcj1HB%2Fuploads%2Fgit-blob-1f7bd9dd692716d3f3f93d9c9a4f7226d78277e3%2FTOConline%20Open%20API.yaml?alt=media)
{% endopenapi %}

### Atualizar Fornecedor

A rota PATCH permite a edição de um fornecedor existente. O body deste pedido deverá ser igual ao descrito na rota POST, contendo todas as informações obrigatórias do fornecedor, atualizadas para os valores que tenciona alterar, além do "id" do fornecedor. Álem disto, o pedido deverá ser feito a `https://apiv1.toconline.com/suppliers/{id}`, sendo que {id} é o identificador do fornecedor que tenciona atualizar.

{% openapi src="/files/LrXEg3IjIacAycCz7IWE" path="/api/suppliers" method="patch" %}
[TOConline Open API.yaml](https://1863668386-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fk7sif7BY0rPzivMcj1HB%2Fuploads%2Fgit-blob-1f7bd9dd692716d3f3f93d9c9a4f7226d78277e3%2FTOConline%20Open%20API.yaml?alt=media)
{% endopenapi %}

<details>

<summary>Exemplo de Payload</summary>

No exemplo que se segue foi atualizado o website da empresa

{% code title="Payload" %}

```json
{
    "data": {
        "type": "suppliers",
        "id": "7",
        "attributes": {
            "tax_registration_number": "533186331",
            "business_name": "A Empresa",
            "website": "www.a_empresa.pt",
            "is_taxable": false,
            "is_tax_exempt": false,
            "tax_exemption_reason_id": null,
            "self_billing": null,
            "document_series_id": null,
            "internal_observations": null,
            "tax_country_region": "PT",
            "is_independent_worker": false,
            "country_iso_alpha_2": "PT",
            "saft_import_id": null,
            "accounting_number": null,
            "trusted_email_source": false
        }
    }
}
```

{% endcode %}

</details>

<details>

<summary>Exemplo de Response</summary>

{% code title="" %}

```json
{
    "data": {
        "type": "suppliers",
        "id": "7",
        "attributes": {
            "tax_registration_number": "533186331",
            "business_name": "A Empresa",
            "website": null,
            "is_taxable": false,
            "is_tax_exempt": false,
            "tax_exemption_reason_id": null,
            "self_billing": null,
            "document_series_id": null,
            "internal_observations": null,
            "tax_country_region": "PT",
            "is_independent_worker": false,
            "country_iso_alpha_2": "PT",
            "saft_import_id": null,
            "accounting_number": null,
            "trusted_email_source": false
        },
        "relationships": {
            "addresses": {
                "data": []
            },
            "bank_accounts": {
                "data": []
            },
            "company": {
                "data": {
                    "type": "current_company",
                    "id": "800000046"
                }
            },
            "contacts": {
                "data": []
            },
            "defaults": {
                "data": null
            },
            "main_address": {
                "data": null
            },
            "main_contact": {
                "data": null
            },
            "tax_exemption_reason": {
                "data": null
            }
        }
    }
}
```

{% endcode %}

</details>

***

## Morada

### Criar Morada

Quando um Fornecedor é criado este já tem uma morada vazia associada, mas é possível adicionar mais do que uma morada ao Fornecedor.

De modo a associar uma morada a um cliente, deverá realizar o seguinte pedido

{% openapi src="/files/LrXEg3IjIacAycCz7IWE" path="/api/addresses" method="post" %}
[TOConline Open API.yaml](https://1863668386-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fk7sif7BY0rPzivMcj1HB%2Fuploads%2Fgit-blob-1f7bd9dd692716d3f3f93d9c9a4f7226d78277e3%2FTOConline%20Open%20API.yaml?alt=media)
{% endopenapi %}

No pedido acima, o \<access\_token> corresponde ao token de acesso válido devolvido pelo serviço de OAuth, e o \<payload JSON> deverá ter o seguinte formato

{% code title="Payload" %}

```json
{
    "data": {
        "type": "addresses",
        "attributes": {
            "addressable_type": "Supplier", //OBRIGATÓRIO
            "addressable_id": 7,            //OBRIGATÓRIO - ID da morada do Fornecedor
            "address_detail": "teste 3",
            "city": "Setúbal",
            "postcode": "2910-099",
            "region": "Setúbal",
            "country_id" : 1            // 1 = PT (Portugal Continental); 2 = PT_MA (Madeira); //3 = PT_AC (Açores)...Ver Get/countries
        }
    }
}
```

{% endcode %}

| Atributo          | Descrição                                                                   | Obrigatório |
| ----------------- | --------------------------------------------------------------------------- | ----------- |
| type              | Tipo de entidade (neste caso, endereço).                                    | Sim         |
| addressable\_type | Tipo de entidade à qual o endereço está associado (neste caso, fornecedor). | Sim         |
| addressable\_id   | ID do fornecedor associado ao endereço.                                     | Sim         |
| address\_detail   | Detalhes específicos do endereço, como rua e número.                        | Não         |
| city              | Cidade do endereço.                                                         | Não         |
| postcode          | Código postal do endereço.                                                  | Não         |
| region            | Região do endereço (por exemplo, província, estado).                        | Não         |
| country\_id       | ID do país do endereço (1 = Portugal Continental, 2 = Madeira, 3 = Açores). | Não         |

{% hint style="info" %}
"addressable\_id" - corresponde ao id da morada do cliente obtido da relação entre fornecedor e morada, através do [#obter-fornecedor](#obter-fornecedor "mention")
{% endhint %}

{% hint style="info" %}
Para usar outro país que não seja Portugal, poderá consultar mais informação em: [Países](/apis/apis-auxiliares/paises)
{% endhint %}

***

## E-mail

### Criar E-mail de Fornecedor

Para proceder à criação do E-mail de um fornecedor pela primeira vez deverá utilizar a `POST / contacts`.

{% openapi src="/files/LrXEg3IjIacAycCz7IWE" path="/api/contacts" method="post" %}
[TOConline Open API.yaml](https://1863668386-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fk7sif7BY0rPzivMcj1HB%2Fuploads%2Fgit-blob-1f7bd9dd692716d3f3f93d9c9a4f7226d78277e3%2FTOConline%20Open%20API.yaml?alt=media)
{% endopenapi %}

O body deste pedido (\<payload JSON>) deverá conter as informações de fornecedor que se pretende atualizar, sendo obrigatório campo "**contactable\_id**" identificador do fornecedor que tenciona atualizar e o "**contactable\_type**" sendo este do tipo "**Supplier**"

{% tabs %}
{% tab title="Payload" %}
{% code title="Exemplo de Payload" %}

```json

{
    "data": {
        "type": "contacts",
        "attributes": {
            "is_primary": true,
            "name": "teste_cmo",
            "position": null,
            "phone_number": null,
            "mobile_number": null,
            "email": "61_manuel@email.pt",
            "categories": [
                "general"
            ],
            "contactable_id": 61,
            "contactable_type": "Customer"
        }
    }
}
```

{% endcode %}
{% endtab %}

{% tab title="Response" %}
{% code title="Exemplo de Response" %}

````json
{
    "data": {
        "type": "contacts",
        "id": "29",
        "attributes": {
            "is_primary": true,
            "name": "teste_supplier",
            "position": null,
            "phone_number": null,
            "mobile_number": null,
            "email": "4_sup@email.pt"
        },
        "relationships": {
            "supplier": {
                "data": null
            }
        }
    }
}
```
````

{% endcode %}
{% endtab %}
{% endtabs %}

<figure><img src="https://1863668386-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fk7sif7BY0rPzivMcj1HB%2Fuploads%2Fgit-blob-ace742bd3787ed3ad2268509af858f911673af1e%2FDiagramas%20de%20Documenta%C3%A7%C3%A3o%20TOCOnline%20API-Criar%20Email%20de%20Fornecedor.jpg?alt=media" alt=""><figcaption><p>Exemplo de Criação de E-mail para Fornecedor</p></figcaption></figure>

### Atualizar E-mail de Cliente

{% hint style="warning" %}
Já deve ter realizado [#criar-e-mail-de-fornecedor](#criar-e-mail-de-fornecedor "mention")
{% endhint %}

Usando o `GET / supplier{id}` deverá obter o id correspondente ao contacto do fornecedor, que se encontra localizado na área de relationships-> main\_contact, como pode observar no exemplo de response abaixo.

<details>

<summary>Exemplo de response de um GET/supplier/{id}</summary>

```json
{
    "data": {
        "type": "customers",
        "id": "61",
        "attributes": {
            "tax_registration_number": "229659179",
            "business_name": "Manuel Ricardo Ribeiro",
            "contact_name": null,
            "website": null,
            "phone_number": null,
            "mobile_number": null,
            "email": null,
            "observations": null,
            "internal_observations": null,
            "not_final_customer": false,
            "cashed_vat": false,
            "tax_country_region": "PT",
            "country_iso_alpha_2": "PT",
            "saft_import_id": null,
            "is_tax_exempt": false,
            "data": {}
        },
        "relationships": {
            "addresses": {
                "data": [
                    {
                        "type": "addresses",
                        "id": "67"
                    }
                ]
            },
            "company": {
                "data": {
                    "type": "current_company",
                    "id": "800000046"
                }
            },
            "defaults": {
                "data": {
                    "type": "customers_defaults",
                    "id": "31"
                }
            },
            "email_addresses": {
                "data": [
                    {
                        "type": "email_addresses",
                        "id": "24"
                    }
                ]
            },
            "main_address": {
                "data": {
                    "type": "addresses",
                    "id": "67"
                }
            },
            "main_email_address": {
                "data": {
                    "type": "email_addresses",
                    "id": "24"
                }
            },
            "tax_exemption_reason": {
                "data": null
            }
        }
    }
}
```

</details>

Para proceder à atualização do E-mail de um fornecedor deverá utilizar a `PATCH / contacts` usando o id obtido do main\_contact obtido do fornecedor pretendido.

{% openapi src="/files/LrXEg3IjIacAycCz7IWE" path="/api/contacts" method="patch" %}
[TOConline Open API.yaml](https://1863668386-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fk7sif7BY0rPzivMcj1HB%2Fuploads%2Fgit-blob-1f7bd9dd692716d3f3f93d9c9a4f7226d78277e3%2FTOConline%20Open%20API.yaml?alt=media)
{% endopenapi %}

O body deste pedido (\<payload JSON>) deverá conter as informações de cliente que se pretende atualizar, sendo obrigatório campo "`id`" id do contacto correspondente ao utilizador que tenciona atualizar e o "`email`" novo a ser alterado.

{% tabs %}
{% tab title="Payload" %}
{% code title="Exemplo de Payload" %}

```json
{
    "data": {
        "type": "contacts",
        "id": "24",
        "attributes": {
            "email": "novo@email.pt"
        }
    }
}
```

{% endcode %}
{% endtab %}

{% tab title="Response" %}
{% code title="Exemplo de Response" %}

```json
{
    "data": {
        "type": "contacts",
        "id": "24",
        "attributes": {
            "is_primary": true,
            "name": "teste",
            "position": null,
            "phone_number": null,
            "mobile_number": null,
            "email": "novo@email.pt"
        },
        "relationships": {
            "supplier": {
                "data": null
            }
        }
    }
}
```

{% endcode %}
{% endtab %}
{% endtabs %}

<figure><img src="https://1863668386-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fk7sif7BY0rPzivMcj1HB%2Fuploads%2Fgit-blob-60ef55fa5abec032989d4ccd5ae418ea891bb84c%2FDiagramas%20de%20Documenta%C3%A7%C3%A3o%20TOCOnline%20API-Atualizar%20Email%20de%20Fornecedor.jpg?alt=media" alt=""><figcaption><p>Exemplo de Criação de E-mail para Fornecedor</p></figcaption></figure>


# Produtos e Serviços

Neste capitulo serão descritos 2 tipos de itens diferentes. Os Serviços e os Protudos. Ambos partilham de atributos iguais mas têm diferentes rotas para realizar diferentes tipos de ações.

## Produtos

### Obter Produtos

De modo a obter informações sobre um dado produto, poderá realizar o seguinte pedido

<mark style="color:blue;">`GET`</mark> `/products`

#### Path Parameters

| Name                | Type   | Description   |
| ------------------- | ------ | ------------- |
| filter\[item\_code] | String | \<item\_code> |

{% tabs %}
{% tab title="200: OK Toda a informação sobre o produto" %}

```javascript
{
    // Response
}
```

{% endtab %}
{% endtabs %}

Neste, pode não indicar nenhum filtro, e obter todos os produtos disponíveis, ou então filtrar por qualquer um dos campos disponíveis, tal como no exemplo dado, e seguindo as convenções JSONAPI

<details>

<summary>Exemplo de Response</summary>

```json
{
    "data": [
        {
            "type": "products",
            "id": "2",
            "attributes": {
                "item_code": "100",
                "item_description": "Isto é uma breve descrição",
                "sales_price": 2.0,
                "sales_price_includes_vat": false,
                "tax_code": "INT",
                "applied_tax_code": "INT",
                "notes": "Isto são notas de produtos",
                "is_merchandise": null,
                "location_in_warehouse": null,
                "sales_price_2": 4.0,
                "sales_price_3": null,
                "purchase_price": 5.0,
                "ean_barcode": "553214",
                "financial_cost": 2.0,
                "transport_cost": 1.0,
                "other_cost": 0.0,
                "customs_cost": 10.0,
                "estimated_total_cost": 18.0,
                "product_inventory_type": "P",
                "accounting_number": null,
                "service_group": null,
                "is_active": true,
                "sales_price_vat_display": 2.26,
                "sales_price_2_vat_display": 4.52,
                "sales_price_3_vat_display": null,
                "applied_tax_exemption_reason_id": null
            },
            "relationships": {
                "applied_tax_exemption_reason": {
                    "data": null
                },
                "company": {
                    "data": {
                        "type": "current_company",
                        "id": "800000046"
                    }
                },
                "item_families": {
                    "data": {
                        "type": "item_families",
                        "id": "3"
                    }
                },
                "tax_exemption_reasons": {
                    "data": null
                },
                "unit_of_measure": {
                    "data": {
                        "type": "units_of_measure",
                        "id": "5"
                    }
                }
            }
        }
    ]
}
```

</details>

###

### Criar Produtos

{% openapi src="/files/LrXEg3IjIacAycCz7IWE" path="/api/products" method="post" %}
[TOConline Open API.yaml](https://1863668386-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fk7sif7BY0rPzivMcj1HB%2Fuploads%2Fgit-blob-1f7bd9dd692716d3f3f93d9c9a4f7226d78277e3%2FTOConline%20Open%20API.yaml?alt=media)
{% endopenapi %}

No pedido acima, o \<access\_token> corresponde ao token de acesso válido devolvido pelo serviço de OAuth, e o \<payload JSON> deverá ter o seguinte formato:

{% tabs %}
{% tab title="Payload" %}
{% code title="Payload" %}

```json
{
  "data": {
    "type": "products",                         // [OBRIGATÓRIO]
    "attributes": {
      "type": "Product",                        // [OBRIGATÓRIO]
      "item_code": "PTEST",                     // [OBRIGATÓRIO]
      "item_description": "Test product",       // [OBRIGATÓRIO]
      "sales_price": 100,                       // [OPCIONAL]
      "sales_price_includes_vat": false,        // [OPCIONAL] Por omissão, false; true, se o preço de venda do produto incluir IVA
      "tax_code": "NOR"                         // [OPCIONAL] Os tipos de IVA suportados são "NOR" (normal), "INT" (intermédio), "RED" (reduzido), "ISE" (isento)
    }
  }
}
```

{% endcode %}
{% endtab %}

{% tab title="Response" %}
{% code title="Response" %}

```json
{
    "meta": {
        "observed": {
            "scalar": 1
        }
    },
    "data": {
        "type": "products",
        "id": "3",
        "attributes": {
            "item_code": "PTEST",
            "item_description": "Test product",
            "sales_price": 100,
            "sales_price_includes_vat": false,
            "tax_code": "NOR",
            "applied_tax_code": "NOR",
            "notes": null,
            "is_merchandise": null,
            "location_in_warehouse": null,
            "sales_price_2": null,
            "sales_price_3": null,
            "purchase_price": null,
            "ean_barcode": null,
            "financial_cost": 0.0,
            "transport_cost": 0.0,
            "other_cost": 0.0,
            "customs_cost": 0.0,
            "estimated_total_cost": 0.0,
            "product_inventory_type": null,
            "accounting_number": null,
            "service_group": null,
            "is_active": true,
            "sales_price_vat_display": 123.00,
            "sales_price_2_vat_display": null,
            "sales_price_3_vat_display": null,
            "applied_tax_exemption_reason_id": null
        },
        "relationships": {
            "applied_tax_exemption_reason": {
                "data": null
            },
            "company": {
                "data": {
                    "type": "current_company",
                    "id": "800000046"
                }
            },
            "item_families": {
                "data": null
            },
            "tax_exemption_reasons": {
                "data": null
            },
            "unit_of_measure": {
                "data": {
                    "type": "units_of_measure",
                    "id": "2"
                }
            }
        }
    }
}
```

{% endcode %}
{% endtab %}
{% endtabs %}

###

## Serviços

### Criar Serviços

No pedido acima, o \<access\_token> corresponde ao token de acesso válido devolvido pelo serviço de OAuth, e o \<payload JSON> deverá ter o seguinte formato

```json
{
  "data": {
    "type": "services",                         // [OBRIGATÓRIO]
    "attributes": {
      "type": "Service",                        // [OBRIGATÓRIO]
      "item_code": "STEST",                     // [OBRIGATÓRIO]
      "item_description": "Test service",       // [OBRIGATÓRIO]
      "sales_price": 100,                       // [OPCIONAL]
      "sales_price_includes_vat": false,        // [OPCIONAL] Por omissão, false; true, se o preço de venda do produto incluir IVA
      "tax_code": "NOR"                         // [OPCIONAL] Os tipos de IVA suportados são "NOR" (normal), "INT" (intermédio), "RED" (reduzido), "ISE" (isento)
    }
  }
}
```

{% openapi src="/files/LrXEg3IjIacAycCz7IWE" path="/api/services" method="post" %}
[TOConline Open API.yaml](https://1863668386-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fk7sif7BY0rPzivMcj1HB%2Fuploads%2Fgit-blob-1f7bd9dd692716d3f3f93d9c9a4f7226d78277e3%2FTOConline%20Open%20API.yaml?alt=media)
{% endopenapi %}

###

### Obter Todos os Serviços

<mark style="color:blue;">`GET`</mark> `/services`

#### Path Parameters

| Name                | Type   | Description   |
| ------------------- | ------ | ------------- |
| filter\[item\_code] | String | \<item\_code> |

{% tabs %}
{% tab title="200: OK Toda a informação sobre o serviço" %}

```javascript
{
    // Response
}
```

{% endtab %}
{% endtabs %}

###

### Obter Serviço

De modo a obter informações sobre um dado serviço, poderá realizar o seguinte pedido

{% openapi src="/files/LrXEg3IjIacAycCz7IWE" path="/api/services" method="get" %}
[TOConline Open API.yaml](https://1863668386-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fk7sif7BY0rPzivMcj1HB%2Fuploads%2Fgit-blob-1f7bd9dd692716d3f3f93d9c9a4f7226d78277e3%2FTOConline%20Open%20API.yaml?alt=media)
{% endopenapi %}

##

***

### Associar Famílias de Itens a Produtos

{% hint style="info" %}
Já teve de ser criado previamente uma Família de Itens.

Pode consultar mais em: [Família de Itens](/apis/apis-auxiliares/familia-de-itens)
{% endhint %}

{% openapi src="/files/LrXEg3IjIacAycCz7IWE" path="/api/products" method="patch" %}
[TOConline Open API.yaml](https://1863668386-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fk7sif7BY0rPzivMcj1HB%2Fuploads%2Fgit-blob-1f7bd9dd692716d3f3f93d9c9a4f7226d78277e3%2FTOConline%20Open%20API.yaml?alt=media)
{% endopenapi %}

{% tabs %}
{% tab title="Payload" %}
{% code title="Payload" %}

```json
{
    "data": {
        "type": "products",
        "id": "6",
        "attributes": {
            "item_family_id": 4
        }
    }
}
```

{% endcode %}
{% endtab %}

{% tab title="Response" %}
{% code title="Response" %}

```json
{
    "meta": {
        "observed": {
            "scalar": 1
        }
    },
    "data": {
        "type": "products",
        "id": "6",
        "attributes": {
            "item_code": "123456",
            "item_description": "Test product with family",
            "sales_price": 100,
            "sales_price_includes_vat": false,
            "tax_code": "NOR",
            "applied_tax_code": "NOR",
            "notes": null,
            "is_merchandise": null,
            "location_in_warehouse": null,
            "sales_price_2": null,
            "sales_price_3": null,
            "purchase_price": null,
            "ean_barcode": null,
            "financial_cost": 0.0,
            "transport_cost": 0.0,
            "other_cost": 0.0,
            "customs_cost": 0.0,
            "estimated_total_cost": 0.0,
            "product_inventory_type": null,
            "accounting_number": null,
            "service_group": null,
            "is_active": true,
            "sales_price_vat_display": 123.00,
            "sales_price_2_vat_display": null,
            "sales_price_3_vat_display": null,
            "applied_tax_exemption_reason_id": null
        },
        "relationships": {
            "applied_tax_exemption_reason": {
                "data": null
            },
            "company": {
                "data": {
                    "type": "current_company",
                    "id": "800000046"
                }
            },
            "item_families": {
                "data": {
                    "type": "item_families",
                    "id": "4"
                }
            },
            "tax_exemption_reasons": {
                "data": null
            },
            "unit_of_measure": {
                "data": {
                    "type": "units_of_measure",
                    "id": "2"
                }
            }
        }
    }
```

{% endcode %}
{% endtab %}
{% endtabs %}

### Associar Famílias de Itens a Serviços

{% hint style="info" %}
Já teve de ser criado previamente uma Família de Itens.

Pode consultar mais em: [Família de Itens](/apis/apis-auxiliares/familia-de-itens)
{% endhint %}

{% openapi src="/files/LrXEg3IjIacAycCz7IWE" path="/api/services" method="patch" %}
[TOConline Open API.yaml](https://1863668386-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fk7sif7BY0rPzivMcj1HB%2Fuploads%2Fgit-blob-1f7bd9dd692716d3f3f93d9c9a4f7226d78277e3%2FTOConline%20Open%20API.yaml?alt=media)
{% endopenapi %}

{% tabs %}
{% tab title="Payload" %}
{% code title="Payload" %}

```json
{
    "data": {
        "type": "services",
        "id": "7",
        "attributes": {
            "item_family_id": 4
        }
    }
}
```

{% endcode %}
{% endtab %}

{% tab title="Response" %}
{% code title="Response" %}

```json
{
    "meta": {
        "observed": {
            "scalar": 1
        }
    },
    "data": {
        "type": "services",
        "id": "7",
        "attributes": {
            "item_code": "54321",
            "item_description": "Serviço1",
            "sales_price": 10.0,
            "sales_price_includes_vat": false,
            "tax_code": "NOR",
            "applied_tax_code": "NOR",
            "notes": "Notas de Serviço",
            "is_merchandise": null,
            "location_in_warehouse": null,
            "sales_price_2": 20.0,
            "sales_price_3": 30.0,
            "purchase_price": 0.0,
            "ean_barcode": "",
            "financial_cost": 0.0,
            "transport_cost": 0.0,
            "other_cost": 0.0,
            "customs_cost": 0.0,
            "estimated_total_cost": 0.0,
            "product_inventory_type": null,
            "accounting_number": null,
            "service_group": "G1",
            "is_active": true,
            "sales_price_vat_display": 12.30,
            "sales_price_2_vat_display": 24.60,
            "sales_price_3_vat_display": 36.90,
            "applied_tax_exemption_reason_id": null
        },
        "relationships": {
            "applied_tax_exemption_reason": {
                "data": null
            },
            "company": {
                "data": {
                    "type": "current_company",
                    "id": "800000046"
                }
            },
            "item_families": {
                "data": {
                    "type": "item_families",
                    "id": "4"
                }
            },
            "tax_exemption_reasons": {
                "data": null
            },
            "unit_of_measure": {
                "data": {
                    "type": "units_of_measure",
                    "id": "5"
                }
            }
        }
    }
}
```

{% endcode %}
{% endtab %}
{% endtabs %}

##

### Associar Unidades de Medida a Produtos

{% hint style="info" %}
Já teve de ser criado previamente uma Unidade de Medida.

Pode consultar mais em: [Unidades de Medida](/apis/apis-auxiliares/unidades-de-medida)
{% endhint %}

{% openapi src="/files/LrXEg3IjIacAycCz7IWE" path="/api/products" method="patch" %}
[TOConline Open API.yaml](https://1863668386-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fk7sif7BY0rPzivMcj1HB%2Fuploads%2Fgit-blob-1f7bd9dd692716d3f3f93d9c9a4f7226d78277e3%2FTOConline%20Open%20API.yaml?alt=media)
{% endopenapi %}

{% code title="PATCH" %}

```
https://api/v1.toconline.com/api/products
```

{% endcode %}

{% tabs %}
{% tab title="Payload" %}
{% code title="Payload" %}

```json
{
    "data": {
        "type": "products",
        "id": "6",
        "attributes": {
            "item_family_id": 4
        }
    }
}
```

{% endcode %}
{% endtab %}

{% tab title="Response" %}
{% code title="Response" %}

```json
{
    "meta": {
        "observed": {
            "scalar": 1
        }
    },
    "data": {
        "type": "products",
        "id": "6",
        "attributes": {
            "item_code": "123456",
            "item_description": "Test product with family",
            "sales_price": 100,
            "sales_price_includes_vat": false,
            "tax_code": "NOR",
            "applied_tax_code": "NOR",
            "notes": null,
            "is_merchandise": null,
            "location_in_warehouse": null,
            "sales_price_2": null,
            "sales_price_3": null,
            "purchase_price": null,
            "ean_barcode": null,
            "financial_cost": 0.0,
            "transport_cost": 0.0,
            "other_cost": 0.0,
            "customs_cost": 0.0,
            "estimated_total_cost": 0.0,
            "product_inventory_type": null,
            "accounting_number": null,
            "service_group": null,
            "is_active": true,
            "sales_price_vat_display": 123.00,
            "sales_price_2_vat_display": null,
            "sales_price_3_vat_display": null,
            "applied_tax_exemption_reason_id": null
        },
        "relationships": {
            "applied_tax_exemption_reason": {
                "data": null
            },
            "company": {
                "data": {
                    "type": "current_company",
                    "id": "800000046"
                }
            },
            "item_families": {
                "data": {
                    "type": "item_families",
                    "id": "4"
                }
            },
            "tax_exemption_reasons": {
                "data": null
            },
            "unit_of_measure": {
                "data": {
                    "type": "units_of_measure",
                    "id": "2"
                }
            }
        }
    }
```

{% endcode %}
{% endtab %}
{% endtabs %}

### Associar Unidades de Medida a Serviços

{% openapi src="/files/LrXEg3IjIacAycCz7IWE" path="/api/products" method="patch" %}
[TOConline Open API.yaml](https://1863668386-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fk7sif7BY0rPzivMcj1HB%2Fuploads%2Fgit-blob-1f7bd9dd692716d3f3f93d9c9a4f7226d78277e3%2FTOConline%20Open%20API.yaml?alt=media)
{% endopenapi %}

{% code title="PATCH" %}

```
https://api/v1.toconline.com/api/services
```

{% endcode %}

{% tabs %}
{% tab title="Payload" %}
{% code title="Payload" %}

```json
{
    "data": {
        "type": "service",
        "id": "6",
        "attributes": {
            "item_family_id": 4
        }
    }
}
```

{% endcode %}
{% endtab %}

{% tab title="Response" %}
{% code title="Response" %}

```json
{
    "meta": {
        "observed": {
            "scalar": 1
        }
    },
    "data": {
        "type": "services",
        "id": "7",
        "attributes": {
            "item_code": "54321",
            "item_description": "Serviço1",
            "sales_price": 10.0,
            "sales_price_includes_vat": false,
            "tax_code": "NOR",
            "applied_tax_code": "NOR",
            "notes": "Notas de Serviço",
            "is_merchandise": null,
            "location_in_warehouse": null,
            "sales_price_2": 20.0,
            "sales_price_3": 30.0,
            "purchase_price": 0.0,
            "ean_barcode": "",
            "financial_cost": 0.0,
            "transport_cost": 0.0,
            "other_cost": 0.0,
            "customs_cost": 0.0,
            "estimated_total_cost": 0.0,
            "product_inventory_type": null,
            "accounting_number": null,
            "service_group": "G1",
            "is_active": true,
            "sales_price_vat_display": 12.30,
            "sales_price_2_vat_display": 24.60,
            "sales_price_3_vat_display": 36.90,
            "applied_tax_exemption_reason_id": null
        },
        "relationships": {
            "applied_tax_exemption_reason": {
                "data": null
            },
            "company": {
                "data": {
                    "type": "current_company",
                    "id": "800000046"
                }
            },
            "item_families": {
                "data": {
                    "type": "item_families",
                    "id": "4"
                }
            },
            "tax_exemption_reasons": {
                "data": null
            },
            "unit_of_measure": {
                "data": {
                    "type": "units_of_measure",
                    "id": "5"
                }
            }
        }
    }
}
```

{% endcode %}
{% endtab %}
{% endtabs %}


# Vendas

{% content-ref url="/pages/WVAFJsFqjkVUIkbFfLyI" %}
[Documentos de Venda](/apis/vendas/documentos-de-venda)
{% endcontent-ref %}

{% content-ref url="/pages/Xstw2yrdlSv5UZjqxiTa" %}
[Descarregar PDF de Documentos de Venda](/apis/vendas/descarregar-pdf-de-documentos-de-venda)
{% endcontent-ref %}

{% content-ref url="/pages/Y5XchBUiisgxhNeJkRrG" %}
[Descarregar PDF de Recibo](/apis/vendas/descarregar-pdf-de-recibo)
{% endcontent-ref %}

{% content-ref url="/pages/jvMpbElwrWDEU8o5jsfm" %}
[Comunicação de documentos à AT](/apis/vendas/comunicacao-de-documentos-a-at)
{% endcontent-ref %}

{% content-ref url="/pages/lT9BR18jGNPwjxl89ylL" %}
[Recibos de Venda](/apis/vendas/recibos-de-venda)
{% endcontent-ref %}

{% content-ref url="/pages/0UQ5jxH8ZSdqWcWlQWpU" %}
[Envio de Documentos por email](/apis/vendas/envio-de-documentos-por-email)
{% endcontent-ref %}

{% content-ref url="/pages/wOXFLEdIPEi5OX92eWyc" %}
[Envio de Recibos por email](/apis/vendas/envio-de-recibos-por-email)
{% endcontent-ref %}


# Documentos de Venda

As rotas aqui descritas permitem gerir todos os processos relativos a documentos de venda — orçamentos, faturas-proforma, guias, faturas e notas —, incluindo a sua descarga em PDF.

## Criar Documento de Venda

{% openapi src="/files/LrXEg3IjIacAycCz7IWE" path="/api/v1/commercial\_sales\_documents" method="post" %}
[TOConline Open API.yaml](https://1863668386-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fk7sif7BY0rPzivMcj1HB%2Fuploads%2Fgit-blob-1f7bd9dd692716d3f3f93d9c9a4f7226d78277e3%2FTOConline%20Open%20API.yaml?alt=media)
{% endopenapi %}

#### Cabeçalho Documentos de Venda

| Atributo                            | Descrição                                                                                                          | Obrigatório |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ----------- |
| document\_type                      | Tipo de documento. "FT": fatura, "FS": fatura simplificada, "FR": fatura-recibo.                                   | Sim         |
| date                                | Data do documento. Por omissão, a data do pedido.                                                                  | Não         |
| document\_series\_id                | Identificador interno da série.                                                                                    | Não         |
| document\_series\_prefix            | Prefixo da série.                                                                                                  | Não         |
| customer\_id                        | Identificador interno do cliente.                                                                                  | Não         |
| customer\_tax\_registration\_number | NIF do cliente.                                                                                                    | Não         |
| customer\_business\_name            | Nome do cliente.                                                                                                   | Sim         |
| customer\_address\_detail           | Morada do cliente.                                                                                                 | Não         |
| customer\_postcode                  | Código postal do cliente, no formato 0000-000.                                                                     | Não         |
| customer\_city                      | Cidade/Localidade do cliente.                                                                                      | Não         |
| customer\_country                   | País do cliente. Por omissão, "PT".                                                                                | Não         |
| due\_date                           | Data de vencimento. Por omissão, a data do documento, ou a referente ao prazo de pagamento configurado no cliente. | Não         |
| settlement\_expression              | Desconto no cabeçalho, em percentagem. São suportados descontos compostos, como "3+5".                             | Não         |
| payment\_mechanism                  | Modo de pagamento.                                                                                                 | Não         |
| bank\_account\_id                   | Identificador interno da conta bancária da empresa para onde o recebimento é feito.                                | Não         |
| cash\_account\_id                   | Identificador interno da conta de caixa da empresa para onde o recebimento é feito.                                | Não         |
| vat\_included\_prices               | Os preços nas linhas são com IVA incluído? Por omissão, não (false).                                               | Não         |
| tax\_exemption\_reason\_id          | Motivo de isenção de IVA.                                                                                          | Não         |
| operation\_country                  | A região de operação para efeitos de IVA.                                                                          | Não         |
| currency\_id                        | Identificador interno da moeda.                                                                                    | Não         |
| currency\_iso\_code                 | Código ISO da moeda do documento.                                                                                  | Não         |
| currency\_conversion\_rate          | Taxa de conversão para EUR (1 EUR = n USD                                                                          | Nãão        |
| retention                           | Percentagem de retenção a aplicar sobre os serviços.                                                               | Não         |
| retention\_type                     | Tipo de retenção ("IRS" ou "IRC"). Por omissão, "IRS".                                                             | Não         |
| apply\_retention\_when\_paid        | A retenção é feita logo no documento (false) ou apenas no recebimento (true). Por omissão, false.                  | Não         |
| notes                               | Notas ao documento.                                                                                                | Não         |
| external\_reference                 | Referência do documento externo.                                                                                   | Não         |
| lines                               | Lista de linhas do documento.                                                                                      | Sim         |

#### Linha de Documentos de Venda

| Atributo               | Descrição                                                                                    | Obrigatório |
| ---------------------- | -------------------------------------------------------------------------------------------- | ----------- |
| item\_type             | Tipo de item: "Service": serviços, "Product": produtos, "TaxDescriptor": descritores.        | Sim         |
| item\_id               | Identificador interno do item.                                                               | Não         |
| item\_code             | Código do serviço/produto/descritor.                                                         | Não         |
| description            | Descrição da linha. Por omissão é usada a descrição associada ao item, se este for indicado. | Sim         |
| unit\_of\_measure\_id  | Identificador interno da unidade de medida.                                                  | Não         |
| unit\_of\_measure      | Unidade de medida. Por omissão é a configurada no item (se for serviço ou produto).          | Não         |
| quantity               | Quantidade da linha.                                                                         | Sim         |
| unit\_price            | Preço unitário da linha.                                                                     | Sim         |
| settlement\_expression | Desconto de linha, em percentagem.                                                           | Não         |
| tax\_id                | Identificador interno da taxa de IVA.                                                        | Não         |
| tax\_code              | Tipo de IVA associado ao item.                                                               | Não         |
| tax\_percentage        | Percentagem de IVA a usar.                                                                   | Não         |
| tax\_country\_region   | Região do IVA.                                                                               | Não         |

{% hint style="info" %}
**Nota 1 -** A série associada ao documento tem já que existir, e o seu "id" interno pode ser obtido por um:

`GET /commercial_document_series?filter[document_type]=<o tipo de documento>&filter[prefix]=<o prefixo da série a usar>`
{% endhint %}

{% hint style="info" %}
**Nota 2 -** Se o cliente for identificado pelo seu "id" interno tem já que existir, e o seu "id" interno pode ser obtido por um:

`GET /customers?filter[tax_registration_number]=<o NIF do cliente>`
{% endhint %}

{% hint style="info" %}
**Nota 3 -** São também suportados dois "países" adicionais: "PT-AC" (Portugal, Açores) e "PT-MA" (Portugal, Madeira). Os países disponíveis podem ser consultados por um GET /countries, ou um em particular por um:

`GET /countries?filter[iso_alpha_2]=<o código do país>`
{% endhint %}

{% hint style="info" %}
**Nota 4 -** O "id" interno da conta bancária da empresa deve ser obtido por um:

`GET /company_bank_accounts?filter[iban]=<IBAN da conta>`

`ou`

`GET /company_bank_accounts?filter[name]=<nome da conta>`
{% endhint %}

{% hint style="info" %}
**Nota 5** - O "id" interno da conta de caixa da empresa deve ser obtido por um

`GET /cash_accounts?filter[name]=<nome da conta>`
{% endhint %}

{% hint style="info" %}
**Nota 6** - O "id" interno do motivo de isenção deve ser obtido por um

`GET /tax_exemption_reasons?filter[code]=<o código legal do motivo de isenção>`
{% endhint %}

{% hint style="info" %}
**Nota 7** - O "id" interno da moeda deve ser obtido por um

`GET /currencies?filter[iso_code]=<o código ISO da moeda>`
{% endhint %}

{% hint style="info" %}
**Nota 8:** O item (serviço, produto ou descritor) tem já que existir, e o seu "id" interno pode ser obtido por um

`GET /services?filter[item_code]=<o código do serviço>`

`ou`

`GET /products?filter[item_code]=<o código do produto>`

`ou`

`GET /tax_descriptors?filter[notation]=<o código do descritor de taxa>`
{% endhint %}

{% hint style="info" %}
**Nota 9**: A unidade de medida tem já que existir, e o seu "id" interno pode ser obtido por um

`GET /units_of_measure?filter[unit_of_measure]=un|<o código da unidade de medida>`
{% endhint %}

{% hint style="info" %}
**Nota 10**: O "id" interno da taxa de IVA deve ser obtido por um

`GET /taxes?filter[tax_code]=<Código de Taxa> &filter[tax_country_region]=<Código da Região>`

`ou`

`GET /taxes?filter[tax_code]=<Código de Taxa> &filter[tax_country_region]=PT|<Código da Região>&filter[tax_percentage]=`\<a percentagem IVA>
{% endhint %}

{% hint style="info" %}
**Nota 11:** Para as faturas-recibos (FR), o recibo associado é criado automaticamente quando a FR é finalizada.
{% endhint %}

{% hint style="success" %}
Ao submenter o documento de venda fica automaticamente **finalizado**!
{% endhint %}

## Alteração do Documento de Venda

{% hint style="danger" %}
Após a criação de um documento de venda este fica automaticamente finalizado, se pretender criar documentos sem finalizar pode consultar a versão anterior desta API:[Documentos de Venda](/apis/vendas/documentos-de-venda)
{% endhint %}

Quando um documento é criado em um estado finalizado, torna-se impossível executar as seguintes operações em documentos de venda:

* Finalização do Documento de Venda
* Anulação do Documento de Venda
* Atualizar Documento de Venda
* Eliminação do Documento de Venda

***

## Obter Documento de Venda por Id

{% openapi src="/files/LrXEg3IjIacAycCz7IWE" path="/api/v1/commercial\_sales\_documents/{salesDocumentId}" method="get" %}
[TOConline Open API.yaml](https://1863668386-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fk7sif7BY0rPzivMcj1HB%2Fuploads%2Fgit-blob-1f7bd9dd692716d3f3f93d9c9a4f7226d78277e3%2FTOConline%20Open%20API.yaml?alt=media)
{% endopenapi %}

## Obter Todos os Documentos de Venda

{% openapi src="/files/LrXEg3IjIacAycCz7IWE" path="/api/v1/commercial\_sales\_documents/" method="get" %}
[TOConline Open API.yaml](https://1863668386-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fk7sif7BY0rPzivMcj1HB%2Fuploads%2Fgit-blob-1f7bd9dd692716d3f3f93d9c9a4f7226d78277e3%2FTOConline%20Open%20API.yaml?alt=media)
{% endopenapi %}


# Documentos Retificativos

As rotas aqui descritas permitem gerir todos os processos relativos a documentos rectificativos — notas de crédito e notas de debito—, incluindo a sua descarga em PDF.

## Criar Documento Retificativo

{% openapi src="/files/LrXEg3IjIacAycCz7IWE" path="/api/v1/commercial\_sales\_documents" method="post" %}
[TOConline Open API.yaml](https://1863668386-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fk7sif7BY0rPzivMcj1HB%2Fuploads%2Fgit-blob-1f7bd9dd692716d3f3f93d9c9a4f7226d78277e3%2FTOConline%20Open%20API.yaml?alt=media)
{% endopenapi %}

#### Cabeçalho Documentos de Venda

| Atributo                            | Descrição                                                                                                          | Obrigatório             |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ----------------------- |
| document\_type                      | Tipo de documento. "NC": Nota de Crédito, "ND": Nota de Débito.                                                    | Sim                     |
| parent\_documents\_ids              | Identificador interno do documento ao qual o documento retificativo está associado.                                | Não (mas é recomendado) |
| parent\_document\_reference         | Identificador externo do documento ao qual o documento retificativo está associado.                                | Não (mas é recomendado) |
| date                                | Data do documento. Por omissão, a data do pedido.                                                                  | Não                     |
| document\_series\_id                | Identificador interno da série.                                                                                    | Não                     |
| document\_series\_prefix            | Prefixo da série.                                                                                                  | Não                     |
| customer\_id                        | Identificador interno do cliente.                                                                                  | Não                     |
| customer\_tax\_registration\_number | NIF do cliente.                                                                                                    | Não                     |
| customer\_business\_name            | Nome do cliente.                                                                                                   | Sim                     |
| customer\_address\_detail           | Morada do cliente.                                                                                                 | Não                     |
| customer\_postcode                  | Código postal do cliente, no formato 0000-000.                                                                     | Não                     |
| customer\_city                      | Cidade/Localidade do cliente.                                                                                      | Não                     |
| customer\_country                   | País do cliente. Por omissão, "PT".                                                                                | Não                     |
| due\_date                           | Data de vencimento. Por omissão, a data do documento, ou a referente ao prazo de pagamento configurado no cliente. | Não                     |
| settlement\_expression              | Desconto no cabeçalho, em percentagem. São suportados descontos compostos, como "3+5".                             | Não                     |
| payment\_mechanism                  | Modo de pagamento.                                                                                                 | Não                     |
| bank\_account\_id                   | Identificador interno da conta bancária da empresa para onde o recebimento é feito.                                | Não                     |
| cash\_account\_id                   | Identificador interno da conta de caixa da empresa para onde o recebimento é feito.                                | Não                     |
| vat\_included\_prices               | Os preços nas linhas são com IVA incluído? Por omissão, não (false).                                               | Não                     |
| tax\_exemption\_reason\_id          | Motivo de isenção de IVA.                                                                                          | Não                     |
| operation\_country                  | A região de operação para efeitos de IVA.                                                                          | Não                     |
| currency\_id                        | Identificador interno da moeda.                                                                                    | Não                     |
| currency\_iso\_code                 | Código ISO da moeda do documento.                                                                                  | Não                     |
| currency\_conversion\_rate          | Taxa de conversão para EUR (1 EUR = n USD                                                                          | Nãão                    |
| retention                           | Percentagem de retenção a aplicar sobre os serviços.                                                               | Não                     |
| retention\_type                     | Tipo de retenção ("IRS" ou "IRC"). Por omissão, "IRS".                                                             | Não                     |
| apply\_retention\_when\_paid        | A retenção é feita logo no documento (false) ou apenas no recebimento (true). Por omissão, false.                  | Não                     |
| notes                               | Notas ao documento.                                                                                                | Não                     |
| external\_reference                 | Referência do documento externo.                                                                                   | Não                     |
| lines                               | Lista de linhas do documento.                                                                                      | Sim                     |

#### Linha de Documentos de Venda

| Atributo               | Descrição                                                                                    | Obrigatório |
| ---------------------- | -------------------------------------------------------------------------------------------- | ----------- |
| item\_type             | Tipo de item: "Service": serviços, "Product": produtos, "TaxDescriptor": descritores.        | Sim         |
| item\_id               | Identificador interno do item.                                                               | Não         |
| item\_code             | Código do serviço/produto/descritor.                                                         | Não         |
| description            | Descrição da linha. Por omissão é usada a descrição associada ao item, se este for indicado. | Sim         |
| unit\_of\_measure\_id  | Identificador interno da unidade de medida.                                                  | Não         |
| unit\_of\_measure      | Unidade de medida. Por omissão é a configurada no item (se for serviço ou produto).          | Não         |
| quantity               | Quantidade da linha.                                                                         | Sim         |
| unit\_price            | Preço unitário da linha.                                                                     | Sim         |
| settlement\_expression | Desconto de linha, em percentagem.                                                           | Não         |
| tax\_id                | Identificador interno da taxa de IVA.                                                        | Não         |
| tax\_code              | Tipo de IVA associado ao item.                                                               | Não         |
| tax\_percentage        | Percentagem de IVA a usar.                                                                   | Não         |
| tax\_country\_region   | Região do IVA.                                                                               | Não         |

{% hint style="info" %}
**Nota 1 -** A série associada ao documento tem já que existir, e o seu "id" interno pode ser obtido por um:

`GET /commercial_document_series?filter[document_type]=<o tipo de documento>&filter[prefix]=<o prefixo da série a usar>`
{% endhint %}

{% hint style="info" %}
**Nota 2 -** Se o cliente for identificado pelo seu "id" interno tem já que existir, e o seu "id" interno pode ser obtido por um:

`GET /customers?filter[tax_registration_number]=<o NIF do cliente>`
{% endhint %}

{% hint style="info" %}
**Nota 3 -** São também suportados dois "países" adicionais: "PT-AC" (Portugal, Açores) e "PT-MA" (Portugal, Madeira). Os países disponíveis podem ser consultados por um GET /countries, ou um em particular por um:

`GET /countries?filter[iso_alpha_2]=<o código do país>`
{% endhint %}

{% hint style="info" %}
**Nota 4 -** O "id" interno da conta bancária da empresa deve ser obtido por um:

`GET /company_bank_accounts?filter[iban]=<IBAN da conta>`

`ou`

`GET /company_bank_accounts?filter[name]=<nome da conta>`
{% endhint %}

{% hint style="info" %}
**Nota 5** - O "id" interno da conta de caixa da empresa deve ser obtido por um

`GET /cash_accounts?filter[name]=<nome da conta>`
{% endhint %}

{% hint style="info" %}
**Nota 6** - O "id" interno do motivo de isenção deve ser obtido por um

`GET /tax_exemption_reasons?filter[code]=<o código legal do motivo de isenção>`
{% endhint %}

{% hint style="info" %}
**Nota 7** - O "id" interno da moeda deve ser obtido por um

`GET /currencies?filter[iso_code]=<o código ISO da moeda>`
{% endhint %}

{% hint style="info" %}
**Nota 8:** O item (serviço, produto ou descritor) tem já que existir, e o seu "id" interno pode ser obtido por um

`GET /services?filter[item_code]=<o código do serviço>`

`ou`

`GET /products?filter[item_code]=<o código do produto>`

`ou`

`GET /tax_descriptors?filter[notation]=<o código do descritor de taxa>`
{% endhint %}

{% hint style="info" %}
**Nota 9**: A unidade de medida tem já que existir, e o seu "id" interno pode ser obtido por um

`GET /units_of_measure?filter[unit_of_measure]=un|<o código da unidade de medida>`
{% endhint %}

{% hint style="info" %}
**Nota 10**: O "id" interno da taxa de IVA deve ser obtido por um

`GET /taxes?filter[tax_code]=<Código de Taxa> &filter[tax_country_region]=<Código da Região>`

`ou`

`GET /taxes?filter[tax_code]=<Código de Taxa> &filter[tax_country_region]=PT|<Código da Região>&filter[tax_percentage]=`\<a percentagem IVA>
{% endhint %}

{% hint style="info" %}
**Nota 11:** Para as faturas-recibos (FR), o recibo associado é criado automaticamente quando a FR é finalizada.
{% endhint %}

{% hint style="success" %}
Ao submenter o documento de venda fica automaticamente **finalizado**!
{% endhint %}

## Alteração do Documento de Venda

{% hint style="danger" %}
Após a criação de um documento de venda este fica automaticamente finalizado, se pretender criar documentos sem finalizar pode consultar a versão anterior desta API:[Documentos de Venda](/apis/vendas/documentos-de-venda)
{% endhint %}

Quando um documento é criado em um estado finalizado, torna-se impossível executar as seguintes operações em documentos de venda:

* Finalização do Documento de Venda
* Anulação do Documento de Venda
* Atualizar Documento de Venda
* Eliminação do Documento de Venda

***

## Obter Documentos Retificativos por Id

{% openapi src="/files/LrXEg3IjIacAycCz7IWE" path="/api/v1/commercial\_sales\_documents/{salesDocumentId}" method="get" %}
[TOConline Open API.yaml](https://1863668386-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fk7sif7BY0rPzivMcj1HB%2Fuploads%2Fgit-blob-1f7bd9dd692716d3f3f93d9c9a4f7226d78277e3%2FTOConline%20Open%20API.yaml?alt=media)
{% endopenapi %}

## Obter Todos os Documentos Retificativos

{% openapi src="/files/LrXEg3IjIacAycCz7IWE" path="/api/v1/commercial\_sales\_documents/" method="get" %}
[TOConline Open API.yaml](https://1863668386-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fk7sif7BY0rPzivMcj1HB%2Fuploads%2Fgit-blob-1f7bd9dd692716d3f3f93d9c9a4f7226d78277e3%2FTOConline%20Open%20API.yaml?alt=media)
{% endopenapi %}


# Recibos de Venda

### Criar Cabeçalho Recibo de Venda <a href="#criacao-de-cabecalhos-e-linhas" id="criacao-de-cabecalhos-e-linhas"></a>

{% openapi src="/files/LrXEg3IjIacAycCz7IWE" path="/api/v1/commercial\_sales\_receipts" method="post" %}
[TOConline Open API.yaml](https://1863668386-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fk7sif7BY0rPzivMcj1HB%2Fuploads%2Fgit-blob-1f7bd9dd692716d3f3f93d9c9a4f7226d78277e3%2FTOConline%20Open%20API.yaml?alt=media)
{% endopenapi %}

```json
{ 
    "date": "2020-06-01",                          // [OPCIONAL] Data do recibo; por omissão, a data do pedido
    "payment_mechanism": "MO",                     // [OPCIONAL] Por omissão, "MO". Meios de pagamento aceites: "MO": Numerário, "CH": Cheque, "DC": Cartão de débito, "CC": Cartão de crédito, "TR": Transferência bancária, "DDA": Débito direto autorizado, "MB": Referências de pagamento Multibanco.                                             
    // [OPCIONAL] Recursos associados ao recibo. Caso nenhum seja indicado, os restantes devem atributos devem ser omitidos. Caso contrário, todos os atributos devem ser preenchidos.
    "commercial_document_series_id": 1,            // [OBRIGATÓRIO] Série de recibos associada. Não precisa de ser indicada; por omissão o recibo é criado na série por omissão associada ao tipo de documento. Vd. NOTA 1
    "bank_account_id": 2,                          // [OBRIGATÓRIO] Conta bancária da empresa para onde o recebimento é feito. Usado apenas quando o meio de pagamento é "DC", "CC", "TR" ou "DDA", e apenas se for necessário indicar uma conta bancária específica. Vd. NOTA 2
    "cash_account_id": 3,                          // [OBRIGATÓRIO] Conta de caixa da empresa para onde o recebimento é feito. Usado apenas quando o meio de pagamento é "MO", e apenas se for necessário indicar uma conta de caixa específica. Vd. NOTA 3
    "lines": [
        {
            "receivable_type": "Document",                              // [OBRIGATÓRIO]
            "receivable_id": "<id do documento a liquidar>",            // [OBRIGATÓRIO] Vd. NOTA 1
            "received_value": 50,                                       // [OBRIGATÓRIO] Valor total a receber (não é necessário receber a totalidade do documento, pode fazer-se um recebimento parcial)
            "settlement_percentage": "3"                                // [OPCIONAL] Desconto de pagamento, em percentagem; são suportados descontos compostos, como "3+5"
        }
    ]
}
```

{% hint style="info" %}
**Nota 1:** A série associada ao recibo tem já que existir, e o seu "id" interno deve ser obtido por um

{% code overflow="wrap" %}

```
GET /commercial_document_series?filter[document_type]=o tipo de documento> &filter[prefix]=<o prefixo da série> &filter[number]=<o numero da série>
```

{% endcode %}
{% endhint %}

{% hint style="info" %}
**Nota 2:** O "id" interno da conta bancária da empresa deve ser obtido por um

```
GET /company_bank_accounts?filter[iban]= <IBAN da conta> 
ou 
GET /company_bank_accounts?filter[name]= <nome da conta> 
```

{% endhint %}

{% hint style="info" %}
**Nota 3:** O "id" interno da conta de caixa da empresa deve ser obtido por um

```
GET /cash_accounts?filter[name]= <nome da conta>
```

{% endhint %}

### Criar Linhas de Recibo de Venda <a href="#criacao-de-cabecalhos-e-linhas" id="criacao-de-cabecalhos-e-linhas"></a>

{% openapi src="/files/LrXEg3IjIacAycCz7IWE" path="/api/commercial\_sales\_receipt\_lines" method="post" %}
[TOConline Open API.yaml](https://1863668386-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fk7sif7BY0rPzivMcj1HB%2Fuploads%2Fgit-blob-1f7bd9dd692716d3f3f93d9c9a4f7226d78277e3%2FTOConline%20Open%20API.yaml?alt=media)
{% endopenapi %}

### Anular Recibo de Venda <a href="#anulacao-de-um-recibo-caso-seja-preciso" id="anulacao-de-um-recibo-caso-seja-preciso"></a>

{% openapi src="/files/LrXEg3IjIacAycCz7IWE" path="/api/v1/commercial\_sales\_receipts/{salesReceiptId}/void" method="patch" %}
[TOConline Open API.yaml](https://1863668386-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fk7sif7BY0rPzivMcj1HB%2Fuploads%2Fgit-blob-1f7bd9dd692716d3f3f93d9c9a4f7226d78277e3%2FTOConline%20Open%20API.yaml?alt=media)
{% endopenapi %}

No pedido acima, o \<access\_token> corresponde ao token de acesso válido devolvido pelo serviço de OAuth

{% hint style="info" %}
**Nota 1:** O "id" interno do recibo a anular deve ser obtido por um

`GET /api/commercial_sales_receipts?filter[document_no]=<o número do recibo, ex. RC 2020/1>`
{% endhint %}

É na linha do recibo que se indica qual o documento (FT, ou outro) que foi pago.

Se necessário, pode criar-se mais do que uma linha (e nesse caso o recibo é emitido de uma só vez para todos os documentos referenciados)

### Edição do recibo, após criação <a href="#edicao-do-recibo-apos-criacao" id="edicao-do-recibo-apos-criacao"></a>

O seguinte pedido pode ser realizado, após a criação do recibo, e permite alterar informações sobre o mesmo. A estrutura do payload é a mesma do POST de criação. Neste, deverá enviar no id do pedido o id do recibo a alterar. Os atributos enviados no body irão substituir os guardados no momento, e cada linha enviada dentro de lines irá substituir os dados guardados na linha com id especificado em receipt\_line\_id

{% openapi src="/files/LrXEg3IjIacAycCz7IWE" path="/api/v1/commercial\_sales\_receipts/{salesReceiptId}" method="patch" %}
[TOConline Open API.yaml](https://1863668386-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fk7sif7BY0rPzivMcj1HB%2Fuploads%2Fgit-blob-1f7bd9dd692716d3f3f93d9c9a4f7226d78277e3%2FTOConline%20Open%20API.yaml?alt=media)
{% endopenapi %}

#### Exemplo:

{% tabs %}
{% tab title="Payload" %}
{% code title="Exemplo de Payload " %}

```json
{
    "date": "2024-02-24",
    "document_no": "RC 2023/1",
    "document_series_id": 66,
    "payment_mechanism": "MO",
    "gross_total": 10.69,
    "net_total": 9.25,
    "third_party_type": null,
    "third_party_id": null,
    "check_number": null,
    "currency_conversion_rate": 1,
    "internal_observations": "",
    "observations": "",
    "standalone": true,
    "saft_import_id": null,
    "deleted": true,
    "manual_registration_type": null,
    "manual_registration_series": null,
    "manual_registration_number": null,
    "created_at": "2024-02-23 11:49:25.209661",
    "updated_at": "2024-02-27 11:19:15.761393",
    "id": 2,
    "cash_account_id": 2,
    "company_id": 800000046,
    "country_id": 1,
    "currency_id": 1,
    "customer_id": 57,
    "user_id": 800000863,
    "lines": [
        {
            "receipt_id": 2,
            "receivable_type": "Document",
            "receivable_id": 12,
            "received_value": 10.69,
            "settlement_percentage": 0,
            "cashed_vat_amount": null,
            "gross_total": 11.38,
            "settlement_amount": 0.0,
            "net_total": 9.25,
            "retention_total": 0.69,
            "id": 2
        }
    ]
}
```

{% endcode %}
{% endtab %}

{% tab title="Response" %}
{% code title="Exemplo de Response" %}

```json
{
    "date": "2024-02-24",
    "document_no": "RC 2023/1",
    "document_series_id": 66,
    "payment_mechanism": "MO",
    "gross_total": 10.69,
    "net_total": 9.25,
    "third_party_type": null,
    "third_party_id": null,
    "check_number": null,
    "currency_conversion_rate": 1,
    "internal_observations": "",
    "observations": "",
    "standalone": true,
    "saft_import_id": null,
    "deleted": true,
    "manual_registration_type": null,
    "manual_registration_series": null,
    "manual_registration_number": null,
    "created_at": "2024-02-23 11:49:25.209661",
    "updated_at": "2024-02-27 14:03:24.085399",
    "id": 2,
    "cash_account_id": 2,
    "company_id": 800000046,
    "country_id": 1,
    "currency_id": 1,
    "customer_id": 57,
    "user_id": 800000863,
    "lines": [
        {
            "receipt_id": 2,
            "receivable_type": "Document",
            "receivable_id": 12,
            "received_value": 10.69,
            "settlement_percentage": 0,
            "cashed_vat_amount": null,
            "gross_total": 11.38,
            "settlement_amount": 0.0,
            "net_total": 9.25,
            "retention_total": 0.69,
            "id": 2
        }
    ]
}
```

{% endcode %}
{% endtab %}
{% endtabs %}

### Adição de Linha em Documento de Recibo de Venda <a href="#adicao-de-linhas" id="adicao-de-linhas"></a>

Caso pretenda adicionar novas linhas ao recibo, após a sua criação, pode utilizar a seguinte rota, que utiliza o mesmo payload das lines do pedido POST de criação.

{% openapi src="/files/LrXEg3IjIacAycCz7IWE" path="/api/commercial\_sales\_receipt\_lines" method="post" %}
[TOConline Open API.yaml](https://1863668386-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fk7sif7BY0rPzivMcj1HB%2Fuploads%2Fgit-blob-1f7bd9dd692716d3f3f93d9c9a4f7226d78277e3%2FTOConline%20Open%20API.yaml?alt=media)
{% endopenapi %}

No pedido acima, o \<access\_token> corresponde ao token de acesso válido devolvido pelo serviço de OAuth, e o \<payload JSON> deverá ter o seguinte formato

{% code title="Payload" %}

```json
{
  "data": {
    "type": "commercial_sales_receipt_lines",                     // [OBRIGATÓRIO]
    "attributes": {
      "receivable_type": "Document",                              // [OBRIGATÓRIO]
      "receivable_id": "<id do documento a liquidar>",            // [OBRIGATÓRIO] Vd. Nota 1
      "received_value": 50,                                       // [OBRIGATÓRIO] Valor total a receber (não é necessário receber a totalidade do documento, pode fazer-se um recebimento parcial)
      "settlement_percentage": "3"                                // [OPCIONAL] Desconto de pagamento, em percentagem; são suportados descontos compostos, como "3+5"
      "receipt_id" : "<id do recibo>"                            // [OBRIGATÓRIO] Recibo a que esta linha pertence. Este "id" é o devolvido na resposta ao pedido de criação do cabeçalho, ver acima
    }
  }
}
```

{% endcode %}

{% hint style="info" %}
**Nota 1:** O "id" interno do documento (fatura, nota) a receber deve ser obtido por um

{% code overflow="wrap" %}

```
GET /commercial_sales_documents?filter[document_no]=<o número do documento, ex. FT 2020/1>
```

{% endcode %}
{% endhint %}

{% hint style="success" %}
É na linha do recibo que se indica qual o documento (FT, ou outro) que foi pago.

Se necessário, pode criar-se mais do que uma linha (e nesse caso o recibo é emitido de uma só vez para todos os documentos referenciados)
{% endhint %}

### Remover Linha do Recibo de Venda

Do mesmo modo, caso pretenda remover linhas de um recibo, pode utilizar a seguinte rota, onde apenas tem de indicar o id da linha a remover, no path.

<mark style="color:red;">`DELETE`</mark> `/v1/commercial_sales_receipt_lines/{id}`

#### Path Parameters

| Name                                 | Type    | Description                      |
| ------------------------------------ | ------- | -------------------------------- |
| id<mark style="color:red;">\*</mark> | Integer | id of the receipt line to delete |

{% tabs %}
{% tab title="200: OK OK" %}

{% endtab %}
{% endtabs %}

### Obter Recibo de Venda por ID <a href="#consultar-recibo" id="consultar-recibo"></a>

Por fim, se pretender obter informações sobre um dado recibo pode utilizar a seguinte rota, onde deverá especificar o id do documento a analisar no path.

<mark style="color:blue;">`GET`</mark> `/v1/commercial_sales_receipts/{id}`

#### Path Parameters

| Name                                 | Type    | Description                                 |
| ------------------------------------ | ------- | ------------------------------------------- |
| id<mark style="color:red;">\*</mark> | integer | id of the receipt to get the information of |

{% tabs %}
{% tab title="200: OK OK" %}

{% endtab %}
{% endtabs %}


# Descarregar PDF de Documentos de Venda

A presente página descreve as rotas necessárias para a obtenção de um PDF de um documento

### Obter Caminho para Ficheiro

{% hint style="warning" %}
Para um documento ser descarregado, o mesmo deve estar com um estado (status) de finalizado (status = 1) .
{% endhint %}

{% openapi src="/files/LrXEg3IjIacAycCz7IWE" path="/api/url\_for\_print/{salesDocumentId}" method="get" %}
[TOConline Open API.yaml](https://1863668386-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fk7sif7BY0rPzivMcj1HB%2Fuploads%2Fgit-blob-1f7bd9dd692716d3f3f93d9c9a4f7226d78277e3%2FTOConline%20Open%20API.yaml?alt=media)
{% endopenapi %}

<pre data-title="Endpoint" data-overflow="wrap"><code><strong>https://app.toconline.pt/api/url_for_print/&#x3C;id do documento de venda>?filter[type]=Document&#x26;filter[copies]=1
</strong></code></pre>

{% hint style="info" %}
Para obter o id do Documento de Compra pretendido (document\_id) poderá consultar: [Documentos de Compra](/apis/compras/documentos-de-compra#obter-todos-os-documentos-de-compra-finalizados)
{% endhint %}

Tal como nos restantes pedidos especificados anteriormente, o \<access\_token> corresponde ao token de acesso válido devolvido pelo serviço de OAuth

### Descarregar Ficheiro

Utilizando a resposta recebida, deverá concatenar os atributos: scheme + "://" + host + path, e irá obter o link através do qual a transferência é imediata. Neste caso, seria:

```
https://app.toconline.pt/public-file/path_to_file
```


# Descarregar PDF de Recibo

### Obter Caminho para Ficheiro

{% hint style="warning" %}
Para um documento ser descarregado, o mesmo deve estar com um estado (status) de finalizado (status = 1) .
{% endhint %}

De modo a descarregar o PDF de um documento, deverá realizar um pedido à seguinte rota:

<pre data-title="GET" data-overflow="wrap"><code><strong>/api/url_for_print/&#x3C;id do recibo>?filter[type]=Receipt&#x26;filter[copies]=1
</strong></code></pre>

{% hint style="info" %}
Para obter o id do Documento de Compra pretendido (document\_id) poderá consultar: [Documentos de Compra](/apis/compras/documentos-de-compra#obter-todos-os-documentos-de-compra-finalizados)
{% endhint %}

Tal como nos restantes pedidos especificados anteriormente, o \<access\_token> corresponde ao token de acesso válido devolvido pelo serviço de OAuth

### Descarregar Ficheiro

Utilizando a resposta recebida, deverá concatenar os atributos: scheme + "://" + host + path, e irá obter o link através do qual a transferência é imediata. Neste caso, seria:

{% code title="GET" %}

```
/public-file/path_to_file
```

{% endcode %}


# Comunicação de documentos à AT

## Pedir comunicação de documentos <a href="#pedir-comunicacao-de-documentos" id="pedir-comunicacao-de-documentos"></a>

Pode enviar 3 tipos de documentos à Autoridade Tributária:

* *sales\_document*: documentos de venda
* *shipment\_document*: guias
* *purchases\_shipment\_document*: guias de devolução a fornecedor

De modo a comunicar um documento, deverá realizar um pedido POST, para o endpoint: *send\_document\_at\_webservice*

## Comunicação de documentos

<mark style="color:purple;">`PATCH`</mark> `/send_document_at_webservice`

#### Request Body

| Name                                   | Type   | Description |
| -------------------------------------- | ------ | ----------- |
| data<mark style="color:red;">\*</mark> | object |             |

{% tabs %}
{% tab title="200: OK " %}

```javascript
{
  data: {
    type: 'send_document_at_webservice',
    id: '<document_id>',
    attributes: {
      communication_status: <communciation_status>,
      communication_code: <communication_code>,
      communication_message: <communication_message>
    }
  }
}
```

{% endtab %}
{% endtabs %}

```
curl -v -X POST -H 'Content-Type: application/vnd.api+json'\
-H 'Accept: application/json'\
-H 'Authorization: Bearer <access_token>'\
-d '<payload JSON>' '<API_URL>/send_document_at_webservice'
```

O payload a utilizar para a comunicação é o seguinte:

{% code title="Payload" %}

```json
{
  "data": {
    "type": "send_document_at_webservice",
    "id": 2,
    "attributes": {
      "document_type": "<document_type>",
       "entity_username": "<at_username>",
       "entity_password": "<at_password_base_64>"
    }
  }
}
```

{% endcode %}

{% hint style="info" %}
"entity\_username" -> Nome de utilizador usado para acesso ao Portal das finanças. "entity\_password" -> Palavra-passe usada para acesso ao Portal das Finanças.
{% endhint %}

A resposta ao pedido trará informação sobre o sucesso/insucesso da operação no seguinte formato:

{% code title="Response" %}

```json
{
    "data": {
        "id": "<document_id>",
        "type": "send_document_at_webservice",
        "attributes": {
            "communication_message": "<communication_message>",
            "communication_code": "<communication_code>",
            "communication_status": "<communciation_status>",
        }
    }
}
```

{% endcode %}

O campo *communication\_code* terá o código de comunicação à Autoridade Tributária no caso do documento comunicado ter sido uma guia (vendas ou compras).


# Envio de Documentos por email

Envio de email de documentos via API. Inclui instruções de uso, headers e um exemplo de JSON payload para definição de emails e conteúdo.

{% openapi src="/files/LrXEg3IjIacAycCz7IWE" path="/api/email/document" method="patch" %}
[TOConline Open API.yaml](https://1863668386-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fk7sif7BY0rPzivMcj1HB%2Fuploads%2Fgit-blob-1f7bd9dd692716d3f3f93d9c9a4f7226d78277e3%2FTOConline%20Open%20API.yaml?alt=media)
{% endopenapi %}

{% code overflow="wrap" fullWidth="false" %}

```batch
curl -v -X PATCH -H 'Content-Type: application/vnd.api+json' -H 'Accept: application/json' -H 'Authorization: Bearer <access_token>' -d '<payload JSON>' '<API_URL>/email/document/<id do documento ou recibo>'
```

{% endcode %}

No pedido acima, o *access\_token* é o *token* de acesso válido devolvido pelo serviço de OAuth e o *id do documento ou recibo* é o "id" interno do documento ou do recibo (cabeçalho), o devolvido no campo "id" da resposta ao seu pedido de criação. O *payload* JSON a enviar contém a seguinte informação:

{% code title="Payload" %}

```json
{
  "data": {
    "type": "email/document",                                  // [OBRIGATÓRIO]
    "id": "<id do documento ou do recibo>",                    // [OBRIGATÓRIO] Este "id" é o devolvido na resposta ao pedido de criação do cabeçalho do documento ou do recibo, ver acima
    "attributes": {
      "type": "Document|Receipt",                              // [OPCIONAL] Por omissão "Document": "Document" para documentos de venda, "Receipt" para recibos
      "to_email": "email.do.destinatario@mail.mail",           // [OPCIONAL] Por omissão é o endereço de email do cliente; se não existir tem que ser indicado. Podem ser vários, separados por ,
      "from_email": "email.do.remetente@mail.mail",            // [OPCIONAL] Por omissão é o endereço no-reply de email do sistema (TOConline, Business...)
      "from_name": "Nome do remetente",                        // [OPCIONAL]
      "subject": "Assunto da mensagem"                         // [OPCIONAL] Por omissão é o assunto padrão do sistema ("(Nome da empresa) enviou-lhe um documento/recibo através do (TOConline, Business...)")
    }
  }
}
```

{% endcode %}

{% code title="Exemplo de Response" %}

```json
{
    "success": true,
    "to_addresses": "email.do.destinatario@mail.mail"
}
```

{% endcode %}


# Envio de Recibos por email

Envio de email de recibos via API. Inclui instruções de uso, headers e um exemplo de JSON payload para definição de emails e conteúdo.

{% openapi src="/files/LrXEg3IjIacAycCz7IWE" path="/api/email/document" method="patch" %}
[TOConline Open API.yaml](https://1863668386-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fk7sif7BY0rPzivMcj1HB%2Fuploads%2Fgit-blob-1f7bd9dd692716d3f3f93d9c9a4f7226d78277e3%2FTOConline%20Open%20API.yaml?alt=media)
{% endopenapi %}

{% code overflow="wrap" fullWidth="false" %}

```batch
curl -v -X POST -H 'Content-Type: application/vnd.api+json' -H 'Accept: application/json' -H 'Authorization: Bearer <access_token>' -d '<payload JSON>' '<API_URL>/email/document/<id do documento ou recibo>'
```

{% endcode %}

No pedido acima, o *access\_token* é o *token* de acesso válido devolvido pelo serviço de OAuth e o *id do documento ou recibo* é o "id" interno do documento ou do recibo (cabeçalho), o devolvido no campo "id" da resposta ao seu pedido de criação. O *payload* JSON a enviar contém a seguinte informação:

{% code title="Payload" %}

```json
{
  "data": {
    "type": "email/document",                                  // [OBRIGATÓRIO]
    "id": "<id do documento ou do recibo>",                    // [OBRIGATÓRIO] Este "id" é o devolvido na resposta ao pedido de criação do cabeçalho do documento ou do recibo, ver acima
    "attributes": {
      "type": "Receipt",                                       // [OBRIGATÓRIO "Receipt" para recibos
      "to_email": "email.do.destinatario@mail.mail",           // [OPCIONAL] Por omissão é o endereço de email do cliente; se não existir tem que ser indicado. Podem ser vários, separados por ,
      "from_email": "email.do.remetente@mail.mail",            // [OPCIONAL] Por omissão é o endereço no-reply de email do sistema (TOConline, Business...)
      "from_name": "Nome do remetente",                        // [OPCIONAL]
      "subject": "Assunto da mensagem"                         // [OPCIONAL] Por omissão é o assunto padrão do sistema ("(Nome da empresa) enviou-lhe um documento/recibo através do (TOConline, Business...)")
    }
  }
}
```

{% endcode %}

{% code title="Exemplo de Response" %}

```json
{
    "success": true,
    "to_addresses": "email.do.destinatario@mail.mail"
}
```

{% endcode %}


# Compras

{% content-ref url="/pages/3AMCBZpV8a4Y60fFrT0k" %}
[Documentos de Compra](/apis/compras/documentos-de-compra)
{% endcontent-ref %}

{% content-ref url="/pages/51YF1oQQOpORAybgq3lh" %}
[Descarregar PDF de Documentos de Compra](/apis/compras/descarregar-pdf-de-documentos-de-compra)
{% endcontent-ref %}

{% content-ref url="/pages/XqE0PX5rbFklBLRqn0sQ" %}
[Comunicação de documentos à AT](/apis/compras/comunicacao-de-documentos-a-at)
{% endcontent-ref %}

{% content-ref url="/pages/ag0S3lYctOwypnH39tGv" %}
[Pagamentos](/apis/compras/pagamentos)
{% endcontent-ref %}


# Documentos de Compra

Os documentos de compra na versão v1 da API têm a mesma estrutura anteriormente descrita para a v0: são compostos por um cabeçalho e uma ou mais linhas. Nesta nova versão, é possível criar ambos num só pedido, descrito de seguida.

## Criar Documento de Compra

{% openapi src="/files/LrXEg3IjIacAycCz7IWE" path="/api/v1/commercial\_purchases\_documents" method="post" %}
[TOConline Open API.yaml](https://1863668386-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fk7sif7BY0rPzivMcj1HB%2Fuploads%2Fgit-blob-1f7bd9dd692716d3f3f93d9c9a4f7226d78277e3%2FTOConline%20Open%20API.yaml?alt=media)
{% endopenapi %}

O *payload* JSON a enviar contém a seguinte informação:

```json
{
  // Identificação do documento
  "document_type": "FC|DSP",                                      // [OBRIGATÓRIO] Tipo de documento. "FC": fatura, "DSP": fatura de despesas.
  "date": "2023-01-01",                                           // [OPCIONAL] Data do documento; por omissão, a data do pedido.

  // [OPCIONAL] Identificação da série do documento. Por omissão, aplicam-se as regras configuradas na empresa para escolha da série.
  // Se a série for indicada, usar apenas um dos dois campos seguintes (o "id" ou o prefixo). Se se indicarem os dois, então devem ser consistentes.
  "document_series_id": 1,                                        // [OPCIONAL] Identificador interno da série. Ver NOTA 1 abaixo.
  "document_series_prefix": "Prefixo da série",                   // [OPCIONAL] Em alternativa ao campo "document_series_id".

  // [OPCIONAL] Identificação do fornecedor. Por omissão, é o fornecedor indiferenciado (NIF "999999990").
  // Se o fornecedor for indicado, usar apenas um dos dois campos seguintes (o "id" ou o NIF). Se se indicarem os dois, então devem ser consistentes.
  "supplier_id": 1,                                               // [OPCIONAL] Identificador interno do fornecedor. Ver NOTA 2.
  "supplier_tax_registration_number": "999999990",                // [OPCIONAL] NIF do fornecedor. se o fornecedor com o NIF indicado não existir, será criado automaticamente. Se o país ("supplier_country") for Portugal ("PT", "PT-AC" ou "PT-MA"), deve ser um NIF português válido.
  // [OPCIONAL] Os atributos seguintes são usados na criação do fornecedor, se não existir ainda.
  // Se o fornecedor já existir, são guardados no documento, mas a ficha do fornecedor não é actualizada.
  "supplier_business_name": "Nome do fornecedor",                 // [OBRIGATÓRIO] caso o fornecedor ainda não exista e tenha que ser criado. [OPCIONAL] nos outros casos, a não ser que exista mais do que um fornecedor com o NIF indicado, usando-se então o nome para o identificar.
  "supplier_address_detail": "Morada do fornecedor",              // [OPCIONAL]
  "supplier_postcode": "0000-000",                                // [OPCIONAL] Código postal do fornecedor, no formato 0000-000.
  "supplier_city": "Cidade/Localidade do fornecedor",             // [OPCIONAL]
  "supplier_country": "PT",                                       // [OPCIONAL] País do fornecedor. Por omissão, "PT"; é o código ISO alpha-2 do país do fornecedor (vd. https://en.wikipedia.org/wiki/ISO_3166-1_alpha-2; ver também a NOTA 3.

  // [OPCIONAL] Condições de pagamento
  "due_date": "2023-02-01",                                       // [OPCIONAL] Data de vencimento; por omissão, a data do documento, ou a referente ao prazo de pagamento configurado no fornecedor, se o fornecedor tiver configurado um prazo de pagamento.
  "settlement_expression": "7.5",                                 // [OPCIONAL] Desconto no cabeçalho, em percentagem; são suportados descontos compostos, como "3+5"

  // [OPCIONAL] IVA
  "vat_included_prices": false,                                   // [OPCIONAL] Os preços nas linhas são com IVA incluído? Por omissão, não (false).
  "tax_exemption_reason_id": 1,                                   // Motivo de isenção de IVA. [OBRIGATÓRIO] apenas se o documento tiver pelo menos uma linha isenta de IVA. Não deve ser indicado nos restantes casos. Ver NOTA 4.

  // [OPCIONAL] Moeda. Por omissão, "EUR".
  // Se a moeda for indicada, usar apenas um dos dois campos seguintes (o "id" ou o código ISO). Se se indicarem os dois, então devem ser consistentes.
  "currency_id": 1,                                               // [OPCIONAL] Identificador interno da moeda. Ver NOTA 5.
  "currency_iso_code": "USD",                                     // [OPCIONAL] É o código ISO da moeda do documento (vd. https://en.wikipedia.org/wiki/ISO_4217).
  "currency_conversion_rate": 1.21,                               // [OMITIDO] se a moeda for "EUR". [OBRIGATÓRIO] nos restantes casos; é a taxa de conversão para EUR (1 EUR = n USD|...).

  // [OPCIONAL] Retenção
  "retention_total": 9.99,                                        // [OPCIONAL] Valor total de retenção.
  "retention_type": "TD|TI|C|P|CPS|O",                            // [OPCIONAL] Tipo de retenção. TD: Trabalho dependente, TI: Trabalho independente, C: Capitais, P: Prediais, CPS: Comissões e Prestações de Serviços, O: Outros. Por omissão, "TD".

  // [OPCIONAL] Outras informações
  "notes": "Notas ao documento",                                  // [OPCIONAL]
  "external_reference": "Referência do documento externo",        // [OPCIONAL]

  // [OBRIGATÓRIO] Linhas do documento

  "lines": [
      {
          // [OPCIONAL] Identificação do item. Se nada for indicado, assume-se uma linha apenas de descrição.
          "item_type": "Product|Purchases::ExpenseCategory",      // [OPCIONAL] Tipo de item: "Product": produto, "Purchases::ExpenseCategory": categoria de despesas. Por omissão fica vazio (linha de descrição).
          // Se o item for indicado, usar apenas um dos dois campos seguintes (o "id" ou o código). Se se indicarem os dois, então devem ser consistentes entre si, e consistentes com o "item_type".
          "item_id": 1,                                           // [OPCIONAL] Identificador interno do item. Ver NOTA 6.
          "item_code": "Código do produto/categoria de despesas", // [OPCIONAL] Já tem que existir o produto/categoria de despesas com este código. Por omissão, é usado o item identificado pelo campo "item_id". Se nada for indicado, assume-se uma linha apenas de descrição.
          "description": "Descrição da linha",                    // [OPCIONAL] Por omissão é usada a descrição associada ao item, se este for indicado. [OBRIGATÓRIO] Para uma linha apenas de descrição.

          // [OPCIONAL] Unidade de medida. Por omissão é a configurada no item (se for produto), ou a por omissão na empresa.
          // Se a unidade de medida for indicada, usar apenas um dos dois campos seguintes (o "id" ou o código). Se se indicarem os dois, então devem ser consistentes entre si.
          "unit_of_measure_id": 1,                                // [OPCIONAL] Identificador interno da unidade de medida. Ver NOTA 7.
          "unit_of_measure": "Unidade de medida",                 // [OPCIONAL] Por omissão é a configurada no item (se for produto), ou a por omissão na empresa.
          // Quantidades e valores. [OBRIGATÓRIO] Para linhas de descrição valorizadas.
          "quantity": 1,                                          // [OPCIONAL] Por omissão 1, se não for uma linha de descrição valorizada. [OBRIGATÓRIO] Para uma linha de descrição valorizada.
          "unit_price": 9.99,                                     // [OPCIONAL] Se for indicado um produto. Por omissão é usado o PVP associado ao produto. [OBRIGATÓRIO] Para uma linha de categoria de despesas ou de descrição valorizada.
          "settlement_expression": "3",                           // [OPCIONAL] Desconto de linha, em percentagem; são suportados descontos compostos, como "3+5".

          // [OPCIONAL] IVA. Por omissão é aplicado o IVA associado ao item, ou à taxa normal, na região onde a empresa está localizada.
          // Se a taxa de IVA for indicada, usar apenas ou o campo "id" ou um ou mais dos três campos seguintes. Se se indicarem todos os campos, então devem ser consistentes entre si.
          "tax_id": 1,                                            // [OPCIONAL] Identificador interno da taxa de IVA. Ver NOTA 8.
          "tax_code": "NOR|INT|RED|ISE",                          // [OPCIONAL] Por omissão é usado o tipo de IVA associado ao item, ou "NOR" se nenhum associado. Os tipos de IVA suportados são "NOR" (normal), "INT" (intermédio), "RED" (reduzido), "ISE" (isento).
          "tax_percentage": 22,                                   // [OPCIONAL] Percentagem de IVA a usar: serve para indicar uma taxa de outra região (se o campo "tax_country_region" não for indicado) ou uma taxa antiga, já não em vigor.
          "tax_country_region": "PT-MA"                           // [OPCIONAL] Região do IVA. Por omissão (e se o campo "tax_percentage" não for indicado) aplica-se a taxa de IVA da região onde a empresa está localizada.
    },
      // Outras linhas, se existirem
      ...
  ]
}
```

{% hint style="info" %}
**Nota 1:** A série associada ao documento tem já que existir, e o seu "id" interno pode ser obtido por um

{% code overflow="wrap" %}

```
GET /commercial_document_series?filter[document_type]=<o tipo de documento ex: FC> &filter[prefix]=<o prefixo da série a usar, ex: 2020> 
```

{% endcode %}
{% endhint %}

{% hint style="info" %}
Nota 2: Se o fornecedor for identificado pelo seu "id" interno tem já que existir, e o seu "id" interno pode ser obtido por um

<pre data-overflow="wrap"><code><strong>GET /suppliers?filter[tax_registration_number]=&#x3C;o NIF do fornecedor>
</strong></code></pre>

{% endhint %}

{% hint style="info" %}
**Nota 3**: São também suportados dois "países" adicionais: "PT-AC" (Portugal, Açores) e "PT-MA" (Portugal, Madeira). Os países disponíveis podem ser consultados por um GET /countries, ou um em particular por um

```
GET /countries?filter[iso_alpha_2]=PT|<o código do país>
```

{% endhint %}

{% hint style="info" %}
**Nota 4**: O "id" interno do motivo de isenção deve ser obtido por um

{% code overflow="wrap" %}

```
GET /tax_exemption_reasons?filter[code]=M07|<o código legal do motivo de isenção>
```

{% endcode %}
{% endhint %}

{% hint style="info" %}
**Nota 5**: O "id" interno da moeda deve ser obtido por um

{% code overflow="wrap" %}

```
GET /currencies?filter[iso_code]=USD|<o código ISO da moeda> 
```

{% endcode %}
{% endhint %}

{% hint style="info" %}
Nota 6: O item (produto ou categoria de despesas) tem já que existir, e o seu "id" interno pode ser obtido por um

{% code overflow="wrap" %}

```
GET /products?filter[item_code]=<o código do produto> 
ou
GET /expense_categories?filter[accounting_number]=<o código da categoria de despesas, ex: 331> 
```

{% endcode %}
{% endhint %}

{% hint style="info" %}
**Nota 7**: A unidade de medida tem já que existir, e o seu "id" interno pode ser obtido por um

{% code overflow="wrap" %}

```
GET /units_of_measure?filter[unit_of_measure]=<o código da unidade de medida, ex: un> 
```

{% endcode %}
{% endhint %}

{% hint style="info" %}
**Nota 8:** O "id" interno da taxa de IVA deve ser obtido por um

{% code overflow="wrap" %}

```
GET /taxes?filter[tax_code]=NOR|<o tipo de IVA>&filter[tax_country_region]=PT|<a região do IVA>
ou
GET /taxes?filter[tax_code]=<o tipo de IVA, ex:NOR> &filter[tax_country_region]=<a região do IVA, ex: PT> &filter[tax_percentage]=<a percentagem IVA, ex:22>
```

{% endcode %}
{% endhint %}

## Alteração do Documento de Compra

{% hint style="danger" %}
Após a criação de um documento de compra este fica automaticamente finalizado, se pretender criar documentos sem finalizar pode consultar a versão anterior desta API: [Documentos de Compra](/apis/versoes-anteriores/compras/documentos-de-compra)
{% endhint %}

Quando um documento é criado em um estado finalizado, torna-se impossível executar as seguintes operações em documentos de compra:

* Finalização do Documento de Compra
* Anulação do Documento de Compra
* AtualizarDocumento de Compra
* Eliminação do Documento de Compra

## Consulta do documento

Os documentos podem ser consultados a qualquer altura, antes ou depois de finalizados, e mesmo depois de anulados.

{% openapi src="/files/LrXEg3IjIacAycCz7IWE" path="/api/v1/commercial\_purchases\_documents" method="get" %}
[TOConline Open API.yaml](https://1863668386-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fk7sif7BY0rPzivMcj1HB%2Fuploads%2Fgit-blob-1f7bd9dd692716d3f3f93d9c9a4f7226d78277e3%2FTOConline%20Open%20API.yaml?alt=media)
{% endopenapi %}


# Pagamentos

Os pagamentos seguem a mesma estrutura anteriormente definida: São compostos por um cabeçalho, e linhas. Nesta nova versão, é possível criar ambas as componentes num só pedido, descrito de seguida.

### Criar Cabeçalho de sPagamento <a href="#criacao-de-cabecalhos-e-linhas" id="criacao-de-cabecalhos-e-linhas"></a>

Os detalhes do pedido POST para a criação de recibos estão descritos de seguida, em formato OpenAPI, e em cURL.

{% openapi src="/files/LrXEg3IjIacAycCz7IWE" path="/api/v1/commercial\_purchases\_payments" method="post" %}
[TOConline Open API.yaml](https://1863668386-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fk7sif7BY0rPzivMcj1HB%2Fuploads%2Fgit-blob-1f7bd9dd692716d3f3f93d9c9a4f7226d78277e3%2FTOConline%20Open%20API.yaml?alt=media)
{% endopenapi %}

Este pedido permite criar um pagamento, e respetivas linhas, em simultâneo.

{% code overflow="wrap" %}

```
curl -v -X POST -H 'Content-Type: application/vnd.api+json' -H 'Accept: application/json' -H 'Authorization: Bearer <access_token>' -d '<payload JSON>' '<API_URL>/v1/commercial_purchases_payments'
```

{% endcode %}

Neste, o payload JSON deverá vir no seguinte formato

```json
{
    "id":2,
    "lines": [
       {
            "payment_id": 2,
            "payable_type": "Purchases::Document",
            "payable_id": 2,
            "paid_value": 200,
            "settlement_percentage": 1.0,
            "cashed_vat_amount": null,
            "gross_total": 9.65,
            "settlement_amount": 0.0,
            "net_total": 5.0,
            "retention_total": 0.0,
        }
    ]
}
```

## Anulação de um Pagamento <a href="#anulacao-de-um-documento-caso-seja-preciso" id="anulacao-de-um-documento-caso-seja-preciso"></a>

{% openapi src="/files/LrXEg3IjIacAycCz7IWE" path="/api/v1/commercial\_purchases\_documents/{id}/void" method="patch" %}
[TOConline Open API.yaml](https://1863668386-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fk7sif7BY0rPzivMcj1HB%2Fuploads%2Fgit-blob-1f7bd9dd692716d3f3f93d9c9a4f7226d78277e3%2FTOConline%20Open%20API.yaml?alt=media)
{% endopenapi %}

## Atualizar Pagamento

O seguinte pedido pode ser realizado, após a criação do documento, e permite alterar informações sobre o documento. A estrutura do payload é a mesma do POST de criação. Neste, deverá enviar no id do pedido o id do documento a alterar. Os atributos enviados no body irão substituir os guardados no momento, e cada linha enviada dentro de lines irá substituir os dados guardados na linha com id especificado em payment\_line\_id

{% openapi src="/files/LrXEg3IjIacAycCz7IWE" path="/api/commercial\_purchases\_payments/{id}" method="patch" %}
[TOConline Open API.yaml](https://1863668386-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fk7sif7BY0rPzivMcj1HB%2Fuploads%2Fgit-blob-1f7bd9dd692716d3f3f93d9c9a4f7226d78277e3%2FTOConline%20Open%20API.yaml?alt=media)
{% endopenapi %}

## Adicionar Linhas ao Pagamento <a href="#adicao-de-linhas" id="adicao-de-linhas"></a>

{% openapi src="/files/LrXEg3IjIacAycCz7IWE" path="/api/commercial\_purchases\_payment\_lines" method="post" %}
[TOConline Open API.yaml](https://1863668386-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fk7sif7BY0rPzivMcj1HB%2Fuploads%2Fgit-blob-1f7bd9dd692716d3f3f93d9c9a4f7226d78277e3%2FTOConline%20Open%20API.yaml?alt=media)
{% endopenapi %}

{% code title="Payload" %}

```json
{
  "data": {
    "type": "commercial_purchases_payment_lines",
    "attributes": {
      "payable_id": "<id do documento de compra a pagar>",
      "payable_type": "Purchases::Document",
      //"payment_id": "<id do pagamento a que pertence esta linha>"
     
      "paid_value": 50, // Valor total a pagar (não é necessário pagar a totalidade do documento, ou pode pagar-se mais do que um documento)
      // Indicar o atributo seguinte apenas se existir desconto no pagamento (3%, neste exemplo)
      "settlement_percentage": 3
    }
  }
}
```

{% endcode %}

{% hint style="info" %}
NOTA: É na linha que se indica qual o documento de compra (FC ou DSP) a pagar. Se necessário, podem criar-se mais do que uma linha (e nesse caso o pagamento é feito de uma só vez para todos os documentos)
{% endhint %}

## Remover Linhas de Pagamento <a href="#remocao-de-linhas" id="remocao-de-linhas"></a>

Do mesmo modo, caso pretenda remover linhas de um documento, pode utilizar a seguinte rota, onde apenas tem de indicar o id da linha a remover, no path.

{% openapi src="/files/LrXEg3IjIacAycCz7IWE" path="/api/commercial\_purchases\_payment\_lines" method="delete" %}
[TOConline Open API.yaml](https://1863668386-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fk7sif7BY0rPzivMcj1HB%2Fuploads%2Fgit-blob-1f7bd9dd692716d3f3f93d9c9a4f7226d78277e3%2FTOConline%20Open%20API.yaml?alt=media)
{% endopenapi %}

## Obter Pagamento por Id <a href="#consultar-documento" id="consultar-documento"></a>

Por fim, se pretender obter informações sobre um dado documento, pode utilizar a seguinte rota, onde deverá especificar o id do documento a analisar no path.

{% openapi src="/files/LrXEg3IjIacAycCz7IWE" path="/api/commercial\_purchases\_payments/{id}" method="get" %}
[TOConline Open API.yaml](https://1863668386-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fk7sif7BY0rPzivMcj1HB%2Fuploads%2Fgit-blob-1f7bd9dd692716d3f3f93d9c9a4f7226d78277e3%2FTOConline%20Open%20API.yaml?alt=media)
{% endopenapi %}

## Obter Todos os Pagamentos <a href="#consultar-documento" id="consultar-documento"></a>

{% openapi src="/files/LrXEg3IjIacAycCz7IWE" path="/api/v1/commercial\_purchases\_payments/" method="get" %}
[TOConline Open API.yaml](https://1863668386-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fk7sif7BY0rPzivMcj1HB%2Fuploads%2Fgit-blob-1f7bd9dd692716d3f3f93d9c9a4f7226d78277e3%2FTOConline%20Open%20API.yaml?alt=media)
{% endopenapi %}


# Descarregar PDF de Documentos de Compra

### Obter Caminho para Ficheiro

{% hint style="warning" %}
Para um documento ser descarregado, o mesmo deve estar com um estado (status) de finalizado (status = 1) .
{% endhint %}

De modo a descarregar o PDF de um documento, deverá realizar um pedido à seguinte rota:

{% openapi src="/files/LrXEg3IjIacAycCz7IWE" path="/api/url\_for\_print/{purchasesDocumentId}" method="get" %}
[TOConline Open API.yaml](https://1863668386-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fk7sif7BY0rPzivMcj1HB%2Fuploads%2Fgit-blob-1f7bd9dd692716d3f3f93d9c9a4f7226d78277e3%2FTOConline%20Open%20API.yaml?alt=media)
{% endopenapi %}

{% hint style="info" %}
Para obter o id do Documento de Compra pretendido (document\_id) poderá consultar:

[Documentos de Compra](/apis/compras/documentos-de-compra#obter-todos-os-documentos-de-compra-finalizados)
{% endhint %}

Tal como nos restantes pedidos especificados anteriormente, o \<access\_token> corresponde ao token de acesso válido devolvido pelo serviço de OAuth

### Descarregar Ficheiro

Utilizando a resposta recebida, deverá concatenar os atributos: scheme + "://" + host + path, e irá obter o link através do qual a transferência é imediata. Neste caso, seria:

{% code title="GET" %}

```
https://app.toconline.pt/public-file/path_to_file
```

{% endcode %}


# Descarregar PDF de Pagamentos

### Obter Caminho para Ficheiro

{% hint style="warning" %}
Para um documento ser descarregado, o mesmo deve estar com um estado (status) de finalizado (status = 1) .
{% endhint %}

De modo a descarregar o PDF de um documento, deverá realizar um pedido à seguinte rota:

{% code title="GET" overflow="wrap" %}

```html
https://app.toconline.pt/api/url_for_print/<id do documento de compra>?filter[type]=PurchasesDocument&filter[copies]=1
```

{% endcode %}

{% hint style="info" %}
Para obter o id do Documento de Compra pretendido (document\_id) poderá consultar:

[Documentos de Compra](/apis/compras/documentos-de-compra#obter-todos-os-documentos-de-compra-finalizados)
{% endhint %}

Tal como nos restantes pedidos especificados anteriormente, o \<access\_token> corresponde ao token de acesso válido devolvido pelo serviço de OAuth

### Descarregar Ficheiro

Utilizando a resposta recebida, deverá concatenar os atributos: scheme + "://" + host + path, e irá obter o link através do qual a transferência é imediata. Neste caso, seria:

{% code title="GET" %}

```html
https://app.toconline.pt/public-file/path_to_file
```

{% endcode %}


# Comunicação de documentos à AT

## Pedir comunicação de documentos <a href="#pedir-comunicacao-de-documentos" id="pedir-comunicacao-de-documentos"></a>

Pode enviar 3 tipos de documentos à Autoridade Tributária:

* *sales\_document*: documentos de venda
* *shipment\_document*: guias
* *purchases\_shipment\_document*: guias de devolução a fornecedor

De modo a comunicar um documento, deverá realizar um pedido POST, para o endpoint: *send\_document\_at\_webservice*

## Comunicação de documentos

<mark style="color:purple;">`PATCH`</mark> `/send_document_at_webservice`

#### Request Body

| Name                                   | Type   | Description |
| -------------------------------------- | ------ | ----------- |
| data<mark style="color:red;">\*</mark> | object |             |

{% tabs %}
{% tab title="200: OK " %}

```javascript
{
  data: {
    type: 'send_document_at_webservice',
    id: '<document_id>',
    attributes: {
      communication_status: <communciation_status>,
      communication_code: <communication_code>,
      communication_message: <communication_message>
    }
  }
}
```

{% endtab %}
{% endtabs %}

```
curl -v -X POST -H 'Content-Type: application/vnd.api+json'\
-H 'Accept: application/json'\
-H 'Authorization: Bearer <access_token>'\
-d '<payload JSON>' '<API_URL>/send_document_at_webservice'
```

O payload a utilizar para a comunicação é o seguinte:

{% code title="Payload" %}

```json
{
  "data": {
    "type": "send_document_at_webservice",
    "id": 2,
    "attributes": {
      "document_type": "<document_type>",
       "entity_username": "<at_username>",
       "entity_password": "<at_password_base_64>"
    }
  }
}
```

{% endcode %}

{% hint style="info" %}
"entity\_username" -> Nome de utilizador usado para acesso ao Portal das finanças. "entity\_password" -> Palavra-passe usada para acesso ao Portal das Finanças.
{% endhint %}

A resposta ao pedido trará informação sobre o sucesso/insucesso da operação no seguinte formato:

{% code title="Response" %}

```json
{
    "data": {
        "id": "<document_id>",
        "type": "send_document_at_webservice",
        "attributes": {
            "communication_message": "<communication_message>",
            "communication_code": "<communication_code>",
            "communication_status": "<communciation_status>",
        }
    }
}
```

{% endcode %}

O campo *communication\_code* terá o código de comunicação à Autoridade Tributária no caso do documento comunicado ter sido uma guia (vendas ou compras).


# Versões Anteriores

{% content-ref url="/pages/3D6wKrqCpifRFfXlLdCD" %}
[Vendas](/apis/versoes-anteriores/vendas)
{% endcontent-ref %}

{% content-ref url="/pages/7ldLA7R5Ut2fDubBHkdG" %}
[Compras](/apis/versoes-anteriores/compras)
{% endcontent-ref %}


# Vendas

{% content-ref url="/pages/V4u6SqQjKMutBhwBvGkr" %}
[Documentos de Venda](/apis/versoes-anteriores/vendas/documentos-de-venda)
{% endcontent-ref %}

{% content-ref url="/pages/61fIZv5ssDlgCIfFm1fX" %}
[Recibos de Venda](/apis/versoes-anteriores/vendas/recibos-de-venda)
{% endcontent-ref %}


# Documentos de Venda

As rotas aqui descritas permitem gerir todos os processos relativos a documentos de venda: orçamentos, faturas-proforma, guias, faturas e notas.

## Criação do Documento de Venda

**1. Criação do cabeçalho**

Para dar início à criação de um documento comercial, começa-se pelo cabeçalho. Isto é realizado através de uma solicitação POST usando cURL, onde é necessário incluir um token de acesso (`access_token`), e o conteúdo (`payload JSON`) que detalha as especificações do documento, incluindo o tipo de documento (fatura, fatura simplificada, fatura-recibo), informação sobre o cliente (novo ou existente), condições de pagamento, detalhes sobre o IVA, entre outros atributos opcionais.

**2. Adição de Linhas**

Após a criação do cabeçalho, é possível adicionar uma ou mais linhas ao documento. Este passo permite detalhar os produtos ou serviços que estão sendo transacionados.

**3. Finalização do Documento**

O documento pode ser finalizado após a adição de todas as informações necessárias. Uma vez finalizado, o documento não pode ser alterado ou eliminado, apenas anulado se necessário.

Cada passo é crucial para assegurar que o documento comercial seja criado de forma precisa e conforme as necessidades do usuário. A atenção aos detalhes durante o processo de criação e finalização é fundamental para a integridade do documento.

***

### 1. Criar Cabeçalho de Documento de Venda

{% openapi src="/files/LrXEg3IjIacAycCz7IWE" path="/api/commercial\_sales\_documents" method="post" %}
[TOConline Open API.yaml](https://1863668386-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fk7sif7BY0rPzivMcj1HB%2Fuploads%2Fgit-blob-1f7bd9dd692716d3f3f93d9c9a4f7226d78277e3%2FTOConline%20Open%20API.yaml?alt=media)
{% endopenapi %}

No pedido acima, o *access\_token* é o *token* de acesso válido devolvido pelo serviço de OAuth. O *payload* JSON a enviar contém a seguinte informação:

<table><thead><tr><th width="298">Atributo</th><th width="325">Descrição</th><th>Obrigatório</th></tr></thead><tbody><tr><td>document_type</td><td>Tipo de documento. "FT": fatura, "FS": fatura simplificada, "FR": fatura-recibo.</td><td>Sim</td></tr><tr><td>date</td><td>Data do documento; por omissão, a data do pedido.</td><td>Não</td></tr><tr><td>document_series_prefix</td><td>Em alternativa ao campo "document_series_id".</td><td>Não</td></tr><tr><td>customer_tax_registration_number</td><td>NIF do cliente. Se o cliente com o NIF indicado não existir, será criado automaticamente.</td><td>Não</td></tr><tr><td>customer_business_name</td><td>Nome do cliente.</td><td>Sim</td></tr><tr><td>customer_address_detail</td><td>Morada do cliente.</td><td>Não</td></tr><tr><td>customer_postcode</td><td>Código postal do cliente, no formato 0000-000.</td><td>Não</td></tr><tr><td>customer_city</td><td>Cidade/Localidade do cliente.</td><td>Não</td></tr><tr><td>customer_country</td><td>País do cliente. Por omissão, "PT"; é o código ISO alpha-2 do país do cliente.</td><td>Não</td></tr><tr><td>customer_id</td><td>No caso do cliente já existir e não pretender criar um novo.</td><td>Não</td></tr><tr><td>due_date</td><td>Data de vencimento; por omissão, a data do documento, ou a referente ao prazo de pagamento configurado no cliente.</td><td>Não</td></tr><tr><td>settlement_expression</td><td>Desconto no cabeçalho, em percentagem; são suportados descontos compostos, como "3+5"</td><td>Não</td></tr><tr><td>payment_mechanism</td><td>Modos de pagamento aceites.</td><td>Não</td></tr><tr><td>vat_included_prices</td><td>Os preços nas linhas são com IVA incluído? Por omissão, não (false).</td><td>Não</td></tr><tr><td>operation_country</td><td>A região de operação para efeitos de IVA.</td><td>Não</td></tr><tr><td>currency_iso_code</td><td>É o código ISO da moeda do documento.</td><td>Não</td></tr><tr><td>currency_conversion_rate</td><td>É a taxa de conversão para EUR.</td><td>Não</td></tr><tr><td>retention</td><td>Percentagem de retenção a aplicar sobre os serviços.</td><td>Não</td></tr><tr><td>retention_type</td><td>Tipo de retenção ("IRS" ou "IRC"). Por omissão, "IRS".</td><td>Não</td></tr><tr><td>apply_retention_when_paid</td><td>A retenção é feita logo no documento (false) ou apenas no recebimento (true). Por omissão, false.</td><td>Não</td></tr><tr><td>notes</td><td>Notas ao documento.</td><td>Não</td></tr><tr><td>external_reference</td><td>Referência do documento externo.</td><td>Não</td></tr></tbody></table>

{% hint style="info" %}
**Nota 1 -** A série associada ao documento tem já que existir, e o seu "id" interno pode ser obtido por um:

{% code overflow="wrap" %}

```
GET /commercial_document_series?filter[document_type]=<o tipo de documento>&filter[prefix]=<o prefixo da série a usar> 
```

{% endcode %}
{% endhint %}

{% hint style="info" %}
**Nota 2 -** Se o cliente for identificado pelo seu "id" interno tem já que existir, e o seu "id" interno pode ser obtido por um:

```
GET /customers?filter[tax_registration_number]=<o NIF do cliente>
```

{% endhint %}

{% hint style="info" %}
**Nota 3 -** São também suportados dois "países" adicionais: "PT-AC" (Portugal, Açores) e "PT-MA" (Portugal, Madeira). Os países disponíveis podem ser consultados por um GET /countries, ou um em particular por um:

```
GET /countries?filter[iso_alpha_2]=<o código do país>
```

{% endhint %}

{% hint style="info" %}
**Nota 4 -** O "id" interno da conta bancária da empresa deve ser obtido por um:

```
GET /company_bank_accounts?filter[iban]=<IBAN da conta> 
ou 
GET /company_bank_accounts?filter[name]=<nome da conta>
```

{% endhint %}

{% hint style="info" %}
**Nota 5** - O "id" interno da conta de caixa da empresa deve ser obtido por um

```
GET /cash_accounts?filter[name]=<nome da conta>
```

{% endhint %}

{% hint style="info" %}
**Nota 6** - O "id" interno do motivo de isenção deve ser obtido por um

{% code overflow="wrap" %}

```
GET /tax_exemption_reasons?filter[code]=<o código legal do motivo de isenção>  
```

{% endcode %}
{% endhint %}

{% hint style="info" %}
**Nota 7** - O "id" interno da moeda deve ser obtido por um

```
GET /currencies?filter[iso_code]=<o código ISO da moeda>
```

{% endhint %}

### 2. Criação da(s) linha(s)

Após a criação do documento, é possível personalizar as linhas do mesmo para detalhar produtos, serviços, ou outros descritores específicos. As linhas podem ser configuradas para refletir várias especificidades fiscais e comerciais, incluindo a opção de adicionar linhas apenas descritivas, com ou sem valor associado.

As linhas podem referenciar três tipos de itens: produtos, serviços ou descritores (juros, imobilizado, impostos especiais...). Para cada um destes o *payload* é ligeiramente diferente, e cada um será descrito de seguida.

{% openapi src="/files/LrXEg3IjIacAycCz7IWE" path="/api/commercial\_sales\_receipt\_lines" method="post" %}
[TOConline Open API.yaml](https://1863668386-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fk7sif7BY0rPzivMcj1HB%2Fuploads%2Fgit-blob-1f7bd9dd692716d3f3f93d9c9a4f7226d78277e3%2FTOConline%20Open%20API.yaml?alt=media)
{% endopenapi %}

No pedido mencionado acima, o `access_token` representa o token de acesso validado pelo serviço de OAuth. O payload JSON a ser enviado contém informações distintas para um produto, um serviço ou um descritor, conforme será detalhado nas etapas seguintes.ccc

#### 2.1. Criar Linha de Documento de Venda para um Produto

<table><thead><tr><th width="158">Atributo</th><th width="363">Descrição</th><th>Obrigatório</th></tr></thead><tbody><tr><td>document_id</td><td>ID do documento ao qual esta linha está associada.</td><td>Sim</td></tr><tr><td>item_type</td><td>Tipo de item: "Product" para produto.</td><td>Sim</td></tr><tr><td>quantity</td><td>Quantidade do item. Por omissão, 1.</td><td>Não</td></tr><tr><td>unit_price</td><td>Preço unitário do item. Por omissão, é usado o PVP associado ao produto.</td><td>Não</td></tr><tr><td>settlement_expression</td><td>Desconto de linha, em percentagem; são suportados descontos compostos, como "3+5".</td><td>Não</td></tr><tr><td>item_id</td><td>ID do produto.</td><td>Não</td></tr><tr><td>unit_of_measure_id</td><td>ID da unidade de medida. Por omissão, é a configurada no produto ou a padrão da empresa.</td><td>Não</td></tr><tr><td>tax_id</td><td>ID do imposto associado ao item. Por omissão, é aplicado o IVA associado ao produto ou a taxa normal da empresa.</td><td>Não</td></tr></tbody></table>

#### 2.2. Criar Linha de Documento de Venda para um Serviço

{% hint style="warning" %}
Já deve ter um Serviço criado previamente. Pode consultar mais informação em [Produtos e Serviços](/apis/empresa/produtos-e-servicos#criar-servicos)
{% endhint %}

| Atributo               | Descrição                                                           | Obrigatório |
| ---------------------- | ------------------------------------------------------------------- | ----------- |
| type                   | Tipo de linha de documento.                                         | Sim         |
| document\_id           | ID do documento ao qual esta linha está associada.                  | Sim         |
| item\_type             | Tipo de item: "Service" (serviço).                                  | Sim         |
| quantity               | Quantidade do serviço.                                              | Não         |
| unit\_price            | Preço unitário do serviço.                                          | Não         |
| settlement\_expression | Expressão de liquidação, em percentagem.                            | Não         |
| item\_id               | ID do serviço associado à linha.                                    | Não         |
| unit\_of\_measure\_id  | ID da unidade de medida.                                            | Não         |
| tax\_id                | ID do imposto sobre o valor acrescentado (IVA) aplicado ao serviço. | Não         |

#### 2.3. Criar Linha de Documento de Venda para um Descritor

{% hint style="warning" %}
Já deve ter um Descritor criado previamente. Pode consultar mais informação em [Descritores de Taxa](/apis/apis-auxiliares/descritores-de-taxa#criar-descritores)
{% endhint %}

<table><thead><tr><th width="230">Atributo</th><th width="351">Descrição</th><th>Obrigatório</th></tr></thead><tbody><tr><td>document_id</td><td>ID do documento ao qual esta linha está associada.</td><td>Sim</td></tr><tr><td>item_type</td><td>Tipo de item: "Service" para serviço.</td><td>Sim</td></tr><tr><td>quantity</td><td>Quantidade do serviço. Por omissão, 1.</td><td>Não</td></tr><tr><td>unit_price</td><td>Preço unitário do serviço. Por omissão, é usado o PVP associado ao serviço.</td><td>Não</td></tr><tr><td>settlement_expression</td><td>Desconto de linha, em percentagem; são suportados descontos compostos, como "3+5".</td><td>Não</td></tr><tr><td>item_id</td><td>ID do serviço.</td><td>Não</td></tr><tr><td>unit_of_measure_id</td><td>ID da unidade de medida. Por omissão, é a configurada no serviço ou a padrão da empresa.</td><td>Não</td></tr><tr><td>tax_id</td><td>ID do imposto associado ao serviço. Por omissão, é aplicado o IVA associado ao serviço ou a taxa normal da empresa.</td><td>Não</td></tr></tbody></table>

#### 2.5. Criar Linha de Documento de Venda para uma Descrição Sem Valor

Para o caso particular de uma linha de descrição sem valor, este *payload* contém a seguinte informação:

| Atributo     | Descrição                                 | Obrigatório |
| ------------ | ----------------------------------------- | ----------- |
| description  | Descrição da linha do documento.          | Sim         |
| document\_id | ID do documento ao qual a linha pertence. | Sim         |

### 3. Finalização do documento

Após todas as linhas criadas, e se não houver mais nenhuma alteração ao documento, este pode ser finalizado.

{% hint style="danger" %}
Após a finalização, a alteração ou eliminação do cabeçalho e das linhas deixa de ser possível, assim como a criação de linhas adicionais.
{% endhint %}

No pedido acima, o *access\_token* é o *token* de acesso válido devolvido pelo serviço de OAuth e o *id do documento* é o "id" interno do documento (cabeçalho) é o devolvido no campo "id" da resposta ao seu pedido de criação (ver ponto **1. Criação do cabeçalho**). O *payload* JSON a enviar contém a seguinte informação:

<table><thead><tr><th width="144">Atributo</th><th>Descrição</th><th>Obrigatório</th></tr></thead><tbody><tr><td>type</td><td>Tipo de documento.</td><td>Sim</td></tr><tr><td>id</td><td>Identificador interno do documento (cabeçalho). Este "id" é devolvido na resposta ao pedido de criação do cabeçalho.</td><td>Sim</td></tr><tr><td>status</td><td>Identificação do estado do documento. 1: documento finalizado.</td><td>Sim</td></tr></tbody></table>

<details>

<summary>Exemplo de Response</summary>

```json
{
    "meta": {
        "observed": {
            "scalar": 1
        }
    },
    "data": {
        "type": "commercial_sales_documents",
        "id": "12",
        "attributes": {
            "document_no": "FT 2023/3",
            "status": 1,
            "date": "2023-01-01",
            "payment_mechanism": null,
            "gross_total": 11.38,
            "notes": "Notas ao documento",
            "document_type": "FT",
            "pending_total": 11.38,
            "retention": 7.5,
            "settlement": null,
            "settlement_total": 0.75,
            "due_date": "2023-01-01",
            "emailed": null,
            "tax_payable": 2.13,
            "net_total": 9.25,
            "document_hash_sum": "k8FEN8/xf+GErWsPiATVpAWd5jM64132yWVldc6qg7XNxpjt+JCJTwgqQ5fswUsXw0MbbtBzHpN/aZozPiiiRHiHAR+TM4hJ8u5XnAe5hiss2Tn//QiCxbvolLywCqRw4cIt1UcbhMEP97YYj0FdLgzrPTF1amU+Xk81EkBzq54=",
            "hash_control": "1",
            "reference": null,
            "customer_tax_registration_number": "229659179",
            "customer_business_name": "Ricardo Ribeiro",
            "customer_address_detail": "Praceta da Liberdade n5",
            "customer_postcode": "1000-101",
            "customer_city": "Lisboa",
            "created_at": "2024-02-21 16:41:50.588385",
            "updated_at": "2024-02-22 18:21:13.512872",
            "is_receipt": null,
            "vehicle_registration": null,
            "shipment_address_detail": null,
            "shipment_postcode": null,
            "shipment_city": null,
            "vat_incidence_ise": 0,
            "vat_incidence_red": 0,
            "vat_incidence_int": 0,
            "vat_incidence_nor": 9.25,
            "vat_total_red": 0,
            "vat_total_int": 0,
            "vat_total_nor": 2.13,
            "customer_tax_country_region": "PT",
            "currency_amount": null,
            "customer_country": "PT",
            "printed": null,
            "currency_conversion_rate": 1,
            "currency_iso_code": "EUR",
            "system_entry_date": "2024-02-22 18:21:13.512872",
            "retention_value": 0.69,
            "parent_document_reference": "",
            "acts_as_shipment_document": false,
            "manual_registration_series": "",
            "manual_registration_number": "",
            "shipment_loading_time": null,
            "expected_shipment_unloading_time": null,
            "apply_retention_when_paid": true,
            "retention_aware_gross_total": 10.69,
            "pending_retention_value": 0.69,
            "communication_status": "unsent",
            "shipment_country": null,
            "is_invoice_receipt": null,
            "due_days": null,
            "scheduled_start_date": null,
            "scheduled_end_date": null,
            "scheduled_description": null,
            "scheduled_interval": null,
            "base_currency_gross_total": null,
            "base_currency_net_total": null,
            "base_currency_pending_total": null,
            "base_currency_settlement_total": null,
            "base_currency_retention_total": null,
            "base_currency_retention_aware_gross_total": null,
            "base_currency_tax_payable": null,
            "base_currency_vat_incidence_nor": null,
            "base_currency_vat_total_nor": null,
            "base_currency_vat_incidence_int": null,
            "base_currency_vat_total_int": null,
            "base_currency_vat_incidence_red": null,
            "base_currency_vat_total_red": null,
            "base_currency_vat_incidence_ise": null,
            "base_currency_conversion_difference": null,
            "start_date": null,
            "end_date": null,
            "periodicity": null,
            "description": null,
            "reference_document_type": null,
            "is_active": null,
            "scheduled_invoice_id": null,
            "issue_finalized": null,
            "periodicity_type": null,
            "invoice_counter": null,
            "expired": null,
            "send_email": null,
            "communication_code": null,
            "shipment_from_address_detail": null,
            "shipment_from_postcode": null,
            "shipment_from_city": null,
            "shipment_from_country": null,
            "is_third_party": false,
            "is_document_to_self": false,
            "manual_registration_type": null,
            "third_party_type": 0,
            "document_area": "FT",
            "parent_document_type": null,
            "parent_document_area": null,
            "communication_code_source": "webservice",
            "cashed_vat": false,
            "made_available_to": true,
            "other_taxes_total": 0,
            "base_currency_other_taxes_total": null,
            "other_retentions": 0,
            "base_currency_other_retentions": null,
            "retention_type": null,
            "net_settlement_total": null,
            "external_reference": "Referência do documento externo",
            "document_series_prefix": "2023",
            "document_series_no": 3,
            "email_readed": false,
            "vat_included_prices": false,
            "voided_reason": null,
            "settlement_with_tax": 0.92,
            "settlement_without_tax": 0.75,
            "line_settlement_with_tax": 0,
            "line_settlement_without_tax": 0,
            "total_pending_quantity": null,
            "child_documents_ids": null,
            "parent_documents_ids": null,
            "receipts_ids": null,
            "operation_country": "PT",
            "sort_status": 1,
            "settlement_percentage": 7.500000000000000000000,
            "settlement_expression": "7.5",
            "vat_percentage_red": null,
            "vat_percentage_int": null,
            "vat_percentage_nor": 23.0,
            "vat_incidence_ise_unrounded": 0,
            "vat_incidence_red_unrounded": 0,
            "vat_incidence_int_unrounded": 0,
            "vat_incidence_nor_unrounded": 0,
            "vat_total_red_unrounded": 0,
            "vat_total_int_unrounded": 0,
            "vat_total_nor_unrounded": 0,
            "settlement_with_tax_unrounded": 0,
            "settlement_without_tax_unrounded": 0,
            "line_settlement_with_tax_unrounded": 0,
            "line_settlement_without_tax_unrounded": 0,
            "retention_value_unrounded": 0,
            "required_mask": 10,
            "fulfilled_mask": 0,
            "public_link": "https://app.toconline.pt/public_links/link/uDdZazxttzBsJwrne83w6kSUwkbM2a8vlYIiXztqKlYhRRdNIR8hFfDLi0sxw98g-0CWzNyMJ0RlBfRMbjBomsK-QOysT0Gm3D7poBTOivqjzCsRTIPTbcs3s3lN3LyGQoILoexjjctqpvK6CBSjOA"
        },
        "relationships": {
            "bank_accounts": {
                "data": null
            },
            "cash_accounts": {
                "data": null
            },
            "commercial_document_series": {
                "data": {
                    "type": "commercial_document_series",
                    "id": "72"
                }
            },
            "company": {
                "data": {
                    "type": "current_company",
                    "id": "800000046"
                }
            },
            "currency": {
                "data": {
                    "type": "currencies",
                    "id": "1"
                }
            },
            "customer": {
                "data": {
                    "type": "customers",
                    "id": "57"
                }
            },
            "lines": {
                "data": []
            },
            "tax_exemption_reasons": {
                "data": null
            },
            "user": {
                "data": {
                    "type": "current_company_users",
                    "id": "800000863"
                }
            }
        }
    }
}
```

</details>

{% hint style="info" %}
Este pedido é equivalente ao pedido de alteração do cabeçalho do documento (ver **Alteração do cabeçalho do documento**). Por isso, a finalização do documento — que é a alteração do atributo "status" do cabeçalho — pode ser realizada juntamente com a alteração de outros atributos ou relações do cabeçalho, num único pedido.
{% endhint %}

***

## Alteração do Documento de Venda

Enquanto o documento não for finalizado, tanto o seu cabeçalho como qualquer uma das suas linhas podem ser alteradas a qualquer momento. Além disso, qualquer uma das linhas pode ser eliminada (ver **Eliminação de uma linha**), e novas linhas criadas e adicionadas (ver **2. Criação da(s) linha(s)**).

### Atualizar Linha de Documento de Venda

{% openapi src="/files/LrXEg3IjIacAycCz7IWE" path="/api/commercial\_sales\_document\_lines" method="patch" %}
[TOConline Open API.yaml](https://1863668386-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fk7sif7BY0rPzivMcj1HB%2Fuploads%2Fgit-blob-1f7bd9dd692716d3f3f93d9c9a4f7226d78277e3%2FTOConline%20Open%20API.yaml?alt=media)
{% endopenapi %}

O exemplo de *payload* acima deve por isso ser ajustado consoante se trate da alteração duma linha de produto, de serviço, de descritor ou de descrição. É ainda possível alterar o tipo de linha (de uma linha de serviço para uma de produto, por exemplo).

{% hint style="info" %}
O *access\_token* é o *token* de acesso válido devolvido pelo serviço de OAuth.

O *id da linha* é o "id" interno da linha do documento, devolvido no campo "id" da resposta ao seu pedido de criação (ver ponto [#id-2.-criacao-da-s-linha-s](#id-2.-criacao-da-s-linha-s "mention") )
{% endhint %}

A informação que pode ser enviada no pedido de alteração da linha do documento é equivalente à que é obtida após criação ou obtenção de Documentos de Venda.

<table><thead><tr><th width="329">Atributo</th><th>Descrição</th></tr></thead><tbody><tr><td>type</td><td>Tipo de linha de documento.</td></tr><tr><td>id</td><td>Identificador interno da linha do documento.</td></tr><tr><td>item_id</td><td>ID do item associado à linha.</td></tr><tr><td>item_code</td><td>Código do item.</td></tr><tr><td>description</td><td>Descrição da linha.</td></tr><tr><td>amount</td><td>Valor total da linha.</td></tr><tr><td>unit_price</td><td>Preço unitário do item.</td></tr><tr><td>quantity</td><td>Quantidade do item.</td></tr><tr><td>tax_code</td><td>Tipo de IVA aplicado.</td></tr><tr><td>tax_percentage</td><td>Percentagem de IVA.</td></tr><tr><td>tax_amount</td><td>Valor do IVA aplicado.</td></tr><tr><td>settlement_amount</td><td>Valor de liquidação da linha.</td></tr><tr><td>settlement_percentage</td><td>Percentagem de liquidação da linha.</td></tr><tr><td>exemption_reason</td><td>Motivo da isenção de imposto.</td></tr><tr><td>created_at</td><td>Data e hora de criação da linha.</td></tr><tr><td>updated_at</td><td>Data e hora da última atualização da linha.</td></tr><tr><td>tax_country_region</td><td>Região do IVA aplicado.</td></tr><tr><td>item_unit_price_includes_vat</td><td>Indica se o preço unitário do item inclui IVA.</td></tr><tr><td>net_amount</td><td>Valor líquido da linha.</td></tr><tr><td>net_unit_price</td><td>Preço unitário líquido do item.</td></tr><tr><td>net_tax_amount</td><td>Valor líquido do IVA.</td></tr><tr><td>date</td><td>Data associada à linha.</td></tr><tr><td>retention_value</td><td>Valor de retenção.</td></tr><tr><td>pending_total</td><td>Total pendente.</td></tr><tr><td>pending_retention_value</td><td>Valor de retenção pendente.</td></tr><tr><td>locked</td><td>Indica se a linha está bloqueada.</td></tr><tr><td>base_currency_amount</td><td>Valor total da linha na moeda base.</td></tr><tr><td>base_currency_unit_price</td><td>Preço unitário do item na moeda base.</td></tr><tr><td>base_currency_tax_amount</td><td>Valor do IVA na moeda base.</td></tr><tr><td>base_currency_net_unit_price</td><td>Preço unitário líquido do item na moeda base.</td></tr><tr><td>base_currency_net_amount</td><td>Valor líquido da linha na moeda base.</td></tr><tr><td>base_currency_settlement_without_tax</td><td>Valor de liquidação sem IVA na moeda base.</td></tr><tr><td>original_document_no</td><td>Número do documento original associado à linha.</td></tr><tr><td>net_settlement_amount</td><td>Valor líquido de liquidação.</td></tr><tr><td>net_amount_with_header_settlement</td><td>Valor líquido da linha com liquidação no cabeçalho.</td></tr><tr><td>amount_with_header_settlement</td><td>Valor total da linha com liquidação no cabeçalho.</td></tr><tr><td>settlement_with_tax</td><td>Valor de liquidação com IVA.</td></tr><tr><td>settlement_without_tax</td><td>Valor de liquidação sem IVA.</td></tr><tr><td>base_currency_settlement_with_tax</td><td>Valor de liquidação com IVA na moeda base.</td></tr><tr><td>item_type</td><td>Tipo de item: "Product" (produto), "Service" (serviço) ou "TaxDescriptor" (descritor de imposto).</td></tr><tr><td>pending_quantity</td><td>Quantidade pendente.</td></tr><tr><td>imported_quantity</td><td>Quantidade importada.</td></tr><tr><td>settlement_expression</td><td>Expressão de liquidação.</td></tr><tr><td>tax_descriptor_id</td><td>ID do descritor de imposto associado à linha.</td></tr></tbody></table>

Por favor, note que alguns atributos podem estar marcados como `null`, o que significa que não foram fornecidos valores para esses atributos no JSON.

{% hint style="info" %}
**Nota 1 -** O `"id"` interno do documento, associado ao cabeçalho, corresponde ao "id" fornecido na resposta ao pedido de criação desse cabeçalho. Consulte a secção [#id-1.-criacao-do-cabecalho](#id-1.-criacao-do-cabecalho "mention") para mais detalhes.
{% endhint %}

{% hint style="info" %}
**Nota 2 -** O item (serviço, produto ou descritor) já deve existir, e o seu "`id"` interno pode ser obtido por um

```
GET /services?filter[item_code]=<o código do serviço> 
ou 
GET /products?filter[item_code]=<o código do produto> 
ou 
GET /tax_descriptors?filter[notation]=<o código do descritor>
```

{% endhint %}

{% hint style="info" %}
**Nota 3 -** Além de "PT" (Portugal Continental), são também suportadas as regiões autónomas de IVA "PT-AC" (Açores) e "PT-MA" (Madeira).

Para consultar os regimes de IVA no âmbito do OSS, é importante notar que os códigos de região correspondem aos códigos dos países. Estes códigos podem ser obtidos através do seguinte pedido:

```
GET /countries?filter[iso_alpha_2]=<o código do país OSS>
```

{% endhint %}

{% hint style="info" %}
**Nota 4 -** A unidade de medida deve existir previamente, e seu identificador `"id"` interno pode ser obtido através de um

{% code overflow="wrap" %}

```
GET /units_of_measure?filter[unit_of_measure]=<o código da unidade de medida>
```

{% endcode %}
{% endhint %}

{% hint style="info" %}
**Nota 5** - O "id" interno da taxa de IVA deve ser obtido por um

{% code overflow="wrap" %}

```
GET /taxes?filter[tax_code]=&filter[tax_country_region]=<a região do IVA>
ou
GET /taxes?filter[tax_code]=&filter[tax_country_region]=<a região do IVA>&filter[tax_percentage]=<a percentagem IVA>
```

{% endcode %}
{% endhint %}

### Remover Linha de Documento de Venda

{% openapi src="/files/LrXEg3IjIacAycCz7IWE" path="/api/commercial\_sales\_document\_lines/{salesDocumentLineId}" method="delete" %}
[TOConline Open API.yaml](https://1863668386-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fk7sif7BY0rPzivMcj1HB%2Fuploads%2Fgit-blob-1f7bd9dd692716d3f3f93d9c9a4f7226d78277e3%2FTOConline%20Open%20API.yaml?alt=media)
{% endopenapi %}

No pedido acima, o *access\_token* é o *token* de acesso válido devolvido pelo serviço de OAuth e o *id da linha* é o "id" interno da linha do documento, devolvido no campo "id" da resposta ao seu pedido de criação (ver ponto **2. Criação da(s) linha(s)**).

***

## Anulação do documento

Após a sua finalização, o documento deixa de poder ser eliminado, podendo apenas ser anulado.

{% openapi src="/files/LrXEg3IjIacAycCz7IWE" path="/api/v1/commercial\_sales\_receipts/{salesReceiptId}/void" method="patch" %}
[TOConline Open API.yaml](https://1863668386-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fk7sif7BY0rPzivMcj1HB%2Fuploads%2Fgit-blob-1f7bd9dd692716d3f3f93d9c9a4f7226d78277e3%2FTOConline%20Open%20API.yaml?alt=media)
{% endopenapi %}

No pedido acima, o *access\_token* é o *token* de acesso válido devolvido pelo serviço de OAuth e o *id do documento* é o "id" interno do documento (cabeçalho) é o devolvido no campo "id" da resposta ao seu pedido de criação (ver ponto **1. Criação do cabeçalho**). O *payload* JSON a enviar contém a seguinte informação:

```json
{
  "data": {
    "type": "commercial_sales_documents",                             // [OBRIGATÓRIO]
    "id": "1",                                                        // [OBRIGATÓRIO] Identificador interno do documento (cabeçalho). Este "id" é o devolvido na resposta ao pedido de criação do cabeçalho, ver acima.
    "attributes": {                                                   // [OBRIGATÓRIO] Os atributos do documento
      "status": 4,                                                    // [OBRIGATÓRIO] Identificação do estado do documento. 4: documento anulado.
      "voided_reason": "Motivo pelo qual se anula o documento"        // [OBRIGATÓRIO]
    }
  }
}
```

{% hint style="danger" %}
Após a sua anulação, o documento deixa de poder ser alterado. Esta operação é irreversível.
{% endhint %}

***

## Remover Documento de Venda

{% hint style="success" %}
Enquanto estiver em preparação, o documento pode ser eliminado.
{% endhint %}

{% hint style="danger" %}
Após a **finalização**, a sua eliminação — assim como a sua alteração — deixa de ser possível. Para saber mais consulte: [#id-3.-finalizacao-do-documento](#id-3.-finalizacao-do-documento "mention")
{% endhint %}

{% openapi src="/files/LrXEg3IjIacAycCz7IWE" path="/api/commercial\_sales\_documents/{id}" method="delete" %}
[TOConline Open API.yaml](https://1863668386-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fk7sif7BY0rPzivMcj1HB%2Fuploads%2Fgit-blob-1f7bd9dd692716d3f3f93d9c9a4f7226d78277e3%2FTOConline%20Open%20API.yaml?alt=media)
{% endopenapi %}

No pedido acima, o *access\_token* é o *token* de acesso válido devolvido pelo serviço de OAuth e o *id do documento* é o "id" interno do documento (cabeçalho) é o devolvido no campo "id" da resposta ao seu pedido de criação (ver ponto **1. Criação do cabeçalho**).

{% hint style="warning" %}
Esta operação é irreversível.
{% endhint %}


# Recibos de Venda

## Criação de recibos

Cada recibo é constituído por:

1. Um cabeçalho
2. Uma ou mais linhas

O recibo não possui um estado "em preparação".

Um recibo pode ser (3.) anulado.

### 1. Criar Cabeçalho do Recibo de Venda

{% hint style="warning" %}
Já tem de exisitir um **Documento de Venda Finalizado**

Para mais informações consulte: [/pages/V4u6SqQjKMutBhwBvGkr#id-3.-finalizacao-do-documento](https://api-docs.toconline.pt/apis/versoes-anteriores/vendas/pages/V4u6SqQjKMutBhwBvGkr#id-3.-finalizacao-do-documento "mention")
{% endhint %}

Os detalhes do pedido POST para a criação de recibos estão descritos de seguida, em formato OpenAPI, e em cURL.

{% openapi src="/files/LrXEg3IjIacAycCz7IWE" path="/api/commercial\_sales\_receipts" method="post" %}
[TOConline Open API.yaml](https://1863668386-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fk7sif7BY0rPzivMcj1HB%2Fuploads%2Fgit-blob-1f7bd9dd692716d3f3f93d9c9a4f7226d78277e3%2FTOConline%20Open%20API.yaml?alt=media)
{% endopenapi %}

{% code overflow="wrap" %}

```bash
curl -v -X POST -H 'Content-Type: application/vnd.api+json' -H 'Accept: application/json' -H 'Authorization: Bearer <access_token>' -d '<payload JSON>' '<API_URL>/commercial_sales_receipts'
```

{% endcode %}

No pedido acima, o \<access\_token> corresponde ao token de acesso válido devolvido pelo serviço de OAuth, e o \<payload JSON> deverá ter o seguinte formato

{% hint style="info" %}
Para saber como obter mais informação de como obter o id dos Documentos de Série poderá consultar: [Documentos de Série](/apis/apis-auxiliares/documentos-de-serie)
{% endhint %}

{% hint style="info" %}
Para saber como obter mais informação de como obter o id da Conta Bancária poderá consultar: [Contas Bancárias](/apis/apis-auxiliares/contas-bancarias)
{% endhint %}

{% hint style="info" %}
Para saber como obter mais informação de como obter o id da Conta de Caixa Associada poderá consultar: [Caixa Associada](/apis/apis-auxiliares/caixa-associada)
{% endhint %}

{% tabs %}
{% tab title="Payload" %}
{% code title="Payload" %}

```json
{ 
  "data": {
    "type": "commercial_sales_receipts",   // [OBRIGATÓRIO]
    "attributes": {
      "date": "2020-06-01",       // [OPCIONAL] Data do recibo; por omissão, a data do pedido
      "payment_mechanism": "MO",   // [OPCIONAL] Meios de pagamento aceites: "MO": Numerário, "CH": Cheque, "DC": Cartão de débito, "CC": Cartão de crédito, "TR": Transferência bancária, "DDA": Débito direto autorizado, "MB": Referências de pagamento Multibanco.
                    
      "document_series_id": <id do documento de série>, // [OPCIONAL] Série de recibos associada. Não precisa de ser indicada; por omissão o recibo é criado na série por omissão associada ao tipo de documento. Vd. Nota 1
      
      "bank_account_id": <id da conta bancária>,// [OPCIONAL] Conta bancária da empresa para onde o recebimento é feito. Usado apenas quando o meio de pagamento é "DC", "CC", "TR" ou "DDA", e apenas se for necessário indicar uma conta bancária específica. Vd. Nota 2

      "cash_account_id": <id da caixa> // [OPCIONAL] Conta de caixa da empresa para onde o recebimento é feito. Usado apenas quando o meio de pagamento é "MO", e apenas se for necessário indicar uma conta de caixa específica. Vd. Nota3
    }

  }
}
```

{% endcode %}
{% endtab %}

{% tab title="Response" %}

```json
{
    "data": {
        "type": "commercial_sales_receipts",
        "id": "6",
        "attributes": {
            "date": "2020-06-01",
            "document_no": "RC 2023/5",
            "document_series_id": 66,
            "payment_mechanism": "MO",
            "gross_total": 0,
            "net_total": 0,
            "third_party_type": "",
            "third_party_id": null,
            "check_number": null,
            "currency_conversion_rate": 1,
            "internal_observations": null,
            "observations": null,
            "standalone": null,
            "saft_import_id": null,
            "deleted": false,
            "manual_registration_type": null,
            "manual_registration_series": null,
            "manual_registration_number": null,
            "created_at": "2024-02-26 11:31:37.827953",
            "updated_at": "2024-02-26 11:31:37.827953"
        },
        "relationships": {
            "bank_accounts": {
                "data": null
            },
            "cash_accounts": {
                "data": null
            },
            "commercial_document_series": {
                "data": {
                    "type": "commercial_document_series",
                    "id": "66"
                }
            },
            "company": {
                "data": {
                    "type": "current_company",
                    "id": "800000046"
                }
            },
            "country": {
                "data": null
            },
            "currency": {
                "data": null
            },
            "customer": {
                "data": null
            },
            "lines": {
                "data": []
            },
            "user": {
                "data": {
                    "type": "current_company_users",
                    "id": "800000863"
                }
            }
        }
    }
}
```

{% endtab %}
{% endtabs %}

{% hint style="warning" %}
Após criar o cabeçalho, a resposta TEM QUE ser consultada para obtenção do identificador interno ("id") do recibo criado. Este identificador será necessário para a criação de todas as linhas.
{% endhint %}

{% hint style="warning" %}
Quando um documento é finalizado este vai gerar um número do documento com a estrutura \[TIPO ANO/NUMERO] através deste poderá executar um filtro nos documentos de série para encontrar o seu documento.
{% endhint %}

{% hint style="info" %}
**Nota 1:** A série associada ao recibo tem já que existir, e o seu "id" interno deve ser obtido por um

{% code overflow="wrap" %}

```
GET /commercial_document_series?filter[document_type]=o tipo de documento> &filter[prefix]=<o prefixo da série>&filter[number]=<o numero da série>
```

{% endcode %}
{% endhint %}

{% hint style="info" %}
**Nota 2:** O "id" interno da conta bancária da empresa deve ser obtido por um

```
GET /company_bank_accounts?filter[iban]= <IBAN da conta> 
ou 
GET /company_bank_accounts?filter[name]= <nome da conta> 
```

{% endhint %}

{% hint style="info" %}
**Nota 3:** O "id" interno da conta de caixa da empresa deve ser obtido por um

```
GET /cash_accounts?filter[name]= <nome da conta>
```

{% endhint %}

### 2. Criar Linha do Documento de Venda:

Os detalhes do pedido POST para a criação de recibos estão descritos de seguida, em formato OpenAPI, e em cURL.

{% openapi src="/files/LrXEg3IjIacAycCz7IWE" path="/api/commercial\_sales\_receipt\_lines" method="post" %}
[TOConline Open API.yaml](https://1863668386-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fk7sif7BY0rPzivMcj1HB%2Fuploads%2Fgit-blob-1f7bd9dd692716d3f3f93d9c9a4f7226d78277e3%2FTOConline%20Open%20API.yaml?alt=media)
{% endopenapi %}

{% code overflow="wrap" %}

```bash
curl -v -X POST -H 'Content-Type: application/vnd.api+json' -H 'Accept: application/json' -H 'Authorization: Bearer <access_token>' -d '<payload JSON>' '<API_URL>/commercial_sales_receipt_lines'
```

{% endcode %}

No pedido acima, o \<access\_token> corresponde ao token de acesso válido devolvido pelo serviço de OAuth, e o \<payload JSON> deverá ter o seguinte formato

{% code title="Payload" %}

```json
{
  "data": {
    "type": "commercial_sales_receipt_lines",                     // [OBRIGATÓRIO]
    "attributes": {
      "receivable_type": "Document",                              // [OBRIGATÓRIO]
      "receivable_id": "<id do documento a liquidar>",            // [OBRIGATÓRIO] Vd. Nota 1
      "received_value": 50,                                       // [OBRIGATÓRIO] Valor total a receber (não é necessário receber a totalidade do documento, pode fazer-se um recebimento parcial)
      "settlement_percentage": "3"                                // [OPCIONAL] Desconto de pagamento, em percentagem; são suportados descontos compostos, como "3+5"
      "receipt_id" : "<id do recibo>"                            // [OBRIGATÓRIO] Recibo a que esta linha pertence. Este "id" é o devolvido na resposta ao pedido de criação do cabeçalho, ver acima
    }
  }
}
```

{% endcode %}

{% hint style="info" %}
**Nota 1:** O "id" interno do documento (fatura, nota) a receber deve ser obtido por um\\

{% code overflow="wrap" %}

```
GET /commercial_sales_documents?filter[document_no]=<o número do documento, ex. FT 2020/1>
```

{% endcode %}
{% endhint %}

### 3. Anular Recibo de Venda

Os detalhes do pedido POST para a criação de recibos estão descritos de seguida, em formato OpenAPI, e em cURL.

{% openapi src="/files/LrXEg3IjIacAycCz7IWE" path="/api/v1/commercial\_sales\_receipts/{salesReceiptId}/void" method="patch" %}
[TOConline Open API.yaml](https://1863668386-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fk7sif7BY0rPzivMcj1HB%2Fuploads%2Fgit-blob-1f7bd9dd692716d3f3f93d9c9a4f7226d78277e3%2FTOConline%20Open%20API.yaml?alt=media)
{% endopenapi %}

{% code overflow="wrap" %}

```bash
curl -v -X PATCH -H 'Content-Type: application/vnd.api+json' -H 'Accept: application/json' -H 'Authorization: Bearer <access_token>' -d '<payload JSON>' '<API_URL>/commercial_sales_receipts/'
```

{% endcode %}

No pedido acima, o \<access\_token> corresponde ao token de acesso válido devolvido pelo serviço de OAuth, e o \<payload JSON> deverá ter o seguinte formato

{% tabs %}
{% tab title="Payload" %}

```json
{
    "data": {
        "type": "commercial_sales_receipts",
        "id": "3", //id do recibo de venda pretendido
        "attributes": {
            "deleted": true
        }
    }
}
```

{% endtab %}

{% tab title="Response" %}

```json
{
    "data": {
        "type": "commercial_sales_receipts",
        "id": "3",
        "attributes": {
            "date": "2020-06-01",
            "document_no": "RC 2023/2",
            "document_series_id": 66,
            "payment_mechanism": "MO",
            "gross_total": 0,
            "net_total": 0,
            "third_party_type": null,
            "third_party_id": null,
            "check_number": null,
            "currency_conversion_rate": 1,
            "internal_observations": null,
            "observations": null,
            "standalone": null,
            "saft_import_id": null,
            "deleted": true,
            "manual_registration_type": null,
            "manual_registration_series": null,
            "manual_registration_number": null,
            "created_at": "2024-02-23 15:34:36.778593",
            "updated_at": "2024-02-27 12:52:10.462666"
        },
        "relationships": {
            "bank_accounts": {
                "data": null
            },
            "cash_accounts": {
                "data": null
            },
            "commercial_document_series": {
                "data": {
                    "type": "commercial_document_series",
                    "id": "66"
                }
            },
            "company": {
                "data": {
                    "type": "current_company",
                    "id": "800000046"
                }
            },
            "country": {
                "data": null
            },
            "currency": {
                "data": null
            },
            "customer": {
                "data": null
            },
            "lines": {
                "data": []
            },
            "user": {
                "data": {
                    "type": "current_company_users",
                    "id": "800000863"
                }
            }
        }
    }
}
```

{% endtab %}
{% endtabs %}

{% hint style="info" %}
**Nota 1:** O "id" interno do recibo a anular pode ser obtido por um

{% code overflow="wrap" %}

```
GET /commercial_sales_receipts?filter[document_no]=<o número do recibo, ex. RC 2020/1>
```

{% endcode %}
{% endhint %}

{% hint style="success" %}
É na linha do recibo que se indica qual o documento (FT, ou outro) que foi pago.

Se necessário, pode criar-se mais do que uma linha (e nesse caso o recibo é emitido de uma só vez para todos os documentos referenciados)
{% endhint %}


# Compras

{% content-ref url="/pages/xe47cKgEVElYgK9onJdl" %}
[Documentos de Compra](/apis/versoes-anteriores/compras/documentos-de-compra)
{% endcontent-ref %}

{% content-ref url="/pages/RNE0kX2RB9TfOauILipr" %}
[Pagamentos](/apis/versoes-anteriores/compras/pagamentos)
{% endcontent-ref %}

##


# Documentos de Compra

## Criação de Documentos de Compra

Para a criação de compras no sistema, é necessário seguir dois passos principais: a criação do cabeçalho e a inserção de uma ou mais linhas correspondentes aos itens adquiridos.

1. **Cabeçalho da Compra**: O cabeçalho contém informações gerais sobre a compra, como data, fornecedor e condições de pagamento.
2. **Linhas da Compra**: Cada linha detalha um item específico comprado, incluindo a descrição, quantidade e preço.
3. **Finalização de Documento de Compra**

### 1. Criar Cabeçalho de Documentos de Compra

De modo a criar uma compra, deverá inicialmente criar o cabeçalho do documento. Para este efeito, deverá realizar o seguinte pedido:

{% openapi src="/files/LrXEg3IjIacAycCz7IWE" path="/api/commercial\_sales\_document\_lines" method="post" %}
[TOConline Open API.yaml](https://1863668386-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fk7sif7BY0rPzivMcj1HB%2Fuploads%2Fgit-blob-1f7bd9dd692716d3f3f93d9c9a4f7226d78277e3%2FTOConline%20Open%20API.yaml?alt=media)
{% endopenapi %}

No pedido acima, o \<access\_token> corresponde ao token de acesso válido devolvido pelo serviço de OAuth

Caso a compra seja realizada em euros, o \<payload JSON> deverá vir de acordo com os exemplos seguintes:

#### 1.1 Criar Cabeçalho de Documento de Venda para uma Nova Empresa

```json

{
  "data": {
    "type": "commercial_purchases_documents",
    "attributes": {
      "document_type": "FC", //[OBRIGATÓRIO] Pode ser FC (fatura de compra), NCF (nota de crédito), NDF (nota de débito), DSP (fatura de despesaa)
      "date": "2020-05-25", // Por omissão, a data de hoje
      "due_date": "2020-05-25", // Por omissão, a data do documento
      "currency_conversion_rate": 0.813 // Obrigatório quando a moeda não é EUR. Taxa de conversão da moeda para EUR (1 EUR = x)
      "supplier_tax_registration_number": "888888880", // Por omissão, o fornecedor indiferenciado (999999990)
      
      //**** Para uma empresa que já existe
      "company_id": 2,

      //id da moeda usada
      "currency_id" :2
      
      //id de um fornecedor
      "supplier_id": 2,
      
      // Indicar o atributo seguinte, com o valor true, apenas se os preços indicados nas linhas forem preços com IVA incluído
      "external_reference": "Texto livre, referente ao campo Vossa Ref.", //
      "vat_included_prices": true,
      // Indicar o atributo seguinte apenas se existir desconto de cabeçalho (7,5%, neste exemplo)
      "settlement_expression": "7.5",
      // Indicar o atributo seguinte apenas se existir retenção (10€, neste exemplo)
      "retention_total": 10
      
      // Associação à série de documentos. Pode ser omitida, se for para usar a série por omissão
     "commercial_document_series_id": "<id da série de documentos associada>" // Este id pode ser obtido por um GET /commercial_document_series?filter[document_type]=FC|NCF|...&filter[prefix]=2020|ou outro qualquer...
    }
  }
}
```

{% hint style="warning" %}
Após criar o cabeçalho, a resposta TEM QUE ser consultada para obtenção do identificador interno ("id") da compra criada. Este identificador será necessário para a criação de todas as linhas.
{% endhint %}

#### 1.2 Criar Cabeçalho de Documento de Venda para uma Empresa Existente

```json
{
  "data": {
    "type": "commercial_purchases_documents",
    "attributes": {
      "document_type": "FC", //[OBRIGATÓRIO] Pode ser FC (fatura de compra), NCF (nota de crédito), NDF (nota de débito), DSP (fatura de despesaa)
      "date": "2020-05-25", // Por omissão, a data de hoje
      "due_date": "2020-05-25", // Por omissão, a data do documento
      "currency_conversion_rate": 0.813 // Obrigatório quando a moeda não é EUR. Taxa de conversão da moeda para EUR (1 EUR = x)
      "supplier_tax_registration_number": "888888880", // Por omissão, o fornecedor indiferenciado (999999990)

      //**** Para uma empresa que já existe
      "company_id": 2,
      
      // Indicar o atributo seguinte, com o valor true, apenas se os preços indicados nas linhas forem preços com IVA incluído
      "external_reference": "Texto livre, referente ao campo Vossa Ref.", //
      "vat_included_prices": true,
      // Indicar o atributo seguinte apenas se existir desconto de cabeçalho (7,5%, neste exemplo)
      "settlement_expression": "7.5",
      // Indicar o atributo seguinte apenas se existir retenção (10€, neste exemplo)
      "retention_total": 10
      
      // Associação à série de documentos. Pode ser omitida, se for para usar a série por omissão
     "commercial_document_series_id": "<id da série de documentos associada>" // Este id pode ser obtido por um GET /commercial_document_series?filter[document_type]=FC|NCF|...&filter[prefix]=2020|ou outro qualquer...
    }
  }
}
```

### 2. Criar Linhas de Documentos de Compra

Em todos os pedidos seguintes, é necessário saber qual o id do documento de compra. Este id pode ser guardado a partir da resposta (JSON) ao pedido de criação anterior, ou pode ser consultado via API. Via API, o id do documento pode ser obtido por um filtro a todos os Documentos de Compra usando o número do documento (finalizado).

{% code overflow="wrap" %}

```
GET /commercial_purchases_documents?filter[document_no]=<número do documento, ex: FC 2020/1> 
```

{% endcode %}

Se o documento ainda não estiver finalizado (fechado), então ainda não tem número atribuído, e o GET anterior não poderá ser feito! Em alternativa pode realizado um filtro a todos os Documentos de Compra usando o estado do documento e número de registro fiscal do fornecedor.

{% code overflow="wrap" %}

```
GET /commercial_purchases_documents?filter[status]=0&filter[supplier_tax_registration_number]=<número de registro fiscal do fornecedor>
```

{% endcode %}

De modo a inserir linhas na compra criada, deverá realizar o seguinte pedido

{% openapi src="/files/LrXEg3IjIacAycCz7IWE" path="/api/commercial\_purchases\_payment\_lines" method="post" %}
[TOConline Open API.yaml](https://1863668386-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fk7sif7BY0rPzivMcj1HB%2Fuploads%2Fgit-blob-1f7bd9dd692716d3f3f93d9c9a4f7226d78277e3%2FTOConline%20Open%20API.yaml?alt=media)
{% endopenapi %}

No pedido acima, o \<access\_token> corresponde ao token de acesso válido devolvido pelo serviço de OAuth. O payload JSON deverá vir no seguinte formato, dependendo se se trata de um produto, ou categoria de despesa.

{% hint style="warning" %}
Nos documentos de despesas (tipo de documento DSP), só são aceites linhas de Categorias de Despesa, não de Produtos.
{% endhint %}

#### 2.1 Criar Linha para Produto

```json
{
  "data": {
    "type": "commercial_purchases_document_lines",
    "attributes": {
      "quantity": 1,
      "unit_price": 20,
      "item_type": "Product",
      "item_code": "PTEST", // NOTA: já tem que existir o produto com este código
      // Indicar o atributo seguinte apenas se existir desconto de linha (3%, neste exemplo)
      "settlement_expression":"3",
      "document_id": 2, // Associação ao documento de compra
      "tax_id":1  // O id da taxa de IVA pode ser obtido por um GET /taxes?filter[tax_code]=NOR|INT|RED|ISE
    }
  }
}
```

#### 2.2 Criar Linha para Categoria de Despesas

```json
{
  "data": {
    "type": "commercial_purchases_document_lines",
    "attributes": {
      "quantity": 1,
      "unit_price": 20,
      "item_type": "Purchases::ExpenseCategory",
      "item_code": "ETEST", // NOTA: já tem que existir a categoria de despesa com este código
    
      "documet_id": 2,
      "tax_id": 2
    }
  }
}
```

{% hint style="info" %}
Para mais informações acerca de Categorias de Despesa visite a página: [Categorias de Despesa](/apis/apis-auxiliares/categorias-de-despesa)
{% endhint %}

### 3. Finalização de um Documento de Compra

{% openapi src="/files/LrXEg3IjIacAycCz7IWE" path="/api/v1/commercial\_purchases\_documents/{id}/finalize" method="patch" %}
[TOConline Open API.yaml](https://1863668386-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fk7sif7BY0rPzivMcj1HB%2Fuploads%2Fgit-blob-1f7bd9dd692716d3f3f93d9c9a4f7226d78277e3%2FTOConline%20Open%20API.yaml?alt=media)
{% endopenapi %}

{% code title="Payload" %}

```json
{
  "type": "commercial_purchases_documents",
  "id": "<id do documento>",
  "data": {
    "attributes": {
      "status": 1
    }
  }
}
```

{% endcode %}

{% hint style="info" %}
NOTA: o documento e as linhas podem continuar a ser alterados mesmo depois de finalizados (fechados)
{% endhint %}

###

## Alteração de Documento de Compra

### Anulação do Documento de Compra

{% openapi src="/files/LrXEg3IjIacAycCz7IWE" path="/api/v1/commercial\_purchases\_documents/{id}/void" method="patch" %}
[TOConline Open API.yaml](https://1863668386-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fk7sif7BY0rPzivMcj1HB%2Fuploads%2Fgit-blob-1f7bd9dd692716d3f3f93d9c9a4f7226d78277e3%2FTOConline%20Open%20API.yaml?alt=media)
{% endopenapi %}

{% code title="Payload" %}

```json
{
  "data": {
    "type": "commercial_purchases_documents",
    "id": "<id do documento>",
    "attributes": {
      "status": 4,
      "voided_reason": "Texto livre com o motivo pelo qual se está a anular o documento" // Opcional, não precisa de ser indicada
    }
  }
}
```

{% endcode %}

### Obter Todos os Documentos de Compra Finalizados

{% code title="Endpoint" %}

```
{{base_url}}/api/commercial_purchases_documents?filter[status]=1
```

{% endcode %}

***

## Linhas de Documento de Compra

### Remover Linha de Documento

{% openapi src="/files/LrXEg3IjIacAycCz7IWE" path="/api/commercial\_purchases\_payment\_lines" method="delete" %}
[TOConline Open API.yaml](https://1863668386-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fk7sif7BY0rPzivMcj1HB%2Fuploads%2Fgit-blob-1f7bd9dd692716d3f3f93d9c9a4f7226d78277e3%2FTOConline%20Open%20API.yaml?alt=media)
{% endopenapi %}


# Pagamentos

### Criação de pagamentos

Tal como no caso dos recibos, as compras são constituídas por:

1. Um cabeçalho
2. Umas ou mais linhas

### 1. Criação do cabeçalho

De modo a criar uma compra, deverá inicialmente criar o cabeçalho do documento. Para este efeito, deverá realizar o seguinte pedido:

{% openapi src="/files/LrXEg3IjIacAycCz7IWE" path="/api/v1/commercial\_purchases\_payments" method="post" %}
[TOConline Open API.yaml](https://1863668386-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fk7sif7BY0rPzivMcj1HB%2Fuploads%2Fgit-blob-1f7bd9dd692716d3f3f93d9c9a4f7226d78277e3%2FTOConline%20Open%20API.yaml?alt=media)
{% endopenapi %}

No pedido acima, o \<access\_token> corresponde ao token de acesso válido devolvido pelo serviço de OAuth

O \<payload JSON> deverá vir no seguinte formato

```
{
  "data": {
    "type": "commercial_purchases_payments",
    "attributes": {
      "date": "2017-06-01", // Data do pagamento
      "payment_mechanism": "MO|CH|DC|CC|TR|DDA|MB|OU|..." // Por omissão, MO. Modo de pagamento: MO (numerário), CH (cheque), DC (cartão de débito), CC (cartão de crédito), TR (transferência), DDA (débito directo), MB (referência MB), OU (outro)
    },
    "relationships": {
      "commercial_document_series": { // Associação à série de pagamentos. Pode ser omitida, se for para usar a série por omissão
        "data": {
          "type": "commercial_document_series",
          "id": "<id da série de documentos associada>" // Este id pode ser obtido por um GET /commercial_document_series?filter[document_type]=PF&filter[prefix]=2020|ou outro qualquer...
        }
      },
      "bank_accounts": { // SÓ NECESSÁRIO se o meio de pagamento for DC,CC,TR,CH, e se for para indicar uma conta bancária específica. Associação à conta bancária da empresa de onde o pagamento foi feito
        "data": {
          "type": "bank_accounts",
          "id": "<id da conta bancária associada>" // Este id pode ser obtido por um GET /company_bank_accounts?filter[iban]=<IBAN da conta>, ou GET /company_bank_accounts?filter[name]=<nome da conta>
        }
      },
      "cash_accounts": { // SÓ NECESSÁRIO se o meio de pagamento for MO, e se for para indicar uma conta de caixa específica. Associação à conta de caixa da empresa de onde o pagamento foi feito
        "data": {
          "type": "cash_accounts",
          "id": "<id da conta de caixa associada>" // Este id pode ser obtido por um GET /cash_accounts?filter[name]=<nome da conta de caixa>
        }
      }
    }
  }
}
```

Após criar o cabeçalho, a resposta TEM QUE ser consultada para obtenção do identificador interno ("id") da compra criada. Este identificador será necessário para a criação de todas as linhas.

### 2. Criação de Linha de Pagamento

Em todos os pedidos seguintes, é necessário saber qual o id do documento de compra. Este id pode ser guardado a partir da resposta (JSON) ao pedido de criação anterior, ou pode ser consultado via API. Via API, o id do documento pode ser obtido por um

```
GET /commercial_purchases_payments?filter[document_no]=<número do documento,  ex: PF 2020/1> 
```

De modo a inserir linhas na compra criada, deverá realizar o seguinte pedido

{% openapi src="/files/LrXEg3IjIacAycCz7IWE" path="/api/commercial\_purchases\_payment\_lines" method="post" %}
[TOConline Open API.yaml](https://1863668386-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fk7sif7BY0rPzivMcj1HB%2Fuploads%2Fgit-blob-1f7bd9dd692716d3f3f93d9c9a4f7226d78277e3%2FTOConline%20Open%20API.yaml?alt=media)
{% endopenapi %}

No pedido acima, o \<access\_token> corresponde ao token de acesso válido devolvido pelo serviço de OAuth. O payload JSON deverá vir no seguinte formato, dependendo se se trata de um produto, ou categoria de despesa

NOTA: É na linha que se indica qual o documento de compra (FC ou DSP) a pagar. Se necessário, podem criar-se mais do que uma linha (e nesse caso o pagamento é feito de uma só vez para todos os documentos)

#### Linha de pagamento

```json
{
  "data": {
    "type": "commercial_purchases_payment_lines",
    "attributes": {
      "payment_id": "<id do pagamento a que pertence esta linha>", // NOTA: quando a API estiver concluída, isto vai ser também uma "relationship", mas por agora indica-se aqui, nos atributos
      "payable_type": "Purchases::Document",
      "payable_id": "<id do documento de compra a pagar>",
      "paid_value": 50, // Valor total a pagar (não é necessário pagar a totalidade do documento, ou pode pagar-se mais do que um documento)
      // Indicar o atributo seguinte apenas se existir desconto no pagamento (3%, neste exemplo)
      "settlement_percentage": 3
      
      "commercial_purchases_documents_id":"<id do documento de compra a pagar>"
    }
  }
}
```

###


# APIs Auxiliares

{% content-ref url="/pages/PY98RP2z17exLbGLCYCc" %}
[Descritores de Taxa](/apis/apis-auxiliares/descritores-de-taxa)
{% endcontent-ref %}

{% content-ref url="/pages/3yu2k1NvX6q2R4RjtH6R" %}
[Família de Itens](/apis/apis-auxiliares/familia-de-itens)
{% endcontent-ref %}

{% content-ref url="/pages/p0cw5SO18mAR0JkDpdkD" %}
[Países](/apis/apis-auxiliares/paises)
{% endcontent-ref %}

{% content-ref url="/pages/vtriu8NywUBO3BJryam3" %}
[Unidades de Medida](/apis/apis-auxiliares/unidades-de-medida)
{% endcontent-ref %}

{% content-ref url="/pages/iTjgU1sjosBwr5xUnMnI" %}
[Contas Bancárias](/apis/apis-auxiliares/contas-bancarias)
{% endcontent-ref %}

{% content-ref url="/pages/VvqORrFlBc9SAHCjk9MD" %}
[Caixa Associada](/apis/apis-auxiliares/caixa-associada)
{% endcontent-ref %}

{% content-ref url="/pages/ZYyzF4NBWQzlzUeAfiwg" %}
[Unidade Monetária](/apis/apis-auxiliares/unidade-monetaria)
{% endcontent-ref %}

{% content-ref url="/pages/p2rhNJRlvjKaXMm14z8V" %}
[Taxas](/apis/apis-auxiliares/taxas)
{% endcontent-ref %}

{% content-ref url="/pages/Mo5yF3ZDtX5u4MbK5Ekm" %}
[Categorias de Despesa](/apis/apis-auxiliares/categorias-de-despesa)
{% endcontent-ref %}

{% content-ref url="/pages/8LGtjuteDWqv6gNVZuJp" %}
[Documentos de Série](/apis/apis-auxiliares/documentos-de-serie)
{% endcontent-ref %}


# Descritores de Taxa

São concebidos para fornecer uma descrição das diversas taxas que podem ser aplicadas a transações financeiras, produtos ou serviços.

### Obter Todos os Descritores de Taxa

{% openapi src="/files/LrXEg3IjIacAycCz7IWE" path="/api/tax\_descriptors" method="get" %}
[TOConline Open API.yaml](https://1863668386-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fk7sif7BY0rPzivMcj1HB%2Fuploads%2Fgit-blob-1f7bd9dd692716d3f3f93d9c9a4f7226d78277e3%2FTOConline%20Open%20API.yaml?alt=media)
{% endopenapi %}

### Criar Descritores

{% openapi src="/files/LrXEg3IjIacAycCz7IWE" path="/api/tax\_descriptors" method="post" %}
[TOConline Open API.yaml](https://1863668386-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fk7sif7BY0rPzivMcj1HB%2Fuploads%2Fgit-blob-1f7bd9dd692716d3f3f93d9c9a4f7226d78277e3%2FTOConline%20Open%20API.yaml?alt=media)
{% endopenapi %}


# Família de Itens

As famílias de itens organizam produtos ou serviços similares, melhorando a gestão de inventário e a eficiência em contabilidade, relatórios e vendas.

### Criar Famílias de Item

{% openapi src="/files/LrXEg3IjIacAycCz7IWE" path="/api/item\_families" method="post" %}
[TOConline Open API.yaml](https://1863668386-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fk7sif7BY0rPzivMcj1HB%2Fuploads%2Fgit-blob-1f7bd9dd692716d3f3f93d9c9a4f7226d78277e3%2FTOConline%20Open%20API.yaml?alt=media)
{% endopenapi %}

###

### Obter Família de Item por Id

{% openapi src="/files/LrXEg3IjIacAycCz7IWE" path="/api/item\_families/{id}" method="get" %}
[TOConline Open API.yaml](https://1863668386-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fk7sif7BY0rPzivMcj1HB%2Fuploads%2Fgit-blob-1f7bd9dd692716d3f3f93d9c9a4f7226d78277e3%2FTOConline%20Open%20API.yaml?alt=media)
{% endopenapi %}

### Remover Família de Item

{% openapi src="/files/LrXEg3IjIacAycCz7IWE" path="/api/item\_families/{id}" method="delete" %}
[TOConline Open API.yaml](https://1863668386-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fk7sif7BY0rPzivMcj1HB%2Fuploads%2Fgit-blob-1f7bd9dd692716d3f3f93d9c9a4f7226d78277e3%2FTOConline%20Open%20API.yaml?alt=media)
{% endopenapi %}

### Obter Todas as Famílias de Item

{% openapi src="/files/LrXEg3IjIacAycCz7IWE" path="/api/item\_families" method="get" %}
[TOConline Open API.yaml](https://1863668386-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fk7sif7BY0rPzivMcj1HB%2Fuploads%2Fgit-blob-1f7bd9dd692716d3f3f93d9c9a4f7226d78277e3%2FTOConline%20Open%20API.yaml?alt=media)
{% endopenapi %}


# Países

Descubra detalhes sobre países, como nome e códigos ISO, ideal para gestão de endereçamentos. Suporta consultas por ID ou código.

### Obter Todos os Países

{% openapi src="/files/LrXEg3IjIacAycCz7IWE" path="/api/countries" method="get" %}
[TOConline Open API.yaml](https://1863668386-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fk7sif7BY0rPzivMcj1HB%2Fuploads%2Fgit-blob-1f7bd9dd692716d3f3f93d9c9a4f7226d78277e3%2FTOConline%20Open%20API.yaml?alt=media)
{% endopenapi %}

{% code title="GET" %}

```
https://api/v1.toconline.com/api/coutries
```

{% endcode %}

<details>

<summary>Exemplo de Response</summary>

```json
{
    "data": [
        {
            "type": "countries",
            "id": "1",
            "attributes": {
                "default_name": "Portugal - Continente",
                "iso_alpha_2": "PT",
                "iso_alpha_3": "PRT",
                "tax_country_region": "PT"
            }
        },
        {
            "type": "countries",
            "id": "2",
            "attributes": {
                "default_name": "Portugal - Madeira",
                "iso_alpha_2": "PT-MA",
                "iso_alpha_3": "PRT",
                "tax_country_region": "PT-MA"
            }
        },
        (...)
        ]
    }
}
```

</details>

### Obter País por Código de País

{% code title="Endpoint" %}

```
https://api/v1.toconline.com/api/coutries?filter[iso_alpha_2]=<Código de País>
```

{% endcode %}

{% tabs %}
{% tab title="Endpoint" %}
{% code title="Endpooint " overflow="wrap" %}

```
https://api/v1.toconline.com/api/coutries?filter[iso_alpha_2]=PT
```

{% endcode %}
{% endtab %}

{% tab title="Response" %}

```json
{
    "data": [
        {
            "type": "countries",
            "id": "1",
            "attributes": {
                "default_name": "Portugal - Continente",
                "iso_alpha_2": "PT",
                "iso_alpha_3": "PRT",
                "tax_country_region": "PT"
            }
        }
    ]
}
```

{% endtab %}
{% endtabs %}

{% hint style="info" %}

```
<Código de País>  => "iso_alpha_2"
```

{% endhint %}

### Obter Todos os Países OSS

{% openapi src="/files/LrXEg3IjIacAycCz7IWE" path="/api/oss\_countries" method="get" %}
[TOConline Open API.yaml](https://1863668386-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fk7sif7BY0rPzivMcj1HB%2Fuploads%2Fgit-blob-1f7bd9dd692716d3f3f93d9c9a4f7226d78277e3%2FTOConline%20Open%20API.yaml?alt=media)
{% endopenapi %}

{% code title="GET" %}

```
https://api/v1.toconline.com/api/coutries
```

{% endcode %}

<details>

<summary>Exemplo de Response</summary>

```json
{
    "data": [
        {
            "type": "countries",
            "id": "1",
            "attributes": {
                "default_name": "Portugal - Continente",
                "iso_alpha_2": "PT",
                "iso_alpha_3": "PRT",
                "tax_country_region": "PT"
            }
        },
        {
            "type": "countries",
            "id": "2",
            "attributes": {
                "default_name": "Portugal - Madeira",
                "iso_alpha_2": "PT-MA",
                "iso_alpha_3": "PRT",
                "tax_country_region": "PT-MA"
            }
        },
        (...)
        ]
    }
}
```

</details>


# Unidades de Medida

Página dedicada a instruir sobre a criação, edição e remoção de unidades de medida.

### Criar Unidade de Medida

{% openapi src="/files/LrXEg3IjIacAycCz7IWE" path="/api/units\_of\_measure" method="post" %}
[TOConline Open API.yaml](https://1863668386-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fk7sif7BY0rPzivMcj1HB%2Fuploads%2Fgit-blob-1f7bd9dd692716d3f3f93d9c9a4f7226d78277e3%2FTOConline%20Open%20API.yaml?alt=media)
{% endopenapi %}

{% tabs %}
{% tab title="Payload" %}
{% code title="Payload" %}

```json
{
    "data": {
        "type": "units_of_measure",
        "attributes": {
            "unit_of_measure": "Anos de Luz",
            "is_default": false
        }
    }
}

```

{% endcode %}
{% endtab %}

{% tab title="Response" %}
{% code title="Response" %}

```json
{
    "data": {
        "type": "units_of_measure",
        "id": "9",
        "attributes": {
            "unit_of_measure": "Anos de Luz",
            "is_default": false
        },
        "relationships": {
            "company": {
                "data": {
                    "type": "current_company",
                    "id": "800000046"
                }
            }
        }
    }
}
```

{% endcode %}
{% endtab %}
{% endtabs %}

###

### Obter Todas as Unidade de Medida

{% openapi src="/files/LrXEg3IjIacAycCz7IWE" path="/api/units\_of\_measure" method="get" %}
[TOConline Open API.yaml](https://1863668386-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fk7sif7BY0rPzivMcj1HB%2Fuploads%2Fgit-blob-1f7bd9dd692716d3f3f93d9c9a4f7226d78277e3%2FTOConline%20Open%20API.yaml?alt=media)
{% endopenapi %}

{% code title="GET" %}

```
https://api/v1.toconline.com/api/units_of_measure
```

{% endcode %}

<details>

<summary>Exemplo de Response</summary>

```json
{
    "data": [
        {
            "type": "units_of_measure",
            "id": "6",
            "attributes": {
                "unit_of_measure": "horas",
                "is_default": false
            },
            "relationships": {
                "company": {
                    "data": {
                        "type": "current_company",
                        "id": "800000046"
                    }
                }
            }
        },
        {
            "type": "units_of_measure",
            "id": "5",
            "attributes": {
                "unit_of_measure": "Kg",
                "is_default": false
            },
            "relationships": {
                "company": {
                    "data": {
                        "type": "current_company",
                        "id": "800000046"
                    }
                }
            }
        },
        {
            "type": "units_of_measure",
            "id": "4",
            "attributes": {
                "unit_of_measure": "Lt",
                "is_default": false
            },
            "relationships": {
                "company": {
                    "data": {
                        "type": "current_company",
                        "id": "800000046"
                    }
                }
            }
        },
        {
            "type": "units_of_measure",
            "id": "3",
            "attributes": {
                "unit_of_measure": "m",
                "is_default": false
            },
            "relationships": {
                "company": {
                    "data": {
                        "type": "current_company",
                        "id": "800000046"
                    }
                }
            }
        },
        {
            "type": "units_of_measure",
            "id": "2",
            "attributes": {
                "unit_of_measure": "un",
                "is_default": true
            },
            "relationships": {
                "company": {
                    "data": {
                        "type": "current_company",
                        "id": "800000046"
                    }
                }
            }
        },
        {
            "type": "units_of_measure",
            "id": "9",
            "attributes": {
                "unit_of_measure": "Anos de Luz",
                "is_default": false
            },
            "relationships": {
                "company": {
                    "data": {
                        "type": "current_company",
                        "id": "800000046"
                    }
                }
            }
        }
    ]
}
```

</details>

###

### Remover Unidades de Medida

{% openapi src="/files/LrXEg3IjIacAycCz7IWE" path="/api/units\_of\_measure/{unitsOfMeasureId}" method="delete" %}
[TOConline Open API.yaml](https://1863668386-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fk7sif7BY0rPzivMcj1HB%2Fuploads%2Fgit-blob-1f7bd9dd692716d3f3f93d9c9a4f7226d78277e3%2FTOConline%20Open%20API.yaml?alt=media)
{% endopenapi %}

{% code title="DELETE" %}

```
https://api/v1.toconline.com/api/units_of_measure/{id}
```

{% endcode %}

<details>

<summary>Exemplo de Response</summary>

```json
{
    "meta": {}
}
```

</details>


# Contas Bancárias

### Obter Todas as Contas Bancárias

{% openapi src="/files/LrXEg3IjIacAycCz7IWE" path="/api/bank\_accounts" method="get" %}
[TOConline Open API.yaml](https://1863668386-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fk7sif7BY0rPzivMcj1HB%2Fuploads%2Fgit-blob-1f7bd9dd692716d3f3f93d9c9a4f7226d78277e3%2FTOConline%20Open%20API.yaml?alt=media)
{% endopenapi %}

<details>

<summary>Exemplo de Response</summary>

```json
{
    "data": [
        {
            "type": "bank_accounts",
            "id": "2",
            "attributes": {
                "entity_type": "User",
                "description": null,
                "name": "BANCO BPI, SA",
                "nib": "001049282327079673218",
                "swift": "BBPIPTPL",
                "iban": "PT50001049282327079673218",
                "initial_balance": null,
                "sub_type": "ticket_account",
                "card_number": "",
                "account_type": "DO",
                "only_one_payment": null,
                "is_connected": false,
                "consent_until": null
            },
            "relationships": {
                "supplier": {
                    "data": null
                },
                "user": {
                    "data": {
                        "type": "current_company_users",
                        "id": "800000863"
                    }
                }
            }
        },
        
        (...)
    
    ]
}
```

</details>

### Obter Contas Bancária por ID

{% openapi src="/files/LrXEg3IjIacAycCz7IWE" path="/api/bank\_accounts/{bankAccountId}" method="get" %}
[TOConline Open API.yaml](https://1863668386-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fk7sif7BY0rPzivMcj1HB%2Fuploads%2Fgit-blob-1f7bd9dd692716d3f3f93d9c9a4f7226d78277e3%2FTOConline%20Open%20API.yaml?alt=media)
{% endopenapi %}

### Criar Conta Bancária

{% openapi src="/files/LrXEg3IjIacAycCz7IWE" path="/api/bank\_accounts" method="post" %}
[TOConline Open API.yaml](https://1863668386-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fk7sif7BY0rPzivMcj1HB%2Fuploads%2Fgit-blob-1f7bd9dd692716d3f3f93d9c9a4f7226d78277e3%2FTOConline%20Open%20API.yaml?alt=media)
{% endopenapi %}

### Remover Conta Bancária

{% openapi src="/files/LrXEg3IjIacAycCz7IWE" path="/api/bank\_accounts/{bankAccountId}" method="delete" %}
[TOConline Open API.yaml](https://1863668386-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fk7sif7BY0rPzivMcj1HB%2Fuploads%2Fgit-blob-1f7bd9dd692716d3f3f93d9c9a4f7226d78277e3%2FTOConline%20Open%20API.yaml?alt=media)
{% endopenapi %}


# Caixa Associada

### Obter Todas as Caixas Associadas

De modo a obter informações sobre um dado descritor, poderá realizar o seguinte pedido

{% openapi src="/files/LrXEg3IjIacAycCz7IWE" path="/api/cash\_accounts" method="get" %}
[TOConline Open API.yaml](https://1863668386-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fk7sif7BY0rPzivMcj1HB%2Fuploads%2Fgit-blob-1f7bd9dd692716d3f3f93d9c9a4f7226d78277e3%2FTOConline%20Open%20API.yaml?alt=media)
{% endopenapi %}

<details>

<summary>Exemplo de Response</summary>

```json
{
    "data": [
        {
            "type": "cash_accounts",
            "id": "2",
            "attributes": {
                "name": "Caixa Teste 1"
            },
            "relationships": {
                "company": {
                    "data": {
                        "type": "current_company",
                        "id": "800000046"
                    }
                }
            }
        }
    ]
}
```

</details>

### Obter Caixas Associadas por ID

{% openapi src="/files/LrXEg3IjIacAycCz7IWE" path="/api/cash\_accounts/{id}" method="get" %}
[TOConline Open API.yaml](https://1863668386-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fk7sif7BY0rPzivMcj1HB%2Fuploads%2Fgit-blob-1f7bd9dd692716d3f3f93d9c9a4f7226d78277e3%2FTOConline%20Open%20API.yaml?alt=media)
{% endopenapi %}

{% tabs %}
{% tab title="Endpoint" %}

```
GET /api/bank_accounts/2
```

{% endtab %}

{% tab title="Response" %}

```json
{
    "data": {
        "type": "bank_accounts",
        "id": "2",
        "attributes": {
            "entity_type": "User",
            "description": null,
            "name": "BANCO BPI, SA",
            "nib": "001049282327079673218",
            "swift": "BBPIPTPL",
            "iban": "PT50001049282327079673218",
            "initial_balance": null,
            "sub_type": "ticket_account",
            "card_number": "",
            "account_type": "DO",
            "only_one_payment": null,
            "is_connected": false,
            "consent_until": null
        },
        "relationships": {
            "supplier": {
                "data": null
            },
            "user": {
                "data": {
                    "type": "current_company_users",
                    "id": "800000863"
                }
            }
        }
    }
}
```

{% endtab %}
{% endtabs %}

### Criar Caixas Associadas

{% openapi src="/files/LrXEg3IjIacAycCz7IWE" path="/api/cash\_accounts" method="post" %}
[TOConline Open API.yaml](https://1863668386-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fk7sif7BY0rPzivMcj1HB%2Fuploads%2Fgit-blob-1f7bd9dd692716d3f3f93d9c9a4f7226d78277e3%2FTOConline%20Open%20API.yaml?alt=media)
{% endopenapi %}

### Remover Caixas Associadas

{% openapi src="/files/LrXEg3IjIacAycCz7IWE" path="/api/bank\_accounts/{bankAccountId}" method="delete" %}
[TOConline Open API.yaml](https://1863668386-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fk7sif7BY0rPzivMcj1HB%2Fuploads%2Fgit-blob-1f7bd9dd692716d3f3f93d9c9a4f7226d78277e3%2FTOConline%20Open%20API.yaml?alt=media)
{% endopenapi %}


# Unidade Monetária

Utilizando a API da Unidade Monetária, é possível identificar a moeda utilizada em cada país.

### Obter Todas as Unidades Monetárias

{% openapi src="/files/LrXEg3IjIacAycCz7IWE" path="/api/currencies" method="get" %}
[TOConline Open API.yaml](https://1863668386-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fk7sif7BY0rPzivMcj1HB%2Fuploads%2Fgit-blob-1f7bd9dd692716d3f3f93d9c9a4f7226d78277e3%2FTOConline%20Open%20API.yaml?alt=media)
{% endopenapi %}

### Obter Unidade Monetária por Id

{% openapi src="/files/LrXEg3IjIacAycCz7IWE" path="/api/currencies/{currencyId}" method="get" %}
[TOConline Open API.yaml](https://1863668386-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fk7sif7BY0rPzivMcj1HB%2Fuploads%2Fgit-blob-1f7bd9dd692716d3f3f93d9c9a4f7226d78277e3%2FTOConline%20Open%20API.yaml?alt=media)
{% endopenapi %}


# Taxas

APIs de taxas fornecem dados de impostos para integrar em sistemas, facilitando cálculos e conformidade legal.

### Obter Todas as Taxas

{% openapi src="/files/LrXEg3IjIacAycCz7IWE" path="/api/taxes" method="get" %}
[TOConline Open API.yaml](https://1863668386-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fk7sif7BY0rPzivMcj1HB%2Fuploads%2Fgit-blob-1f7bd9dd692716d3f3f93d9c9a4f7226d78277e3%2FTOConline%20Open%20API.yaml?alt=media)
{% endopenapi %}

### Filtro por Código de Taxa e pelo Código da Região

{% code title="Endpoint" overflow="wrap" %}

```
GET /taxes?filter[tax_code]=<código de Taxa> &filter[tax_country_region]=<código da região> 
```

{% endcode %}

**Exemplo:**

{% tabs %}
{% tab title="Endpoint" %}
{% code title="Exemplo de Endpoint" %}

```
GET /api/taxes?filter[tax_code]=NOR&filter[tax_country_region]=BE
```

{% endcode %}
{% endtab %}

{% tab title="Response" %}
{% code title="Exemplo de Response" %}

```json
{
    "data": [
        {
            "type": "taxes",
            "id": "103",
            "attributes": {
                "tax_country_region": "BE",
                "tax_code": "NOR",
                "description": "Normal",
                "tax_percentage": "21",
                "tax_expiration_date": null,
                "vat_tax_id": null
            }
        }
    ]
}
```

{% endcode %}
{% endtab %}
{% endtabs %}

### Filtro por Código de Taxa e pela Região e Percentagem de Taxa

{% code title="Endpoint" overflow="wrap" %}

```
GET /taxes?filter[tax_code]=<código de Taxa> &filter[tax_country_region]=<a região do IVA>&filter[tax_percentage]=<a percentagem de taxa>
```

{% endcode %}

**Exemplo:**

{% tabs %}
{% tab title="Endpoint" %}
{% code title="Exemplo de Endpoint" overflow="wrap" %}

```
{{base_url}}/api/taxes?filter[tax_code]=NOR&filter[tax_country_region]=BE&filter[tax_percentage]=21
```

{% endcode %}
{% endtab %}

{% tab title="Response" %}
{% code title="Exemplo de Response" %}

```json
{
    "data": [
        {
            "type": "taxes",
            "id": "103",
            "attributes": {
                "tax_country_region": "BE",
                "tax_code": "NOR",
                "description": "Normal",
                "tax_percentage": "21",
                "tax_expiration_date": null,
                "vat_tax_id": null
            }
        }
    ]
}
```

{% endcode %}
{% endtab %}
{% endtabs %}

### Obter Todas as Taxas de OSS (One Stop Shop)

{% openapi src="/files/LrXEg3IjIacAycCz7IWE" path="/api/oss\_taxes" method="get" %}
[TOConline Open API.yaml](https://1863668386-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fk7sif7BY0rPzivMcj1HB%2Fuploads%2Fgit-blob-1f7bd9dd692716d3f3f93d9c9a4f7226d78277e3%2FTOConline%20Open%20API.yaml?alt=media)
{% endopenapi %}


# Categorias de Despesa

### Obter Todas as Categorias de Despesa

{% openapi src="/files/LrXEg3IjIacAycCz7IWE" path="/api/expense\_categories" method="get" %}
[TOConline Open API.yaml](https://1863668386-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fk7sif7BY0rPzivMcj1HB%2Fuploads%2Fgit-blob-1f7bd9dd692716d3f3f93d9c9a4f7226d78277e3%2FTOConline%20Open%20API.yaml?alt=media)
{% endopenapi %}

### Obter Categorias de Despesa por Id

{% openapi src="/files/LrXEg3IjIacAycCz7IWE" path="/api/expense\_categories/{id}" method="get" %}
[TOConline Open API.yaml](https://1863668386-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fk7sif7BY0rPzivMcj1HB%2Fuploads%2Fgit-blob-1f7bd9dd692716d3f3f93d9c9a4f7226d78277e3%2FTOConline%20Open%20API.yaml?alt=media)
{% endopenapi %}


# Documentos de Série

### Obter Todos os Documentos de Série

{% openapi src="/files/LrXEg3IjIacAycCz7IWE" path="/api/commercial\_document\_series" method="get" %}
[TOConline Open API.yaml](https://1863668386-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fk7sif7BY0rPzivMcj1HB%2Fuploads%2Fgit-blob-1f7bd9dd692716d3f3f93d9c9a4f7226d78277e3%2FTOConline%20Open%20API.yaml?alt=media)
{% endopenapi %}

### Obter Documentos de Série com Filtro

{% code title="GET" overflow="wrap" %}

```
{{base_url}}/api/commercial_document_series?filter[document_type]=FT&filter[prefix]=2023&filter[number]=3
```

{% endcode %}


