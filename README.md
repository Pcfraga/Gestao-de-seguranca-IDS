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
- Aba **Dados** com consolidação completa por data, categoria, item e severidade e matrizes S1–S5 (dias 1–7, 8–14, 15–21, 22–28 e 29–31, sem domingos).
- Aba **Fechamento mensal** com IDS por semana, pessoas e desvios por empresa/projeto, severidade, categorias e itens, alimentada pelas avaliações e filtros de área/formulário do sistema.
- Aba **Relatório IPF**, com **Dados Relatório Mensal** e os 14 gráficos do modelo. O IPF salvo por contratada e projeto é preservado; área, formulário e ilha filtram os dados de apoio.
- Composição por projeto de até quatro disciplinas com pesos percentuais. A média ponderada da contratada no projeto alimenta o IPF manual.
- Testes HTTP da API para autorização por padrão, health check sem banco e CORS local; teste de aplicação para média anual e gravação mensal de IPF.
- PWA com cache do aplicativo e dos dados de consulta usados recentemente. Avaliações podem ser salvas em uma fila local durante a perda de sinal e sincronizadas automaticamente na reconexão ou pelo botão de sincronização manual.

Exportação consolidada PDF/Excel, importação histórica, auditoria completa, cálculo mensal final de IDS e validação com avaliações reais do Excel ainda estão pendentes. Não use o sistema para decisões operacionais até validar o IDS mensal e comparar com avaliações preenchidas no Excel.

### Uso offline

O primeiro acesso deve ocorrer uma vez com conexão, usando o navegador ou o menu **Instalar aplicativo**. A sessão, os arquivos do aplicativo e as consultas de áreas, modelos, catálogo e avaliações são mantidos no aparelho para uso posterior sem sinal. O sistema não consulta dados ainda não carregados.

Sem internet, **Salvar offline** ou **Enviar depois** grava a avaliação em IndexedDB no aparelho. Ao voltar a internet, o aplicativo tenta criar/atualizar o rascunho e enviá-lo quando essa opção tiver sido escolhida. Também aparece **Sincronizar** no cabeçalho para envio manual. A fila fica vinculada ao usuário/empresa; saia pelo menu do sistema ao usar um aparelho compartilhado.

Mantenha API e frontend na mesma versão. Catálogos administrativos e demais gravações continuam exigindo conexão; somente o fluxo de avaliações entra na fila offline.

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

Para usar o frontend local com a API publicada e os mesmos usuários do ambiente de produção, crie `frontend/.env.development.local` com `IDS_API_PROXY_TARGET=https://ids-api-ya5l.onrender.com` e reinicie o Vite. O proxy mantém as requisições no mesmo endereço local, sem exigir CORS do navegador. **Atenção:** alterações feitas nessa configuração afetam os dados reais. Remova a variável e reinicie o Vite para voltar à API local; mantenha frontend e API compatíveis.

Os botões **Gerar PDF** abrem a janela de impressão do navegador. Selecione **Salvar como PDF** como destino para baixar ou salvar o documento.

O Relatório IPF preserva as faixas verdes `#00B050` e as cores dos gráficos do modelo, independentemente da cor configurada para os demais PDFs. Nome e logo da empresa continuam no cabeçalho. As tabelas recolhíveis abaixo dos gráficos permitem conferir as séries sem entrar na impressão.
O gráfico de resultados do IPF usa escala fixa de 0 a 10, com intervalos de 1. Valores fora dessa faixa mantêm o número original e são sinalizados por setas; as barras ficam limitadas à escala.
No fechamento mensal, o centro do gráfico de severidade mostra o percentual de cada nível sobre o total com severidade informada, conforme os filtros de empresa e projeto. Na tabela por empresa e projeto, os valores de IDS são exibidos sem a classificação de meta.
O gráfico de desvios por categoria apresenta as quantidades em barras horizontais.
Em **Fechamento mensal**, o botão **PDF para apresentação** abre a impressão de um resumo horizontal 16:9 com os filtros atuais de mês, empresa, projeto, área e formulário. Inclui os totais, IDS médio, severidade, categorias e itens da categoria selecionada. Os gráficos de barras mostram até cinco itens e agrupam os demais em “Outros”. Escolha **Salvar como PDF** no navegador; o arquivo pode ser inserido em uma apresentação. Indicadores ausentes do sistema não são incluídos.
Em **Idioma e cores do PDF para apresentação**, escolha português ou inglês e as cores para cada severidade e para os dois gráficos de barras. As escolhas ficam salvas apenas no navegador e não alteram os gráficos da tela. A tradução cobre os textos fixos e níveis de severidade; nomes cadastrados de empresas, projetos, áreas, formulários, categorias e itens permanecem no idioma original.
O gráfico de resultados de IDS usa escala de 0% a 100%, com intervalos de 20%. Valores fora da faixa são indicados por setas, com os valores reais disponíveis na tabela de dados.
No gráfico de IDS semanal, as barras dos dias e da média ficam lado a lado, pois esses percentuais não devem ser somados. Ele usa a mesma escala de 0% a 100% e sinaliza resultados fora da faixa.

Os resultados de IDS são exibidos com duas casas decimais e os de IPF com uma, nas telas e nos relatórios. Na composição por disciplinas, as médias continuam na escala original do IDS. A formatação não altera a precisão dos valores usados nos cálculos ou armazenados; por isso, o resultado calculado pode diferir de um recálculo feito com os números arredondados da tela.

A classificação usa o valor real, antes da formatação: IDS abaixo de 85% ou IPF manual abaixo de 7 é **Não atingiu a meta** em vermelho; a partir desses limites é **Meta alcançada** em verde. Um valor exibido arredondado como 7,0 ou 85,00% ainda pode estar abaixo do limite. Valores ausentes não são classificados. O IDS ponderado por disciplinas usa a mesma meta de 0,85 (85%): 0,9 atinge a meta.
O CSV de avaliações inclui uma coluna de classificação do IDS; o formato CSV não contém cores.

Testes direcionados da fórmula do IPF, classificação, formatação e dos 14 gráficos (Node.js 24 e dependências do frontend):

```powershell
node --experimental-strip-types --test frontend\src\lib\monthlyIpf.test.mjs frontend\src\lib\indicatorFormat.test.mjs frontend\src\lib\indicatorStatus.test.mjs frontend\src\lib\severityChart.test.mjs frontend\src\lib\workbookReport.test.mjs frontend\src\lib\pdf.test.mjs frontend\src\lib\monthlyClosePdf.test.mjs frontend\src\lib\monthlyClosePdfOptions.test.mjs
```

No primeiro acesso, escolha **Sou gestor: cadastrar minha empresa**, informe o nome da empresa, seu nome, e-mail e senha. O sistema cria uma empresa independente e sua conta de `ADMINISTRADOR`; não exige chave do Render. A senha deve ter pelo menos 8 caracteres, sem exigência de composição. O login usa `POST /api/auth/login`; cada e-mail identifica uma conta única no sistema e não pode ser reutilizado em outra empresa.

Depois do cadastro, o administrador cria colaboradores em **Usuários e perfis**, mantendo o perfil **Usuário comum** (`AVALIADOR`) e definindo uma senha inicial. Essas contas pertencem automaticamente à empresa do administrador. Colaboradores não usam o cadastro de empresa: devem solicitar uma conta ao seu gestor. Administradores veem todas as avaliações da própria empresa; usuários comuns veem e editam apenas as próprias. Catálogos operacionais, relatórios IPF e identidade visual também são isolados por empresa. A identidade visual dos relatórios continua em **Configurações**.

Usuários comuns podem criar avaliações, consultar seus resultados e editar ou enviar somente os próprios rascunhos. Depois do envio, uma avaliação comum fica somente leitura; não há operação de exclusão. O perfil `CONSULTA` permanece somente leitura. Todos podem calcular/consultar IDS e IPF usando os dados visíveis ao perfil, mas somente `ADMINISTRADOR` e `GESTOR` podem salvar IPF manual ou por disciplinas.

### Formulários completos de inspeção

Em **Formulários de inspeção**, no menu lateral, o administrador pode:

- Criar um formulário completo com nome próprio, tópicos e itens dentro de cada tópico.
- Editar ou duplicar modelos salvos, incluindo o formulário padrão; adicionar, remover, renomear e reorganizar tópicos e itens.
- Salvar novas versões sem modificar inspeções antigas. Rascunhos já salvos também mantêm a versão original; não é possível trocar o modelo de uma avaliação salva.

Em **Nova avaliação**, selecione o modelo antes de preencher as observações. Todos os modelos usam os mesmos campos de identificação, pessoas observadas, quantidade, severidade, comentário e contexto. Os pesos 0,3 / 1 / 3 e as fórmulas de IDS são os mesmos. As avaliações alimentam as telas de Dados, Indicadores e Relatórios existentes, respeitando os filtros e permissões atuais. A composição do projeto determina o IDS ponderado usado no IPF manual.

O formulário padrão original e os tópicos/itens personalizados criados antes desta funcionalidade são preservados como modelo inicial. Editá-lo gera uma versão exclusiva da empresa; não altera a base compartilhada nem os nomes, itens, respostas ou resultados das inspeções anteriores. Os PDFs individuais identificam o formulário e sua versão. Versões antigas não aparecem como novas opções, mas continuam disponíveis para a leitura e edição dos registros existentes.

A API lista os modelos atuais em `GET /api/inspection-forms`, cria com `POST /api/inspection-forms` e salva uma nova versão com `PUT /api/inspection-forms/{id}`. A gravação recebe `name`, `expectedVersion` e `categories: [{ name, items: [{ name }] }]`; exige pelo menos um tópico com itens e rejeita edições concorrentes com `409`. A avaliação recebe `formVersionId`, e `GET /api/catalog?formVersionId=` retorna somente os tópicos/itens dessa versão. O catálogo sem versão continua reservado aos registros legados. As antigas rotas de alteração de itens isolados retornam `409` para proteger o histórico.

### Áreas e resultados separados

Na aba **Cadastros**, administradores e gestores podem cadastrar e gerenciar empresas contratadas, locais/projetos e locais/ilhas independentemente; apenas administradores podem gerenciar áreas como **Meio Ambiente** e **Qualidade**. Editar altera o nome exibido também no histórico; desativar preserva os registros e impede novos usos. A área padrão pode ser renomeada, mas não desativada. Depois, em **Formulários de inspeção**, selecione a área ao criar ou duplicar um formulário. Clientes continuam sendo cadastrados na avaliação. As subcontratadas existentes permanecem nos registros antigos, mas não são selecionadas em novas avaliações. As áreas personalizadas pertencem somente à empresa.

Na inspeção, escolha projeto e ilha separadamente. A migração converte o antigo nome do local em projeto e o campo projeto/ilha em uma ilha, associando-a às avaliações existentes. Projetos antigos com nomes iguais na mesma empresa são agrupados em um projeto, preservando os registros e vínculos originais.

O seletor de mês no topo controla o fechamento mensal e o IPF. O IPF utiliza a média ponderada da contratada no projeto, considerando todas as ilhas e disciplinas configuradas. A ilha filtra apenas os dados de apoio. Notas antigas permanecem inalteradas até serem recalculadas e salvas novamente.

A estrutura é **Área → Formulário → Tópicos → Itens**. A área de um formulário salvo permanece fixa para que suas versões não misturem históricos de áreas diferentes. Para usá-lo em outra área, duplique-o. Na nova avaliação, a área restringe os modelos disponíveis; inspeções e rascunhos salvos mantêm sua área e versão.

O seletor **Área dos resultados / Tipo de formulário** separa os dados de apoio por área e tipo. O IPF de projeto reúne as disciplinas configuradas e tem histórico independente por contratada, projeto, ano e mês. Registros antigos por área e formulário continuam preservados no seu recorte.

`GET /api/inspection-areas` lista as áreas e `POST /api/inspection-areas` cadastra uma área com `{ "name": "..." }`. O modelo recebe `areaId`. Os endpoints de avaliações e consolidação aceitam `areaId` e `formId` (identidade estável, não versão). A identidade `00000000-0000-0000-0000-000000000000` representa a área padrão e, no filtro de formulário, o tipo padrão. No novo IPF de projeto, esses campos são omitidos; os registros legados preservam seus recortes. Aplique também a migration `AddInspectionAreas` antes de publicar esta versão.

Administradores e usuários comuns podem alterar a própria senha em **Minha conta**, informando a senha atual, a nova senha (mínimo de 8 caracteres) e a confirmação. Essa operação não exige a chave do Render. Colaboradores podem trocar a senha inicial fornecida pelo gestor. A troca não encerra tokens de acesso já emitidos, que expiram em até 30 minutos.

### Sistema compartilhado por empresas

Todas as empresas usam o mesmo site e banco. A API obtém a empresa do token autenticado, valida o vínculo da conta e aplica filtros e proteção de gravação; nenhum administrador tem acesso global às demais empresas. O cadastro público cria uma empresa nova, nunca permite entrar em uma empresa existente apenas pelo nome.

Antes de publicar esta versão, aplique as migrations pendentes, incluindo `AddInspectionFormVersions` após `AddCompanyChecklistCatalog` e `AddCompanyIsolation`, e publique API e frontend compatíveis. Os usuários, avaliações e observações existentes são preservados; os tópicos/itens padrão continuam compartilhados e os formulários personalizados ficam isolados por empresa. Os dados anteriores são mantidos numa empresa legada de testes e não aparecem nas novas empresas. Tokens antigos sem identificação de empresa são recusados: entre novamente. `INITIAL_ADMIN_SETUP_KEY` deixou de ser necessária e o endpoint `bootstrap-admin` foi removido. Para testar, cadastre duas empresas com e-mails distintos, crie colaboradores e confirme que usuários, avaliações, locais, relatórios, configuração visual e formulários personalizados não aparecem na outra empresa.

No Render, é possível aplicar as migrations na inicialização definindo `APPLY_MIGRATIONS=true` no serviço da API antes do deploy. A inicialização falha explicitamente se a migração falhar; não há continuação com um esquema antigo. Após concluir a implantação, volte a `false` ou remova a variável. Alternativamente, use o comando `dotnet ef database update` descrito acima. O workflow do Firebase aguarda a API compatível e seu banco atualizados antes de publicar o frontend. Não publique somente o frontend novo contra uma API antiga.

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

A consolidação de Dados é servida por `GET /api/dashboard/data?from=&to=&siteId=&contractorId=`. O histórico anual de IPF por projeto usa `GET /api/reports/ipf/{year}?contractorId=...&siteId=...`; perfis `ADMINISTRADOR` e `GESTOR` podem salvar um mês com `PUT /api/reports/ipf/{year}/{month}`. A fórmula é `((média IDS (%) × 60 × fator) / 100 + parcela adicional) / 10`, com fator e parcela digitáveis (inicialmente 0,8 e 20). Exemplo: IDS 88,31% resulta em IPF 6,2389. A API calcula a média ponderada da contratada no projeto, salva a média e o IPF e preserva os registros até novo salvamento explícito. Sem composição ou IDS calculável, o cálculo é rejeitado.

### IDS por disciplinas e pesos

Em **Relatórios → IDS por disciplinas e pesos**, selecione o projeto e salve sua configuração. Ela é usada para calcular a média IDS de cada contratada do projeto e continua válida até ser alterada.

- Escolha de uma a quatro disciplinas (áreas já cadastradas), com pesos percentuais entre 0 e 100 que somem 100%. Sem divisão, use uma única área com 100%.
- Cada média reúne **todos os tipos e versões de formulário da área**, para a contratada, projeto e mês selecionados, conforme as permissões de consulta existentes. Apenas avaliações enviadas com IDS calculável entram na média.
- Áreas sem média válida ou com peso 0% não participam da nota. Os pesos das áreas restantes são ajustados proporcionalmente para totalizar 100%. Uma média válida igual a zero **continua participando** com seu peso; não é confundida com ausência de avaliações.
- O cálculo é `soma(média da área × peso definido) / soma(pesos das áreas participantes)`. As médias não são arredondadas antes do cálculo; a nota final é arredondada a quatro casas decimais. A escala é a mesma do IDS das avaliações, sem conversão automática para 0–10.
- Exemplo: Segurança com média 0,9 e peso 70%, Meio Ambiente com média 0,8 e peso 30% resulta em **0,87**. Se Meio Ambiente estiver sem média, Segurança passa a representar 100% e o resultado será **0,9**, com a exclusão indicada na composição. Se a média ambiental for realmente zero, a nota será **0,63**.
- A configuração exige perfil `ADMINISTRADOR` ou `GESTOR`. Após alterá-la, valores já salvos permanecem iguais até serem recalculados e salvos novamente.
- Para associar registros gerais antigos a um projeto, selecione a contratada e o projeto no IPF manual e use **Associar IPFs antigos ao projeto**. A operação preserva os valores e recusa conflitos.

### API de IPF por projeto

Aplique `AddProjectMonthlyIpf` após as migrations anteriores. IDs de aliases são resolvidos ao projeto canônico; configurações legadas duplicadas entre aliases são recusadas até serem conciliadas administrativamente.

- `GET /api/monthly-close-compositions/{siteId}` e `PUT` mantêm `{siteId, areas:[{areaId,weight}]}`. A área SST é o GUID vazio. A soma dos pesos é 100, com no máximo duas casas decimais por peso.
- `GET /api/monthly-close-compositions/{siteId}/average/{year}/{month}?contractorId=...` retorna **prévia**, `{value,areas:[{areaId,weight,effectiveWeight,average,evaluationCount,scoredEvaluationCount,contribution,status}]}`. Retorna 404 sem composição e `value:null` quando nenhuma área ponderada tem IDS calculável. Usa avaliações submetidas, visíveis ao usuário, da contratada e projeto, e os pesos atuais; redistribui o peso de áreas sem média. Não grava fechamento.
- `GET /api/reports/ipf/{year}?contractorId=...&siteId=...` retorna exclusivamente os meses do projeto canônico; sem `siteId`, retorna somente registros gerais. `GET /api/reports/ipf/{year}/{month}/suggestion?contractorId=...&siteId=...` retorna a prévia ponderada em `average` (sem composição retorna 400).
- `PUT /api/reports/ipf/{year}/{month}` com `{ "contractorOrganizationId":"GUID", "siteId":"GUID", "value":0, "multiplicationFactor":0.8, "additionalScore":20 }` exige composição, avaliações calculáveis e ambos os parâmetros. `value` é ignorado: o servidor calcula `((idsAverage * 60 * multiplicationFactor) + additionalScore) / 10`. `areaId` e `formId` devem ser omitidos no IPF de projeto, pois a composição abrange disciplinas. Chamadas sem projeto conservam o comportamento legado.
- O campo **`idsAverage`** em cada `months[]` e na resposta do PUT é o IDS ponderado efetivamente usado no último salvamento; é `null` para registros legados sem snapshot. Alterações dos pesos não modificam `idsAverage` nem `value` salvos; o novo cálculo ocorre somente em outro PUT. O endpoint `average` sempre reflete os pesos atuais.
- `POST /api/reports/ipf/associate-legacy` com `{ "contractorId":"GUID", "siteId":"GUID" }` exige `ADMINISTRADOR` ou `GESTOR`. Associa todos os registros gerais da contratada, de todos os anos e recortes, sem recalcular valores ou inventar snapshots. Sucesso: `{siteId,count,conflicts:[]}`. Se qualquer período/área/formulário já existir no projeto, retorna **409** com `{siteId,count:0,conflicts:[{year,month,areaId,formId}]}` e não altera nenhum registro. Repetir após o sucesso retorna contagem zero. IDs de outra empresa são rejeitados.

A migration mantém os dados antigos e canoniza os `SiteId` de IPFs já associados a aliases. O downgrade para os índices antigos não é possível enquanto houver múltiplos registros de projetos para o mesmo período/recorte: concilie-os antes de reverter, sem excluir dados automaticamente.

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

## Firebase Hosting e API no Render

O frontend de producao em `https://ids-gestao-seguranca.web.app` usa a API
`https://ids-api-ya5l.onrender.com`. Os workflows do Firebase definem
`VITE_API_BASE_URL` durante o build. Para um build local de producao, configure
`VITE_API_BASE_URL=https://ids-api-ya5l.onrender.com` em `frontend/.env.production`
(arquivo local ignorado pelo Git).

No servico dessa API no Render, configure
`ALLOWED_ORIGINS=https://ids-gestao-seguranca.web.app`, sem barra final, e conclua
um novo deploy. Outras origens autorizadas devem ser separadas por virgula;
canais de preview do Firebase precisam de suas proprias origens autorizadas.
O endpoint `GET /api/health/ready` verifica o banco e as migrations; o preflight
`OPTIONS /api/auth/register-company` deve retornar
`Access-Control-Allow-Origin: https://ids-gestao-seguranca.web.app` para essa origem.

Alterar `VITE_API_BASE_URL` exige gerar e publicar novamente o frontend, pois
a URL e incorporada ao JavaScript pelo Vite. Para publicacao manual:

```powershell
cd frontend
npm run build
cd ..
firebase deploy --only hosting --project ids-gestao-seguranca
```

## Compose full-stack

Depois de configurar `.env`, o Compose pode iniciar PostgreSQL, API e frontend:

```powershell
docker compose up --build
```

Antes do primeiro login, aplique a migration a partir do host conforme as instruções acima. Para publicação online, termine TLS no ingress/reverse proxy, restrinja CORS, use segredos do provedor de hospedagem, configure backups/restore do PostgreSQL e atualize o alvo para .NET 10 LTS.