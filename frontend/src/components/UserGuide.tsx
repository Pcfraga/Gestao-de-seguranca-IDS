import { BookOpen, CheckCircle2, Info } from 'lucide-react'
import type { ReactNode } from 'react'

const chapters = [
  { id: 'primeiros-passos', title: '1. Comece por aqui' },
  { id: 'acesso-usuarios', title: '2. Acesso e criação de usuários' },
  { id: 'permissoes', title: '3. Quem pode fazer o quê' },
  { id: 'areas-modelos', title: '4. Áreas e formulários' },
  { id: 'cadastros', title: '5. Clientes, contratadas e locais' },
  { id: 'avaliacoes', title: '6. Preencher e enviar uma avaliação' },
  { id: 'dados-indicadores', title: '7. Consultar dados e indicadores' },
  { id: 'contas-ids', title: '8. Entenda as contas do IDS' },
  { id: 'ipf-manual', title: '9. IPF manual por formulário' },
  { id: 'ipf-disciplinas', title: '10. IPF por disciplinas e pesos' },
  { id: 'relatorios-conta', title: '11. PDFs, identidade visual e conta' },
  { id: 'duvidas', title: '12. Dúvidas e cuidados importantes' },
]

function Chapter({ id, children }: { id: typeof chapters[number]['id']; children: ReactNode }) {
  const chapter = chapters.find(value => value.id === id)!
  return <section className="panel guide-chapter" id={`guia-${id}`} aria-labelledby={`guia-titulo-${id}`}>
    <h2 id={`guia-titulo-${id}`}>{chapter.title}</h2>
    {children}
    <a className="guide-back" href="#guia-indice">Voltar ao índice ↑</a>
  </section>
}

export function UserGuide() {
  return <div className="user-guide">
    <section className="panel guide-welcome">
      <BookOpen size={28} aria-hidden="true" />
      <div><h2>Seu primeiro dia no IDS</h2><p>Um roteiro do cadastro à leitura dos resultados. Siga a ordem abaixo ou vá direto ao assunto que precisa. Este guia está disponível para todos os usuários; alguns botões dependem do seu perfil.</p></div>
    </section>
    <nav className="panel guide-index" id="guia-indice" aria-label="Índice do guia de uso">
      <h2>O que você quer aprender?</h2>
      <div>{chapters.map(chapter => <a key={chapter.id} href={`#guia-${chapter.id}`}>{chapter.title}</a>)}</div>
    </nav>

    <Chapter id="primeiros-passos">
      <p>O IDS registra inspeções e organiza seus resultados. Primeiro prepare os cadastros, depois registre as avaliações e, por fim, consulte os indicadores.</p>
      <ol>
        <li><strong>Acesse sua empresa:</strong> o administrador cadastra a empresa e cria as contas da equipe.</li>
        <li><strong>Organize as disciplinas:</strong> cadastre áreas como Meio Ambiente, Qualidade ou Saúde e Segurança do Trabalho.</li>
        <li><strong>Prepare os modelos:</strong> em cada área, crie formulários com tópicos e itens observáveis.</li>
        <li><strong>Cadastre as referências:</strong> clientes, contratadas, subcontratadas e locais são cadastrados durante o preenchimento de uma nova avaliação.</li>
        <li><strong>Registre a inspeção:</strong> escolha o modelo, informe as pessoas observadas, as quantidades e as severidades; revise e envie.</li>
        <li><strong>Acompanhe:</strong> selecione mês, área e formulário para consultar os dados. Em Relatórios, registre o IPF manual ou componha o IPF por disciplinas.</li>
      </ol>
      <div className="guide-note"><Info size={18} aria-hidden="true" /><p><strong>Não confunda:</strong> sua empresa é o ambiente de acesso da equipe. Uma contratada é uma organização avaliada dentro desse ambiente. Cadastrar uma contratada não cria outra empresa de acesso nem uma conta de usuário.</p></div>
    </Chapter>

    <Chapter id="acesso-usuarios">
      <h3>Primeiro acesso do responsável pela empresa</h3>
      <ol>
        <li>Na tela de login, escolha <strong>Sou gestor: cadastrar minha empresa</strong>.</li>
        <li>Informe o nome da empresa, seu nome, e-mail e uma senha com pelo menos oito caracteres.</li>
        <li>O cadastro cria uma empresa independente e uma conta de <strong>Administrador</strong>. Entre com seu e-mail e senha.</li>
      </ol>
      <h3>Como adicionar colaboradores</h3>
      <ol>
        <li>Como administrador, abra <strong>Usuários e perfis</strong> no menu lateral.</li>
        <li>Preencha nome, e-mail e senha inicial de pelo menos oito caracteres.</li>
        <li>Escolha <strong>Usuário comum</strong> para quem vai registrar suas inspeções. Use <strong>Administrador</strong> somente para quem precisa gerenciar o ambiente.</li>
        <li>Clique em <strong>Criar usuário</strong> e entregue as credenciais por um canal seguro.</li>
        <li>Oriente o colaborador a trocar a senha inicial em <strong>Minha conta</strong>.</li>
      </ol>
      <p>O colaborador deve usar a conta criada pelo administrador, e não o cadastro público de empresa. Cada e-mail identifica uma conta única no sistema e não pode ser reutilizado em outra empresa.</p>
      <p>Na lista de usuários, o administrador também pode <strong>Redefinir senha</strong>, <strong>Bloquear</strong> e <strong>Liberar</strong> o acesso de contas da própria empresa.</p>
    </Chapter>

    <Chapter id="permissoes">
      <div className="guide-table-scroll"><table>
        <caption>Perfis oferecidos no cadastro de usuários da interface</caption>
        <thead><tr><th scope="col">Atividade</th><th scope="col">Administrador</th><th scope="col">Usuário comum</th></tr></thead>
        <tbody>
          <tr><th scope="row">Criar, bloquear usuários e redefinir senhas</th><td>Sim, na própria empresa</td><td>Não</td></tr>
          <tr><th scope="row">Criar áreas e criar, editar ou duplicar formulários</th><td>Sim</td><td>Não</td></tr>
          <tr><th scope="row">Cadastrar clientes, contratadas, subcontratadas e locais</th><td>Sim</td><td>Não; solicitar ao administrador</td></tr>
          <tr><th scope="row">Criar e enviar avaliações</th><td>Sim</td><td>Sim</td></tr>
          <tr><th scope="row">Consultar avaliações e suas consolidações</th><td>Todas as avaliações da própria empresa</td><td>Somente as próprias avaliações</td></tr>
          <tr><th scope="row">Editar avaliações</th><td>Rascunhos visíveis da própria empresa</td><td>Somente os próprios rascunhos</td></tr>
          <tr><th scope="row">Consultar histórico salvo de IPF</th><td>Sim, na própria empresa</td><td>Sim, na própria empresa</td></tr>
          <tr><th scope="row">Calcular prévia de IPF por disciplinas</th><td>Sim, com as avaliações da empresa</td><td>Sim, somente com as próprias avaliações</td></tr>
          <tr><th scope="row">Salvar IPF manual ou por disciplinas</th><td>Sim</td><td>Não</td></tr>
          <tr><th scope="row">Alterar logo e identidade dos relatórios</th><td>Sim</td><td>Não</td></tr>
          <tr><th scope="row">Trocar a própria senha e consultar este guia</th><td>Sim</td><td>Sim</td></tr>
        </tbody>
      </table></div>
      <p><strong>Perfis técnicos adicionais:</strong> a API também reconhece GESTOR e CONSULTA, embora o cadastro da interface ofereça apenas Administrador e Usuário comum. GESTOR pode cadastrar organizações/locais, registrar avaliações e salvar IPF, mas não gerencia usuários, áreas ou modelos; a consulta de avaliações fica limitada às próprias. CONSULTA não pode gravar avaliações, cadastros ou IPF; a consulta de avaliações também fica limitada às próprias. Esses perfis não concedem acesso global.</p>
      <div className="guide-note"><Info size={18} aria-hidden="true" /><p>As permissões são conferidas no servidor. Um botão aparecer na tela não significa que seu perfil pode concluir a operação. Nenhum administrador tem acesso aos dados de outra empresa.</p></div>
    </Chapter>

    <Chapter id="areas-modelos">
      <p>A organização é: <strong>Área → Formulário → Tópicos → Itens</strong>. Exemplo: Meio Ambiente → Inspeção de resíduos → Armazenamento → Recipientes identificados.</p>
      <h3>Criar uma área</h3>
      <ol>
        <li>Como administrador, abra <strong>Formulários de inspeção</strong>.</li>
        <li>No campo <strong>Nova área</strong>, informe um nome claro e clique em <strong>Criar área</strong>.</li>
        <li>A área fica disponível para os formulários da sua empresa. Ela não cria um formulário automaticamente.</li>
      </ol>
      <p><strong>Saúde e Segurança do Trabalho</strong> já está disponível. Os registros anteriores à separação por áreas foram preservados nessa disciplina.</p>
      <h3>Criar o formulário completo</h3>
      <ol>
        <li>Use <strong>Área dos formulários</strong> para organizar a lista e clique em <strong>Novo formulário</strong>.</li>
        <li>Escolha a <strong>Área do formulário</strong> e dê um nome ao modelo.</li>
        <li>Nomeie o primeiro tópico e seus itens. Use <strong>Adicionar item neste tópico</strong> e <strong>Adicionar tópico</strong> conforme necessário.</li>
        <li>As setas reorganizam tópicos e itens; a lixeira remove uma entrada do modelo em edição.</li>
        <li>Preencha todos os nomes, mantenha pelo menos um tópico com itens e clique em <strong>Salvar formulário</strong>.</li>
      </ol>
      <h3>Editar sem perder o passado</h3>
      <p><strong>Editar</strong> salva uma nova versão do mesmo modelo. As inspeções e os rascunhos já salvos continuam com a versão original, inclusive nomes e itens. As novas avaliações passam a usar a versão atual.</p>
      <p>A área de um modelo salvo é fixa. Para aproveitá-lo em outra disciplina, use <strong>Duplicar</strong> e escolha a nova área. O formulário padrão também pode ser editado ou duplicado sem alterar as inspeções antigas.</p>
    </Chapter>

    <Chapter id="cadastros">
      <dl>
        <dt>Cliente</dt><dd>Organização para a qual o serviço ou projeto é realizado.</dd>
        <dt>Contratada</dt><dd>Empresa executante que será vinculada à inspeção. É a referência usada para consultar e registrar o IPF.</dd>
        <dt>Subcontratada</dt><dd>Empresa vinculada à execução por meio de outra contratada, quando aplicável.</dd>
        <dt>Local / projeto</dt><dd>Onde a inspeção ocorreu. O cadastro permite informar também um projeto ou ilha, opcionalmente.</dd>
      </dl>
      <ol>
        <li>Abra <strong>Nova avaliação</strong> e vá à seção <strong>Identificação</strong>.</li>
        <li>Procure primeiro na lista para não duplicar um cadastro existente.</li>
        <li>Se não existir, use o botão ao lado do campo: <strong>Novo local</strong>, <strong>Novo cliente</strong>, <strong>Nova contratada</strong> ou <strong>Nova subcontratada</strong>.</li>
        <li>Informe o nome, salve o cadastro e selecione-o na avaliação. Cadastros operacionais exigem Administrador ou GESTOR.</li>
      </ol>
      <div className="guide-note"><Info size={18} aria-hidden="true" /><p>Vincule a <strong>contratada correta</strong> em todas as inspeções que devem entrar no IPF dela. Um registro sem contratada não entra na média de uma contratada escolhida no relatório. Nome parecido não é suficiente: o vínculo selecionado é o que vale.</p></div>
    </Chapter>

    <Chapter id="avaliacoes">
      <ol>
        <li>Clique em <strong>Nova avaliação</strong>. Escolha a área e o modelo; somente os formulários da área selecionada aparecem.</li>
        <li>Confira data, hora, local, cliente, contratada, subcontratada e responsáveis, conforme o registro.</li>
        <li>Informe o número de <strong>Pessoas observadas</strong>. Esse número é a base da conta do IDS e precisa ser maior que zero para haver uma nota calculável.</li>
        <li>Em <strong>Observações</strong>, informe a quantidade do desvio e a severidade do item. Use o comentário para explicar o que foi visto.</li>
        <li>Preencha pontos fortes e oportunidades de melhoria para contextualizar o resultado.</li>
        <li>Use <strong>Salvar rascunho</strong> para continuar depois. Revise o modelo, a contratada e os pares de quantidade/severidade antes de enviar.</li>
        <li>Use a ação de envio para concluir. Depois de enviada, a avaliação fica somente para leitura.</li>
      </ol>
      <p>Na lista de <strong>Avaliações</strong>, localize o registro e use a ação de edição enquanto estiver em rascunho. Uma avaliação salva não pode trocar de modelo ou versão; se escolheu o modelo errado, crie uma nova avaliação.</p>
      <div className="guide-note"><Info size={18} aria-hidden="true" /><p>Itens incompletos podem ser salvos/enviados com aviso, mas uma quantidade sem severidade válida não contribui para a conta de desvios ponderados. Não interprete uma nota alta como prova de preenchimento completo. Ao trocar o modelo antes de salvar, confirme com cuidado: as observações preenchidas são descartadas.</p></div>
    </Chapter>

    <Chapter id="dados-indicadores">
      <ol>
        <li>Selecione o <strong>mês de referência</strong> no topo da página.</li>
        <li>Escolha <strong>Área dos resultados</strong> e <strong>Tipo de formulário</strong>. Esses filtros separam as disciplinas e os modelos, reunindo as versões do mesmo tipo.</li>
        <li>Em <strong>Visão geral</strong>, acompanhe totais, severidades, evolução e avaliações recentes.</li>
        <li>Em <strong>Avaliações</strong>, use busca e filtros de status, contratada e local para localizar os registros; a lista também permite exportar CSV e gerar o PDF individual.</li>
        <li>Em <strong>Dados</strong>, selecione uma contratada para ver pessoas, desvios, impacto ponderado, totais por dia, categorias e itens.</li>
        <li>Em <strong>Indicadores</strong>, acompanhe as distribuições e comparações do período, observando o significado de cada indicador e os avisos da tela.</li>
      </ol>
      <p>Rascunhos e avaliações enviadas entram nas consolidações atuais. Os resultados respeitam seu acesso: o administrador consulta a empresa inteira; o usuário comum consulta suas próprias avaliações. Dois perfis podem, portanto, enxergar médias diferentes no mesmo período.</p>
      <p><strong>Limite importante:</strong> a listagem de avaliações retorna até 200 registros. Médias e gráficos baseados nessa lista não devem ser usados como garantia de cobertura de todos os registros em períodos muito grandes. As consolidações de Dados e a composição por disciplinas consultam seus conjuntos de avaliações separadamente.</p>
      <p>O IDS mensal final e o agrupamento semanal ainda dependem da validação da regra de calendário. Uma média exibida de notas de avaliações não substitui esse indicador final pendente.</p>
    </Chapter>

    <Chapter id="contas-ids">
      <p>O IDS considera <strong>quantos desvios foram observados</strong>, <strong>a gravidade deles</strong> e <strong>quantas pessoas foram observadas</strong>. Não é uma média de respostas “sim/não” nem uma contagem de itens marcados.</p>
      <h3>Uma inspeção com dez pessoas observadas</h3>
      <ol>
        <li>Imagine dois desvios de severidade baixa, um de severidade média e um de severidade alta. São <strong>quatro desvios</strong> no total.</li>
        <li>Cada desvio baixo acrescenta <strong>0,3</strong> de impacto: os dois juntos acrescentam <strong>0,6</strong>.</li>
        <li>O desvio médio acrescenta <strong>1</strong> e o alto acrescenta <strong>3</strong>. Somando os impactos, chegamos a <strong>4,6</strong>.</li>
        <li>Distribuímos esse impacto pelas dez pessoas observadas. O impacto por pessoa é <strong>0,46</strong>.</li>
        <li>A nota parte de um inteiro e desconta esse impacto. O resultado é <strong>0,54</strong>, que corresponde a <strong>54%</strong> quando mostrado em percentual.</li>
      </ol>
      <h3>Como ler os percentuais de severidade</h3>
      <p>No exemplo, dois dos quatro desvios são baixos: <strong>50%</strong>. Um é médio: <strong>25%</strong>. Um é alto: <strong>25%</strong>. Esses percentuais usam quantidades, não o impacto ponderado.</p>
      <p>Quando uma severidade não tem desvios, sua participação pode aparecer como “—” em vez de zero. Sem pessoas observadas em quantidade positiva, o IDS fica sem nota, não com nota zero.</p>
      <div className="guide-note"><Info size={18} aria-hidden="true" /><p>Um impacto muito alto pode produzir IDS negativo; o sistema não limita automaticamente a nota a zero. Sem desvios contabilizados e com pessoas observadas, a conta chega a 1 (100%). Por isso, confira sempre a qualidade do preenchimento. As mesmas regras valem para todos os modelos e áreas.</p></div>
    </Chapter>

    <Chapter id="ipf-manual">
      <p>O IPF manual é o valor mensal informado por um responsável, conforme a fonte aprovada pela empresa. Ele não é a composição automática das disciplinas.</p>
      <ol>
        <li>Abra <strong>Relatórios → IPF manual por formulário</strong>.</li>
        <li>Selecione mês de referência, área, tipo de formulário e contratada.</li>
        <li>Confira a sugestão baseada na média dos IDS calculáveis das avaliações desse recorte. O campo pode vir preenchido com essa sugestão; sem ela, pode mostrar o valor anteriormente salvo.</li>
        <li>Revise a sugestão e informe o valor aprovado em <strong>Valor do IPF</strong>. Opcionalmente, associe um local.</li>
        <li>Como Administrador ou GESTOR, clique em <strong>Salvar IPF</strong>.</li>
      </ol>
      <p>Salvar o mesmo mês, contratada, área e formulário atualiza o registro desse recorte. Outros tipos de formulário mantêm históricos independentes. A média anual/período considera somente meses preenchidos; meses ausentes não viram zero.</p>
      <p>Use <strong>Gerar PDF</strong> para emitir o histórico. A referência de IPF acima de 7 indicada na planilha não significa que a sugestão IDS foi convertida para uma escala de zero a dez: confirme a escala e o critério aprovado antes de registrar.</p>
    </Chapter>

    <Chapter id="ipf-disciplinas">
      <p>Esta opção junta as médias das disciplinas para obter uma nota mensal da contratada, dando mais importância às áreas que você escolher. Ela tem histórico próprio e não substitui os registros manuais por formulário.</p>
      <ol>
        <li>Abra <strong>Relatórios → IPF por disciplinas e pesos</strong> e selecione a contratada e o mês de referência.</li>
        <li>Sem divisão, deixe <strong>uma disciplina com 100%</strong>.</li>
        <li>Para dividir a nota, clique em <strong>Adicionar disciplina</strong>. Escolha de duas a quatro áreas diferentes e distribua os percentuais até somarem <strong>100%</strong>.</li>
        <li>Clique em <strong>Calcular IPF por disciplinas</strong>. Cada média reúne todos os formulários e versões da área para aquela contratada no mês, respeitando as permissões de consulta.</li>
        <li>Confira média IDS, avaliações válidas/total, peso definido, peso aplicado, contribuição e situação de cada área.</li>
        <li>Para registrar, use <strong>Salvar IPF por disciplinas</strong> e confirme. A gravação exige Administrador ou GESTOR e recalcula as médias no servidor naquele momento.</li>
      </ol>
      <h3>Exemplo: Segurança com 70% e Meio Ambiente com 30%</h3>
      <p>Se Segurança tem média <strong>0,9</strong>, a parte dela na nota é <strong>0,63</strong>. Se Meio Ambiente tem média <strong>0,8</strong>, a parte ambiental é <strong>0,24</strong>. Juntando as duas partes, o IPF é <strong>0,87</strong>.</p>
      <p>Dentro de cada disciplina, o sistema soma os IDS válidos das avaliações e divide pela quantidade dessas avaliações. Cada avaliação válida participa igualmente dessa média: não há peso adicional por tamanho do formulário ou número de pessoas. Avaliações sem IDS calculável são excluídas da média; rascunhos também participam quando têm nota calculável.</p>
      <h3>E se faltar uma média?</h3>
      <ul>
        <li><strong>Área sem média:</strong> fica fora e as demais recebem proporcionalmente toda a participação. No exemplo, sem média ambiental, Segurança passa a pesar 100% e a nota fica 0,9. Você pode avançar e salvar.</li>
        <li><strong>Peso definido em 0%:</strong> a área não participa, mesmo que tenha avaliações.</li>
        <li><strong>Média realmente igual a zero:</strong> participa normalmente. Com Segurança 0,9 a 70% e Meio Ambiente zero a 30%, a nota final é 0,63.</li>
        <li><strong>Nenhuma área com média e peso positivo:</strong> não existe nota para salvar; registre avaliações válidas ou ajuste as disciplinas.</li>
      </ul>
      <p>A nota usa a mesma escala do IDS, sem transformação automática para zero a dez. A conta utiliza as médias sem arredondamento intermediário e arredonda o resultado final a quatro casas decimais.</p>
      <h3>Histórico e revisão</h3>
      <p>A prévia não salva dados. Ao salvar, ficam registrados a nota, as médias, os pesos e as exclusões usados naquele mês. Novas avaliações não mudam esse retrato automaticamente. Para atualizar o mês, recalcule e salve novamente, confirmando a substituição. Os pesos do último mês anterior podem ser copiados como ponto de partida.</p>
      <p>Em <strong>Ver composição</strong>, consulte os detalhes salvos; em <strong>PDF da composição</strong>, emita o documento. O PDF de uma prévia é identificado como ainda não salvo.</p>
    </Chapter>

    <Chapter id="relatorios-conta">
      <h3>Salvar documentos</h3>
      <p>Os botões de PDF abrem uma janela de impressão. Selecione <strong>Salvar como PDF</strong> como destino. Se nada abrir, permita pop-ups para este site e tente novamente. Confira contratada, período, área e modelo antes de compartilhar.</p>
      <h3>Identidade da empresa</h3>
      <p>Como administrador, abra <strong>Configurações</strong> para ajustar nome, slogan, logo e cor dos relatórios. Salve as alterações. Os próximos PDFs usarão essa identidade; isso não altera as respostas das inspeções.</p>
      <h3>Minha conta</h3>
      <p>Abra <strong>Minha conta</strong> e informe senha atual, nova senha de pelo menos oito caracteres e confirmação. Se esqueceu a senha, solicite redefinição ao administrador. Use o botão de saída do perfil para encerrar o acesso ao terminar, principalmente em computadores compartilhados.</p>
    </Chapter>

    <Chapter id="duvidas">
      <dl>
        <dt>Não vejo uma avaliação ou a média está diferente da do colega.</dt>
        <dd>Confira empresa de acesso, mês, área, formulário, contratada, local e seu perfil. Usuários comuns consultam apenas suas próprias avaliações. Na composição por disciplinas, confira também quantas avaliações têm IDS válido.</dd>
        <dt>Minha contratada não aparece no relatório.</dt>
        <dd>Verifique se ela foi cadastrada como Contratada, não como Cliente ou Subcontratada. Os cadastros pertencem ao ambiente da empresa em que você entrou.</dd>
        <dt>Criei uma área, mas não consigo usá-la numa inspeção.</dt>
        <dd>Crie ou duplique um formulário dentro dela. Uma área sem modelos não oferece itens para avaliação.</dd>
        <dt>Não consigo editar a área de um modelo ou o modelo de uma avaliação salva.</dt>
        <dd>Essa proteção mantém o histórico consistente. Duplique o formulário em outra área ou crie uma nova avaliação com o modelo correto.</dd>
        <dt>Aparece “sem média” ou um traço.</dt>
        <dd>Ausência de resultado não significa zero. Confira pessoas observadas, pares de quantidade/severidade e os filtros. Uma nota zero válida continua participando da média do IPF por disciplinas.</dd>
        <dt>O IPF salvo não mudou depois de novas avaliações.</dt>
        <dd>O registro salvo é um histórico. No IPF por disciplinas, recalcule e salve novamente para atualizar. No manual, confira e salve o valor aprovado.</dd>
        <dt>O sistema informa falta de permissão ou sessão expirada.</dt>
        <dd>Se a sessão expirou, entre novamente. Se faltar permissão, solicite a operação ao administrador, em vez de criar outra empresa ou duplicar sua conta.</dd>
      </dl>
      <div className="guide-note"><CheckCircle2 size={18} aria-hidden="true" /><p><strong>Antes de validar um resultado:</strong> confira o período, a contratada, a área/modelo, as pessoas observadas, as severidades e as áreas excluídas da composição. Valide o critério de uso com o responsável da empresa. Este guia explica o funcionamento atual; não transforma regras de calendário ainda pendentes em indicadores já homologados.</p></div>
    </Chapter>
  </div>
}
