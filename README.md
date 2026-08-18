# 5K9 Dionísio

Roteiro e script técnico audiovisual: o que a peça conta, em três atos, e como
ela é gravada, tomada por tomada, com vídeo de um lado e áudio do outro.

Mesmo desenho e mesma stack do [5K9 Forms](../5K9%20Forms) e do
[5K9 Gestor](../5K9%20Gestor) — módulos ES servidos direto, sem build, sobre o
design system da marca (`tokens.css` + `ds/`).

Sucessor do **AutoScript**, a ferramenta avulsa que existia antes. Todo o que
ela fazia continua aqui; o que mudou está em *De onde isto veio*, no fim.

---

## Rodar

```bash
node .claude/static-server.js
```

Abre em `http://localhost:5176`. Não há passo de build: o servidor só entrega
os arquivos de `Sistema/` e devolve `index.html` para rotas sem extensão (o
mesmo que o `vercel.json` faz em produção).

As portas de desenvolvimento são fixas por sistema — 5173 Forms, 5174 Gestor,
5175 Chronos, 5176 Dionísio — porque o trocador de ferramenta da topnav conta
com elas para não jogar você no site publicado enquanto testa
(`lib/ferramentas.js`).

## Modo local × Supabase

Enquanto `Sistema/lib/supabase-config.js` estiver vazio, o sistema roda em
**modo local**: tudo é gravado no `localStorage` deste navegador, ninguém mais
do time enxerga e limpar o cache apaga os roteiros. A topnav mostra o selo
âmbar "Modo local" o tempo todo por causa disso.

Para conectar o banco de verdade, o Dionísio entra no **mesmo projeto Supabase
que já hospeda o Forms e o Chronos** — não um projeto novo. É a mesma escolha
que o Chronos já fez, pelo mesmo motivo (cota do plano gratuito), e pelo mesmo
critério: o Forms, não o Gestor, porque o Gestor é dinheiro sem porta pública
nenhuma. O raciocínio completo, e o que essa escolha custa em troca (backup e
cota compartilhados), está no topo de `Sistema/db/schema.sql`.

1. rode `Sistema/db/schema.sql` no SQL Editor do projeto do Forms — as
   tabelas já vêm prefixadas `dn_`, então não colidem com o que já está lá;
2. confirme que a pessoa já tem usuário em *Authentication → Users* (quem já
   usa o Forms ou o Chronos, já tem);
3. copie a mesma *Project URL* e chave `anon` que já estão em
   `Sistema/lib/chronos.js` (`CHRONOS_URL`/`CHRONOS_ANON`);
4. cole as duas em `Sistema/lib/supabase-config.js`.

Exporte os roteiros em **Configurações → Cópia de segurança** antes de trocar
de modo: a troca não leva nada junto.

## Telas

| Rota | O que responde |
|---|---|
| `/` | O acervo. Cada roteiro com formato, cliente, quanto já tem escrito e se ainda cabe no tempo. Ordenado por última edição. |
| `/roteiro/:id` | O editor, em duas abas: **Roteiro** (conceito, tom, personagens, três atos) e **Script técnico** (a tabela de vídeo e áudio). |
| `/cadastros` | Os clientes do estúdio — nome, empresa, cor. |
| `/configuracoes` | Conexão, exportar/importar, tema, roteiros de exemplo. |

## Pontes com os outros sistemas

O botão **Trazer**, na tela de Roteiros, e o botão **Trazer do Gestor**, em
Cadastros, ligam este sistema aos outros dois por CÓPIA, não por consulta
direta ao banco de outro sistema — cada um copia o que precisa, quando
alguém manda copiar, e nunca sincroniza sozinho (o raciocínio completo está
comentado em `lib/gestor.js` e `lib/chronos.js`). Isso vale mesmo depois de o
Dionísio passar a morar no mesmo projeto Supabase do Chronos (ver *Modo local
× Supabase*, acima): dividir projeto é sobre ONDE os dados moram fisicamente,
e é ortogonal a como este sistema lê o que é do Gestor ou do Chronos — que
continua sendo pela ponte, nunca por um JOIN direto nas tabelas `vz_` ou nas
do Gestor.

**Clientes, do Gestor.** Mesma cartela que o Chronos já usa
(`cartela()`, no banco do Gestor — projeto separado, o dinheiro do estúdio):
nome, empresa e cor, comparados por nome normalizado para não duplicar
"Instituto Dr. Tigre" e "Instituto Dr Tigre" como dois clientes. Sem login —
a função já filtra o que pode sair.

**Temas e roteiros, do Chronos.** Este exige **login com a conta que você já
usa no Chronos**. A diferença de tratamento não é capricho: a cartela expõe
nome e cor, dado que já aparece em portfólio; aqui mora texto estratégico do
cliente, às vezes ainda rascunho, e abrir isso sem sessão exporia o
cronograma inteiro do estúdio a quem tiver a chave pública do navegador. Como
o Chronos roda no mesmo projeto Supabase do Forms — o mesmo que o Dionísio
agora também usa —, a ponte não precisou de nenhuma função nova no lado de
lá: a política de segurança já libera leitura para qualquer autenticado da
equipe. `lib/chronos.js` abre uma sessão PRÓPRIA mesmo assim (login separado,
`storageKey` distinto), porque foi escrito antes dessa decisão — hoje ela é
redundante com a sessão principal do Dionísio, mas simplificar isso é uma
mudança à parte, não feita ainda.

A conversão é literal: cada **seção** do Chronos vira uma **cena**; cada
**orientação** (instrução de câmera, não falada) vira o lado do **vídeo** de
uma tomada; qualquer outro bloco (gancho, fala, frase, bloco livre, CTA) vira
o lado do **áudio**. Um bloco, uma tomada, sempre — juntar dois numa linha só
seria uma decisão de decupagem que este código não deveria tomar sozinho.

## Saídas

**PDF** é a saída que importa — é o que vai para o set e para o cliente. Sai
pela impressão do navegador, em três recortes: completo, só a narrativa ou só o
script técnico. `Ctrl/Cmd+P` no editor imprime o completo.

**CSV** para quem vai continuar numa planilha (mapa de decupagem, cronograma de
diária). **JSON** para cópia de segurança e para levar um roteiro de um
navegador a outro — é o único formato que volta para dentro sem perda.

## Decisões que valem saber

**Duração em segundos, sempre, e nunca gravada.** O alvo (`duracao_alvo`) é uma
decisão e fica no banco. A duração **estimada** é consequência do texto e é
calculada na hora, a cada tecla (`lib/duracao.js`). Guardar consequência é criar
um segundo lugar onde a verdade pode divergir: o roteiro editado em outra aba
deixaria o número salvo mentindo.

**A estimativa é um piso, não uma promessa.** Por tomada, ela pega o MAIOR entre
o tempo de fala (palavras ÷ 2,16 por segundo, ritmo de locução em português) e
um piso visual de 3 segundos. O maior, e não a soma, porque a imagem corre ao
mesmo tempo que a fala. Pausa dramática e plano contemplativo não estão escritos
em lugar nenhum do texto, então a conta não os enxerga.

**Marcação técnica não é fala.** Linhas que começam com `BG:`, `Folley:`,
`SFX:`, `Loc.` e companhia ficam fora da contagem, assim como rubricas entre
parênteses e o nome de quem fala em caixa alta. Sem essa separação, um roteiro
com marcação densa pareceria mais longo do que é. É também por isso que o nome
de personagem é gravado em MAIÚSCULAS — a convenção de roteiro tem consequência
técnica aqui.

**Cabeçalho de cena solto não é cena.** Excluir a última tomada de uma cena
exclui a cena junto. Um cabeçalho sem tomada nenhuma não é nada, nem no papel
nem no set.

**O índice da tomada é derivado, nunca guardado como verdade.** "2-3" é a
terceira tomada da segunda cena, e é recalculado depois de toda operação que
mexe em ordem ou quantidade (`reindexar`, em `lib/roteiro.js`). Um número
gravado que não acompanha a reordenação vira uma etiqueta mentindo sobre onde a
tomada está.

**Não existe botão de salvar.** O texto é gravado sozinho, ~0,9s depois que a
digitação para, e o estado da gravação fica visível na barra de contexto do
editor. Gravar a cada tecla, contra um banco pela rede, seria uma requisição por
letra. Sair da tela força a gravação antes de trocar de rota.

**Reordenar nunca pode apagar.** O arrasto reordena no DOM e reconstrói o modelo
a partir da ordem final da tela. Se a contagem de tomadas antes e depois não
bater, a operação é **abortada** e nada é gravado. Não é precaução teórica: foi
exatamente o que aconteceu quando as tomadas nasciam sem `id` — e o defeito
estava em outro lugar, mas quem transformou o defeito em perda de trabalho foi a
reconstrução, gravando um resultado que ela mesma poderia ter reconhecido como
impossível.

**Modelo é copiado, não referenciado.** Criar um roteiro a partir de "Reel:
suspense" copia o conteúdo e corta o vínculo. Um modelo é um andaime, e ninguém
deveria descobrir seis meses depois que mexer no andaime reescreve o prédio.

**A folha de impressão ignora o design system, de propósito.** Papel é branco,
toda cor é literal e a voz Condensed é o único traço da marca que atravessa —
porque é forma, e não cor. Um roteiro impresso em fundo escuro gasta a
impressora e sai ilegível; e `var(--accent)` dependeria do tema salvo no
navegador de quem imprime, fazendo o mesmo roteiro sair diferente em cada
máquina. É a mesma decisão do e-mail de comprovante do Gestor, pelo mesmo
motivo: o destino não é uma tela do sistema (`pages/impressao.css`).

**Cenas e tomadas em `jsonb`, não em tabelas próprias.** A modelagem com três
tabelas é melhor para consultar pedaços — e essa é justamente a consulta que
este sistema nunca faz. Ele abre o roteiro inteiro, edita e grava o inteiro de
volta; com três tabelas, cada arrasto viraria uma transação reordenando dezenas
de linhas. O preço, assumido: integridade dentro do roteiro é garantida pelo
código, não pelo banco (`db/schema.sql`).

## De onde isto veio

O AutoScript era um HTML com três `<script>` globais, CSS próprio e uma barra
lateral fixa com a lista de roteiros. O que mudou na migração:

- **A lista virou tela.** A barra lateral roubava largura fixa da área de
  escrita — e o script técnico tem duas colunas de texto que precisam de todo
  espaço disponível. No celular ela já era uma gaveta cobrindo tudo, ou seja,
  já era uma tela, só que sem endereço próprio.
- **O título deixou de ser editável no lugar.** Título, formato e duração alvo
  moram num painel lateral de detalhes, como todo registro editável dos outros
  sistemas do estúdio.
- **Os campos ganharam nome em português** e o registro ganhou forma
  (`lib/roteiro.js`). Arquivos JSON do AutoScript antigo continuam sendo aceitos
  pelo botão **Importar** da tela de roteiros: a conversão está em
  `normalizar()`, e existe porque o custo de não aceitá-los seria pago por
  pessoa, por roteiro, para sempre.

## Estrutura

```
Sistema/
  index.html          entrada única; carrega tokens antes de tudo
  app.js              roteador SPA (History API)
  store.js            escolhe o adaptador, cacheia leitura, grava com atraso
  theme.js            claro/escuro (mesma chave dos outros: 5k9_theme)
  db/
    schema.sql        rodar uma vez, no projeto Supabase do Forms/Chronos
    local.js          adaptador localStorage
    remoto.js         adaptador Supabase (import preguiçoso da lib)
  lib/
    roteiro.js        forma do registro, criação, ids, normalização
    duracao.js        a estimativa de tempo — a única conta do sistema
    exportar.js       CSV, JSON e a montagem da folha impressa
    formato.js        tempo, datas, escape, texto de contenteditable
    ferramentas.js    lista de sistemas do estúdio (idêntica nos quatro)
    gestor.js         ponte com o Gestor — cartela de clientes, sem login
    chronos.js        ponte com o Chronos — temas e roteiros, exige login
    rotas.js  ui.js  ancorar.js
  components/
    topnav.js  pageshell.js  campos.js  drawer.js  toast.js  menu.js  trocador.js
  pages/
    dionisio.css        vocabulário .dn- compartilhado
    impressao.css       a folha de papel — tudo dentro de @media print
    roteiros.js  editor.js  cadastros.js  configuracoes.js  login.js
    importar-chronos.js  a interface das três etapas da ponte com o Chronos
  seed/
    modelos.js        os pontos de partida oferecidos ao criar um roteiro
  ds/                 design system entregue pelo estúdio — não editar
  tokens.css          camada base (dark-first)
  tokens-bridge.css   traduz os nomes semânticos para os tokens da marca
```

Nenhum componente novo usa cor literal: tudo é `var(--token)`. É o que faz o
tema claro funcionar sem ninguém revisar. As duas únicas exceções são os véus de
vidro do painel lateral (que têm par claro/escuro declarado) e
`pages/impressao.css`, pelo motivo explicado acima.
