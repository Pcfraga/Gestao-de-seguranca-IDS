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
- .NET SDK 9 para o ambiente local atual.
- PostgreSQL 16 local ou Docker Compose.
- Ferramentas locais .NET restauradas com `dotnet tool restore` (`dotnet-ef` 9.0.19).

**Nota de suporte:** .NET 9 está fora de suporte em outubro de 2026. O projeto compila com o único SDK instalado neste ambiente, mas o alvo de publicação deve ser atualizado para .NET 10 LTS antes de produção.

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

Antes do primeiro login, aplique a migration a partir do host conforme as instruções acima. Para publicação online, termine TLS no ingress/reverse proxy, restrinja CORS, use segredos do provedor de hospedagem, configure backups/restore do PostgreSQL e atualize o alvo para .NET 10 LTS.