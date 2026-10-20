# IDS - Sistema de Gestão de Segurança

O projeto começa a substituir o preenchimento manual da planilha IDS por um sistema web com regras no backend. A análise da planilha, fórmulas e decisões pendentes está em [PLANO_DO_SISTEMA.md](PLANO_DO_SISTEMA.md).

## Estado atual

- React, TypeScript, Vite, Tailwind, Recharts e interface responsiva.
- API ASP.NET Core separada em Domain, Application, Infrastructure e API.
- Cálculo diário de IDS no domínio e testes unitários.
- EF Core/PostgreSQL, migration inicial, catálogo padrão de seis categorias, 32 itens e três severidades, com tópicos e itens adicionais gerenciados por empresa.
- Login bearer, cadastro de empresa com administrador, isolamento por empresa e rate limit na autenticação.
- Cadastro, consulta, edição e envio explícito de avaliações; rascunhos continuam editáveis, avaliações enviadas ficam somente leitura. A lista pode ser filtrada por status, contratada e local e exportada em CSV; cada avaliação também pode ser gerada em PDF.
- Dashboard com totais mensais, proporções por severidade e evolução do IDS por avaliação; a média semanal/mensal continua desabilitada até validar o calendário da planilha.
- Aba **Dados** com filtros de período, local e contratada e consolidação por data, categoria, item e severidade. Agrupamento semanal ainda depende de validação da regra do Excel.
- Aba **Relatórios** com IPF manual por formulário e composição opcional de IPF pelas médias de IDS de até quatro disciplinas com pesos percentuais. Cada modalidade mantém seu próprio histórico mensal e exportação PDF; a composição não substitui a regra manual da planilha.
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

No primeiro acesso, escolha **Sou gestor: cadastrar minha empresa**, informe o nome da empresa, seu nome, e-mail e senha. O sistema cria uma empresa independente e sua conta de `ADMINISTRADOR`; não exige chave do Render. A senha deve ter pelo menos 8 caracteres, sem exigência de composição. O login usa `POST /api/auth/login`; cada e-mail identifica uma conta única no sistema e não pode ser reutilizado em outra empresa.

Depois do cadastro, o administrador cria colaboradores em **Usuários e perfis**, mantendo o perfil **Usuário comum** (`AVALIADOR`) e definindo uma senha inicial. Essas contas pertencem automaticamente à empresa do administrador. Colaboradores não usam o cadastro de empresa: devem solicitar uma conta ao seu gestor. Administradores veem todas as avaliações da própria empresa; usuários comuns veem e editam apenas as próprias. Catálogos operacionais, relatórios IPF e identidade visual também são isolados por empresa. A identidade visual dos relatórios continua em **Configurações**.

### Formulários completos de inspeção

Em **Formulários de inspeção**, no menu lateral, o administrador pode:

- Criar um formulário completo com nome próprio, tópicos e itens dentro de cada tópico.
- Editar ou duplicar modelos salvos, incluindo o formulário padrão; adicionar, remover, renomear e reorganizar tópicos e itens.
- Salvar novas versões sem modificar inspeções antigas. Rascunhos já salvos também mantêm a versão original; não é possível trocar o modelo de uma avaliação salva.

Em **Nova avaliação**, selecione o modelo antes de preencher as observações. Todos os modelos usam os mesmos campos de identificação, pessoas observadas, quantidade, severidade, comentário e contexto. Os pesos 0,3 / 1 / 3 e as fórmulas de IDS são os mesmos. As avaliações alimentam as telas de Dados, Indicadores e Relatórios existentes, respeitando os filtros e permissões atuais. O IPF por formulário continua manual; a composição por disciplinas é uma modalidade separada. O IDS mensal final continua dependente da validação da regra de calendário.

O formulário padrão original e os tópicos/itens personalizados criados antes desta funcionalidade são preservados como modelo inicial. Editá-lo gera uma versão exclusiva da empresa; não altera a base compartilhada nem os nomes, itens, respostas ou resultados das inspeções anteriores. Os PDFs individuais identificam o formulário e sua versão. Versões antigas não aparecem como novas opções, mas continuam disponíveis para a leitura e edição dos registros existentes.

A API lista os modelos atuais em `GET /api/inspection-forms`, cria com `POST /api/inspection-forms` e salva uma nova versão com `PUT /api/inspection-forms/{id}`. A gravação recebe `name`, `expectedVersion` e `categories: [{ name, items: [{ name }] }]`; exige pelo menos um tópico com itens e rejeita edições concorrentes com `409`. A avaliação recebe `formVersionId`, e `GET /api/catalog?formVersionId=` retorna somente os tópicos/itens dessa versão. O catálogo sem versão continua reservado aos registros legados. As antigas rotas de alteração de itens isolados retornam `409` para proteger o histórico.

### Áreas e resultados separados

Em **Formulários de inspeção**, cadastre áreas como **Meio Ambiente** e **Qualidade** e selecione a área ao criar ou duplicar um formulário. **Saúde e Segurança do Trabalho** já está disponível e contém todos os formulários, inspeções e registros de IPF anteriores a esta separação. As áreas personalizadas pertencem somente à empresa; apenas administradores podem criá-las.

A estrutura é **Área → Formulário → Tópicos → Itens**. A área de um formulário salvo permanece fixa para que suas versões não misturem históricos de áreas diferentes. Para usá-lo em outra área, duplique-o. Na nova avaliação, a área restringe os modelos disponíveis; inspeções e rascunhos salvos mantêm sua área e versão.

O seletor **Área dos resultados / Tipo de formulário** separa Visão geral, Avaliações, Dados, Indicadores e Relatórios. Cada tipo reúne todas as suas versões, mas nunca inclui outro tipo ou área. O IPF manual tem um histórico independente por área, formulário, contratada, ano e mês; salvar o mesmo mês em outro formulário não substitui o anterior. As sugestões baseadas nas avaliações também usam essa separação. Os PDFs identificam área e formulário. As fórmulas e os pesos permanecem iguais.

`GET /api/inspection-areas` lista as áreas e `POST /api/inspection-areas` cadastra uma área com `{ "name": "..." }`. O modelo recebe `areaId`. Os endpoints de avaliações e consolidação aceitam `areaId` e `formId` (identidade estável, não versão); o frontend sempre envia ambos. A identidade `00000000-0000-0000-0000-000000000000` representa a área padrão e, no filtro de formulário, o tipo padrão, incluindo seus registros legados. O IPF recebe os mesmos campos na consulta e na gravação; quando omitidos, mantém o histórico padrão anterior. Aplique também a migration `AddInspectionAreas` antes de publicar esta versão.

Administradores e usuários comuns podem alterar a própria senha em **Minha conta**, informando a senha atual, a nova senha (mínimo de 8 caracteres) e a confirmação. Essa operação não exige a chave do Render. Colaboradores podem trocar a senha inicial fornecida pelo gestor. A troca não encerra tokens de acesso já emitidos, que expiram em até 30 minutos.

### Sistema compartilhado por empresas

Todas as empresas usam o mesmo site e banco. A API obtém a empresa do token autenticado, valida o vínculo da conta e aplica filtros e proteção de gravação; nenhum administrador tem acesso global às demais empresas. O cadastro público cria uma empresa nova, nunca permite entrar em uma empresa existente apenas pelo nome.

Antes de publicar esta versão, aplique as migrations pendentes, incluindo `AddInspectionFormVersions` após `AddCompanyChecklistCatalog` e `AddCompanyIsolation`, e publique API e frontend compatíveis. Os usuários, avaliações e observações existentes são preservados; os tópicos/itens padrão continuam compartilhados e os formulários personalizados ficam isolados por empresa. Os dados anteriores são mantidos numa empresa legada de testes e não aparecem nas novas empresas. Tokens antigos sem identificação de empresa são recusados: entre novamente. `INITIAL_ADMIN_SETUP_KEY` deixou de ser necessária e o endpoint `bootstrap-admin` foi removido. Para testar, cadastre duas empresas com e-mails distintos, crie colaboradores e confirme que usuários, avaliações, locais, relatórios, configuração visual e formulários personalizados não aparecem na outra empresa.

No Render, é possível aplicar as migrations na inicialização definindo `APPLY_MIGRATIONS=true` no serviço da API antes do deploy. A inicialização falha explicitamente se a migração falhar; não há continuação com um esquema antigo. Após concluir a implantação, volte a `false` ou remova a variável. Alternativamente, use o comando `dotnet ef database update` descrito acima. Não publique somente o frontend novo contra uma API antiga.

### Diagnóstico de acesso

- `GET /api/health/ready` retorna `503` com `database: unavailable` até o PostgreSQL aceitar conexões e as migrations estarem aplicadas.
- `POST /api/auth/login` retorna `503` quando o banco está inacessível; `401` significa credenciais inválidas ou conta bloqueada.
- `POST /api/auth/users` cria contas somente com bearer token de um `ADMINISTRADOR`; sem autenticação retorna `401`, e com perfil comum retorna `403`.
- `PUT /api/auth/me/password` altera somente a senha da conta autenticada; exige `currentPassword` e `newPassword`. Senha atual incorreta ou nova senha inválida retorna `400`; contas bloqueadas não podem alterar senha.
- `POST /api/auth/register-company` cadastra a empresa e seu administrador sem chave de configuração; dados inválidos, senha inadequada ou e-mail já utilizado retornam `400`. A criação é transacional: uma falha não deixa uma empresa sem administrador.
- O frontend local usa `localhost:5173` ou `localhost:5174`; `/favicon.ico` redireciona ao ícone IDS em SVG.

## Dados e relatório IPF

### Guia de uso dentro do sistema

O botão **Guia de uso**, no menu lateral, está disponível para todos os usuários autenticados. O tutorial tem índice por assunto e passos para primeiro acesso, contas e permissões, áreas e modelos versionados, cadastros de clientes/contratadas/locais, avaliações, consulta de dados, IPF manual e composição por disciplinas. Os cálculos são explicados em linguagem simples com exemplos numéricos, sem exigir a leitura de fórmulas. Inclui os cuidados com dados incompletos, rascunhos, escalas de notas, histórico, PDFs e limitações atuais dos indicadores.

A consolidação de Dados é servida por `GET /api/dashboard/data?from=&to=&siteId=&contractorId=`. O histórico anual de IPF manual usa `GET /api/reports/ipf/{year}?contractorId=`; perfis `ADMINISTRADOR` e `GESTOR` podem registrar ou substituir um mês com `PUT /api/reports/ipf/{year}/{month}`. Nessa modalidade, informe o IPF manualmente conforme a fonte aprovada; a gravação não calcula a composição por disciplinas. A tabela `monthly_ipf_records` é criada pela migration `AddMonthlyIpfHistory`.

### IPF por disciplinas e pesos

Em **Relatórios → IPF por disciplinas e pesos**, selecione a contratada e o mês de referência. Essa opção calcula uma nota a partir das médias de IDS das avaliações e não modifica o **IPF manual por formulário**, que continua disponível separadamente.

- Escolha de uma a quatro disciplinas (áreas já cadastradas), com pesos percentuais entre 0 e 100 que somem 100%. Sem divisão, use uma única área com 100%.
- Cada média reúne **todos os tipos e versões de formulário da área**, para a contratada e o mês selecionados, conforme as permissões de consulta existentes. Assim como a sugestão mensal anterior, inclui rascunhos e avaliações enviadas; somente avaliações com IDS calculável entram na média.
- Áreas sem média válida ou com peso 0% não participam da nota. Os pesos das áreas restantes são ajustados proporcionalmente para totalizar 100%. Uma média válida igual a zero **continua participando** com seu peso; não é confundida com ausência de avaliações.
- O cálculo é `soma(média da área × peso definido) / soma(pesos das áreas participantes)`. As médias não são arredondadas antes do cálculo; a nota final é arredondada a quatro casas decimais. A escala é a mesma do IDS das avaliações, sem conversão automática para 0–10.
- Exemplo: Segurança com média 0,9 e peso 70%, Meio Ambiente com média 0,8 e peso 30% resulta em **0,87**. Se Meio Ambiente estiver sem média, Segurança passa a representar 100% e o resultado será **0,9**, com a exclusão indicada na composição. Se a média ambiental for realmente zero, a nota será **0,63**.
- Use **Calcular IPF por disciplinas** para visualizar as médias, quantidades de avaliações válidas/total, pesos definidos/aplicados, contribuições e áreas excluídas. Sem nenhuma área participante, a nota fica ausente e não pode ser salva.
- **Salvar IPF por disciplinas** recalcula no servidor e registra um retrato mensal independente por empresa/contratada. Novas avaliações não alteram valores já salvos; para atualizar o mês, calcule e salve novamente, confirmando a substituição. Os pesos do último mês anterior podem ser reutilizados como ponto de partida. O histórico e o PDF exibem a composição efetivamente salva.

A consulta anual usa `GET /api/reports/ipf-composition/{year}?contractorId=...`; a prévia usa `POST /api/reports/ipf-composition/{year}/{month}/preview` e a gravação usa `PUT /api/reports/ipf-composition/{year}/{month}`, com `{ contractorOrganizationId, areas: [{ areaId, weight }] }`. A gravação exige perfil `ADMINISTRADOR` ou `GESTOR`. A área padrão SST usa o identificador vazio documentado acima. Aplique a migration `AddIpfCompositions` junto da API e do frontend compatíveis antes de publicar.

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