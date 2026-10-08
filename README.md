# IDS - Sistema de Gestão de Segurança

O projeto começa a substituir o preenchimento manual da planilha IDS por um sistema web com regras no backend. A análise da planilha, fórmulas e decisões pendentes está em [PLANO_DO_SISTEMA.md](PLANO_DO_SISTEMA.md).

## Estado atual

- React, TypeScript, Vite, Tailwind, Recharts e interface responsiva.
- API ASP.NET Core separada em Domain, Application, Infrastructure e API.
- Cálculo diário de IDS no domínio e testes unitários.
- EF Core/PostgreSQL, migration inicial, catálogo de seis categorias, 32 itens e três severidades.
- Login bearer, perfis de acesso, bootstrap de administrador e rate limit no login.
- Cadastro, consulta, edição e envio explícito de avaliações; rascunhos continuam editáveis, avaliações enviadas ficam somente leitura. A lista pode ser filtrada por status, contratada e local e exportada em CSV; cada avaliação também pode ser gerada em PDF.
- Dashboard com totais mensais, proporções por severidade e evolução do IDS por avaliação; a média semanal/mensal continua desabilitada até validar o calendário da planilha.
- Aba **Dados** com filtros de período, local e contratada e consolidação por data, categoria, item e severidade. Agrupamento semanal ainda depende de validação da regra do Excel.
- Aba **Relatório IPF** com entrada manual do IPF mensal, histórico anual e gráfico de valores registrados; a média considera somente os meses preenchidos. O IPF não é calculado pelo sistema porque a planilha não contém essa fórmula. O histórico anual pode ser gerado em PDF.
- Testes HTTP da API para autorização por padrão, health check sem banco e CORS local; teste de aplicação para média anual e gravação mensal de IPF.

Exportação consolidada PDF/Excel, importação histórica, auditoria completa, cálculo mensal final de IDS e validação com avaliações reais do Excel ainda estão pendentes. Não use o sistema para decisões operacionais até validar o IDS mensal e comparar com avaliações preenchidas no Excel.

## Requisitos locais

- Node.js 24 e npm.
- .NET SDK 10 LTS.
- PostgreSQL 16 local ou Docker Compose.
- Ferramentas locais .NET restauradas com `dotnet tool restore` (`dotnet-ef` 10.0.12).

## Iniciar localmente

1. Copie `.env.example` para `.env` e substitua os placeholders por valores aleatórios locais. Não versione `.env`.
2. Inicie somente o banco: `docker compose up -d database`.
3. No PowerShell, configure a conexão para o banco exposto localmente e segredos descartáveis/desenvolvimento:

```powershell
dotnet tool restore
$env:DATABASE_CONNECTION = "Host=localhost;Port=5432;Database=ids;Username=ids_app;Password=<senha-local>"
$env:AUTH_SIGNING_KEY = "<segredo-aleatorio-com-pelo-menos-32-bytes>"
$env:INITIAL_ADMIN_SETUP_KEY = "<segredo-de-uso-unico>"
$env:ALLOWED_ORIGINS = "http://localhost:5173"
```

4. Aplique a migration:

```powershell
dotnet tool restore
dotnet ef database update --project backend/src/IDS.Infrastructure/IDS.Infrastructure.csproj --startup-project backend/src/IDS.Api/IDS.Api.csproj
```

5. Em um terminal com as variáveis acima, inicie a API:

```powershell
dotnet run --project backend/src/IDS.Api/IDS.Api.csproj --urls http://localhost:5141
```

6. Em outro terminal, inicie o frontend:

```powershell
cd frontend
npm ci
npm run dev
```

Acesse `http://localhost:5173`. O Vite encaminha `/api` para `http://localhost:5141`. O endpoint anônimo de prontidão é `GET /api/health/ready`; retorna `503` se o PostgreSQL não estiver acessível.

Os botões **Gerar PDF** abrem a janela de impressão do navegador. Selecione **Salvar como PDF** como destino para baixar ou salvar o documento.

No primeiro acesso, escolha “Primeiro acesso: configurar administrador”, informe a `INITIAL_ADMIN_SETUP_KEY` e crie a primeira conta. A senha deve ter pelo menos 8 caracteres; não há exigência de maiúscula, minúscula, número ou símbolo. A chave de bootstrap é separada da senha e deve corresponder exatamente ao valor configurado na API. O bootstrap só funciona enquanto não houver usuários; guarde a chave fora do repositório e remova-a do ambiente depois do provisionamento. O login usa `POST /api/auth/login` e os demais endpoints exigem bearer token.

### Diagnóstico de acesso

- `GET /api/health/ready` retorna `503` com `database: unavailable` até o PostgreSQL aceitar conexões e as migrations estarem aplicadas.
- `POST /api/auth/login` retorna `503` quando o banco está inacessível; `401` significa credenciais inválidas ou conta bloqueada.
- `POST /api/auth/bootstrap-admin` retorna `401` se `SetupKey` não corresponder exatamente a `INITIAL_ADMIN_SETUP_KEY`; `409` indica que já existem usuários. Uma chave correta com o banco indisponível retorna `503`.
- O frontend local usa `localhost:5173` ou `localhost:5174`; `/favicon.ico` redireciona ao ícone IDS em SVG.

## Dados e relatório IPF

A consolidação de Dados é servida por `GET /api/dashboard/data?from=&to=&siteId=&contractorId=`. O histórico anual de IPF usa `GET /api/reports/ipf/{year}?contractorId=`; perfis `ADMINISTRADOR` e `GESTOR` podem registrar ou substituir um mês com `PUT /api/reports/ipf/{year}/{month}`. Informe o IPF manualmente conforme a fonte aprovada; não há cálculo automático de IPF. A tabela `monthly_ipf_records` é criada pela migration `AddMonthlyIpfHistory`.

## Testes e build

```powershell
dotnet test IDS.sln
dotnet build IDS.sln
cd frontend
npm run lint
npm run build
```

O SQL da migration pode ser inspecionado sem conectar ao banco:

```powershell
dotnet ef migrations script --project backend/src/IDS.Infrastructure/IDS.Infrastructure.csproj --startup-project backend/src/IDS.Api/IDS.Api.csproj
```

## Compose full-stack

Depois de configurar `.env`, o Compose pode iniciar PostgreSQL, API e frontend:

```powershell
docker compose up --build
```

Antes do primeiro login, aplique a migration a partir do host conforme as instruções acima. A URL vazia de `VITE_API_BASE_URL` mantém o proxy `/api` do Nginx para o serviço `api`. O banco é exposto somente em `127.0.0.1` e a API somente na rede Docker. O Compose não configura TLS nem backups: não exponha sua porta HTTP diretamente à Internet.

## Publicação online (Vercel + Render + PostgreSQL gerenciado)

O repositório está preparado para esta arquitetura, mas configurar estes arquivos **não publica o sistema automaticamente**. São necessárias contas nos provedores, permissão para conectar o repositório e configuração dos segredos nos painéis. Os mesmos parâmetros podem ser usados no Netlify, Railway ou Azure; para a API, prefira o Dockerfile quando o provedor não oferecer .NET 10 nativo.

### Variáveis de produção

Configure as variáveis da API no gerenciador de segredos do serviço, nunca no frontend ou em arquivos versionados.

| Serviço | Variável | Valor / finalidade |
| --- | --- | --- |
| Frontend (build) | `VITE_API_BASE_URL` | Origem HTTPS pública da API, por exemplo `https://ids-api.onrender.com`, **sem `/api`**, caminho, query ou credenciais. Vazia somente quando `/api` é encaminhado à API no mesmo domínio. |
| API | `ASPNETCORE_ENVIRONMENT` | `Production`. Não use `Development` em publicação. |
| API | `ASPNETCORE_URLS` | `http://+:8080` no container. Configure o provedor para encaminhar à porta 8080; se exigir outra porta, ajuste também este valor. `EXPOSE` não publica uma porta por si só. |
| API | `DATABASE_CONNECTION` | String Npgsql: `Host=<host>;Port=5432;Database=<banco>;Username=<usuario>;SSL Mode=VerifyFull`, acrescentando o campo `Password` com a senha do banco (`chave=valor`, separado por `;`). Use o host fornecido pelo banco, não `localhost`; instale a CA do provedor se necessário. |
| API | `AUTH_SIGNING_KEY` | Segredo aleatório com pelo menos 32 bytes; obrigatório. Gere, por exemplo, com `openssl rand -base64 48`. Não reutilize a senha do banco. Alterar a chave invalida os tokens existentes. |
| API | `INITIAL_ADMIN_SETUP_KEY` | Outro segredo aleatório, necessário apenas para criar o primeiro administrador. Remova-o após o provisionamento e reinicie/republique a API. |
| API | `AUTH_ISSUER` | Identificador estável do emissor; padrão `IDS.Api`. |
| API | `AUTH_AUDIENCE` | Identificador estável do público dos tokens; padrão `IDS.Frontend`. |
| API | `ALLOWED_ORIGINS` | Origem exata do frontend, por exemplo `https://ids.vercel.app`. Várias origens separadas por vírgula. Sem barra final, caminho ou `*`. Não libere indiscriminadamente domínios de preview. |
| API | `AllowedHosts` | Opcional: hosts aceitos, separados por `;`, sem protocolo/porta. O padrão é `*`; ao restringir, inclua o host usado pelo health check do provedor. Não substitui CORS. |

`VITE_*` é público e incorporado ao JavaScript durante `npm run build`: mudar a variável exige **novo build/deploy**. Não coloque senhas, chaves JWT ou conexão PostgreSQL em variáveis `VITE_*`. `IDS_API_PROXY_TARGET` é apenas uma opção do servidor Vite de desenvolvimento, não define a API do build.

`POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_PORT`, `WEB_PORT` e `API_PORT` do `.env.example` destinam-se ao ambiente local/Compose; em banco gerenciado use as credenciais do provedor em `DATABASE_CONNECTION`. O .NET não carrega `.env` automaticamente, e Compose não transmite todas as variáveis do arquivo à API: somente as declaradas em `environment`.

### 1. Criar o PostgreSQL

1. Crie um PostgreSQL gerenciado (por exemplo Neon, Supabase, Render ou Railway), com usuário dedicado, senha forte, backups e possibilidade de restauração. Use PostgreSQL 16 ou versão compatível.
2. Obtenha os parâmetros de conexão. A API espera formato Npgsql `Host=...;...`, **não** uma URL `postgres://...`; converta os campos fornecidos pelo painel. Caracteres especiais na senha precisam do escape/aspas de uma connection string Npgsql, não de URL encoding.
3. Exija TLS com validação do certificado para conexões externas. Restrinja a rede aos clientes necessários. Para migrations use a conexão direta do banco, não um pooler em modo de transação.
4. Não reutilize o banco de produção nos testes. Antes de atualizações futuras, faça backup e revise o SQL das migrations.

### 2. Aplicar as migrations

Em um terminal confiável com .NET SDK 10, na raiz do repositório:

```bash
dotnet tool restore
export ASPNETCORE_ENVIRONMENT=Production
export DATABASE_CONNECTION='<connection-string-Npgsql-do-provedor>'
export AUTH_SIGNING_KEY='<segredo-configurado-na-API>'
dotnet ef database update --project backend/src/IDS.Infrastructure/IDS.Infrastructure.csproj --startup-project backend/src/IDS.Api/IDS.Api.csproj --configuration Release
```

No PowerShell use `$env:NOME = "valor"` no lugar de `export`. Injete os valores com o gerenciador de segredos; os placeholders acima não são credenciais válidas. Execute em máquina/rede autorizada pelo banco ou em job de release com SDK e acesso ao código. Não execute migrations concorrentes em cada réplica. A imagem runtime da API não inclui SDK nem `dotnet-ef`; não tente rodar esse comando dentro dela.

As migrations criam o esquema e os catálogos; a API **não** aplica migrations automaticamente. O health check retorna `503` enquanto faltar banco ou migration, portanto conclua esta etapa antes de esperar que o serviço fique saudável.

### 3. Publicar a API no Render

1. Crie um **Web Service**, conecte este repositório e selecione a branch a publicar.
2. Escolha runtime **Docker**, contexto de build na raiz (`.`), Dockerfile `backend/Dockerfile`; deixe o comando de inicialização padrão (`dotnet IDS.Api.dll`).
3. Configure todas as variáveis da API da tabela, inclusive `ASPNETCORE_URLS=http://+:8080` e `ALLOWED_ORIGINS` com o domínio reservado para o frontend.
4. Configure o health check para `/api/health/ready` e publique. A imagem usa .NET 10 e usuário não-root. O provedor deve servir a URL pública por HTTPS e encaminhar internamente HTTP para 8080.
5. Confira `https://<host-da-api>/api/health/ready`: deve responder `200` com `status: ready`, `database: available` e `schema: current`. Verifique os logs privados em caso de `503`; detalhes de exceções do banco não são publicados no endpoint.

No Railway, use o mesmo Dockerfile/contexto, gere o domínio HTTPS e configure a porta alvo 8080. Se houver `PORT` obrigatório, defina `ASPNETCORE_URLS` com esse número real: a API não traduz `PORT` automaticamente. No Azure App Service para containers, publique a imagem construída com `docker build -f backend/Dockerfile .` em seu registro, selecione-a no serviço e configure a porta alvo 8080 e as mesmas variáveis.

O TLS é terminado pelo provedor/ingress, não pelo container. Não habilite confiança irrestrita em `X-Forwarded-*` nem exponha a porta interna publicamente. A autenticação bearer atual não depende de cookies ou redirecionamentos HTTPS na API.

### 4. Publicar o frontend no Vercel ou Netlify

**Vercel**

1. Importe o repositório e configure **Root Directory** como `frontend`, preset **Vite**, Node.js **24**.
2. Install command: `npm ci`; build command: `npm run build`; output directory: `dist`.
3. No ambiente **Production**, configure `VITE_API_BASE_URL=https://<host-da-api>`.
4. Publique, copie a origem HTTPS final (ou domínio próprio) para `ALLOWED_ORIGINS` na API e reinicie/republique a API.

**Netlify**

- Base directory: `frontend`; build command: `npm ci && npm run build`; publish directory: `dist` (relativa à base).
- Configure Node.js 24 (`NODE_VERSION=24`) e a mesma `VITE_API_BASE_URL` no ambiente de build.
- Atualize `ALLOWED_ORIGINS` com a origem final do Netlify/domínio próprio.

A aplicação atual usa abas, sem roteamento por caminhos no navegador; não é necessário rewrite de SPA para este fluxo. Para hospedar frontend e API sob a mesma origem, deixe `VITE_API_BASE_URL` vazia e configure seu ingress para encaminhar `/api/*` à API, sem remover o prefixo `/api`. Não use `vite preview` como servidor de produção.

Alternativamente, para hospedar o frontend como container separado:

```bash
docker build --build-arg VITE_API_BASE_URL=https://<host-da-api> -t ids-frontend ./frontend
docker run --rm -p 8080:80 ids-frontend
```

O Nginx pode servir o frontend sem um container chamado `api` quando a URL pública é usada no build. Seu proxy `/api` continua destinado à rede Docker do Compose.

### 5. Primeiro acesso e verificação final

1. Confirme HTTPS válido no frontend e na API; nunca envie login ou bootstrap por HTTP público.
2. Abra o frontend, use “Primeiro acesso: configurar administrador” com a chave separada e crie a conta. Em seguida remova `INITIAL_ADMIN_SETUP_KEY` do serviço da API e reinicie-o.
3. Faça login, consulte o catálogo, salve/reabra um rascunho e confira dashboard/relatório IPF. Verifique na aba Network que `/api/*` usa a API pública configurada, não `localhost`.
4. Se houver falha de CORS, confira a origem **exata** do frontend em `ALLOWED_ORIGINS`, o ambiente `Production` e se a API foi reiniciada. A API não adiciona origens localhost em produção; sem origens configuradas não libera chamadas cross-origin.
5. Ative monitoramento, backups automáticos e teste de restauração. Preserve os avisos de validação funcional do IDS descritos em “Estado atual”; disponibilidade online não significa que o cálculo mensal esteja validado para decisões operacionais.