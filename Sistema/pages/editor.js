import { store } from '../store.js';
import { renderShell } from '../components/pageshell.js';
import { abrirFormulario } from '../components/campos.js';
import { abrirMenu } from '../components/menu.js';
import { toast } from '../components/toast.js';
import { marcarAtivo } from '../lib/ui.js';
import { esc, duracao, textoPuro } from '../lib/formato.js';
import { duracaoEstimada, contarTomadas, situacao } from '../lib/duracao.js';
import {
    FORMATOS, rotuloFormato, alvoDoFormato, novaCena, novaTomada, reindexar,
    acharTomada, garantirIds,
} from '../lib/roteiro.js';
import { exportarJSON, exportarCSV, imprimir } from '../lib/exportar.js';

/* ═══════════════════════════════════════════════════════════════════════════
   EDITOR — as duas metades de um roteiro.

   Aba 1, NARRATIVA: conceito, tom, personagens e os três atos. É onde se
   decide o que o filme é.
   Aba 2, SCRIPT TÉCNICO: a tabela de duas colunas — vídeo à esquerda, áudio à
   direita — cena por cena, tomada por tomada. É o que vai para o set.

   ── Por que abas, e não uma página com as duas ───────────────────────────
   São dois momentos de trabalho, não duas partes de uma tela. Ninguém escreve
   o Ato II e a tomada 3-2 ao mesmo tempo: escreve a estrutura, decide que
   está de pé, e só então decupa. Uma página só faria a decupagem começar 900
   pixels abaixo do início — e o script técnico precisa de altura, porque é
   uma tabela de texto longo em duas colunas.

   ── Sobre a gravação ─────────────────────────────────────────────────────
   Não há botão de salvar. O texto é gravado sozinho, com atraso, e o estado
   dessa gravação fica visível o tempo todo na barra de contexto — ver o
   indicador `#ed-estado`. A mecânica do atraso mora em store.js
   (`salvarAdiado`), não aqui: esta tela só avisa quando mexeu.

   ── Sobre contenteditable ────────────────────────────────────────────────
   As células de vídeo e áudio são `contenteditable`, e não `<textarea>`,
   porque precisam CRESCER com o conteúdo em uma grade de duas colunas que se
   mantém alinhada linha a linha. Um textarea tem altura própria e exigiria
   medir e sincronizar as duas colunas a cada tecla.

   O preço é conhecido: o que sai de lá é HTML, não texto. Todo consumo passa
   por textoPuro() (lib/formato.js) e nada do que a pessoa digita volta para
   a tela por template de string — as células são preenchidas UMA vez, no
   desenho, e a partir daí o dono do conteúdo é o navegador. É isso que
   impede tanto a perda do cursor quanto a injeção de marcação.
   ═══════════════════════════════════════════════════════════════════════════ */

/* Sugestões da coluna de VÍDEO: a gramática de câmera que se repete em todo
   roteiro. Existem para padronizar a escrita entre quem decupa — "PLONGÉE" e
   "plongee" na mesma diária viram duas coisas diferentes na hora de montar. */
const SUGESTOES_VIDEO = [
    'CLOSE-UP', 'PLANO DETALHE', 'PLANO MÉDIO', 'PLANO CONJUNTO', 'PLANO GERAL',
    'PLONGÉE', 'CONTRA-PLONGÉE', 'ZENITAL', 'FRONTAL', 'CÂMERA HOLANDESA',
    'ZOOM-IN', 'ZOOM-OUT', 'DOLLY IN', 'DOLLY OUT', 'PANORÂMICA', 'TRAVELLING',
    'B-ROLL', 'GRAVAÇÃO DE TELA', 'REVELAÇÃO', 'FADE IN', 'FADE OUT', 'CORTE SECO',
];

/* Sugestões da coluna de ÁUDIO. As marcações vêm primeiro com o prefixo já
   escrito porque é o prefixo que a contagem de duração reconhece para NÃO
   contar aquilo como fala (ver lib/duracao.js) — sugerir "BG:" é ensinar a
   convenção no momento em que ela é usada. */
const SUGESTOES_AUDIO = [
    'BG: trilha ', 'BG: silêncio', 'Folley: ', 'SFX: ', 'Loc. 01: ', 'VO: ',
];

export const renderEditor = async (container, id) => {
    const [roteiro, clientes] = await Promise.all([store.roteiros.obter(id), store.clientes.listar()]);

    if (!roteiro) {
        container.innerHTML = `
            <div class="app-aviso">
                <h2>Roteiro não encontrado</h2>
                <p>Ele pode ter sido excluído, ou o endereço pode ter vindo de outro navegador —
                   em modo local os roteiros não saem daqui.</p>
                <a href="/" class="ds-btn ds-btn--ghost ds-btn--sm">Ver todos os roteiros</a>
            </div>`;
        return;
    }

    /* Conserto na entrada, para registros gravados antes de garantirIds()
       existir: sem id, excluir uma tomada apaga a errada e reordenar esvazia
       o roteiro (a história completa está em lib/roteiro.js). Grava só se
       realmente faltava algo — abrir um roteiro não deve carimbar uma edição
       que ninguém fez. */
    const faltavaId = (roteiro.cenas || []).some(c =>
        !c.id || (c.tomadas || []).some(t => !t.id));
    if (faltavaId) {
        reindexar(garantirIds(roteiro));
        await store.roteiros.salvar(roteiro);
    }

    let aba = 'narrativa';   // 'narrativa' | 'tecnica'

    // ── Gravação ────────────────────────────────────────────────────────
    const estado = { atual: 'salvo' };   // 'salvo' | 'gravando' | 'erro'

    const pintarEstado = () => {
        const el = document.getElementById('ed-estado');
        if (!el) return;
        const mapa = {
            salvo:    { icone: 'check',          texto: 'Salvo',            classe: '' },
            gravando: { icone: 'loader',         texto: 'Salvando…',        classe: 'ed-estado--indo' },
            erro:     { icone: 'triangle-alert', texto: 'Não salvou',       classe: 'ed-estado--erro' },
        }[estado.atual];
        el.className = `ed-estado ${mapa.classe}`;
        el.innerHTML = `<i data-lucide="${mapa.icone}"></i> ${mapa.texto}`;
        if (window.lucide) lucide.createIcons();
    };

    /** Toda alteração passa por aqui. Nada mais chama o store diretamente. */
    const tocar = () => {
        estado.atual = 'gravando';
        pintarEstado();
        store.roteiros.salvarAdiado(roteiro, (erro) => {
            estado.atual = erro ? 'erro' : 'salvo';
            pintarEstado();
            // Falha de gravação não pode ficar só num rótulo pequeno: em modo
            // local significa armazenamento cheio, e continuar digitando por
            // mais uma hora perderia tudo.
            if (erro) toast(erro.message || 'Não foi possível salvar as alterações.');
        });
    };

    // ── Números vivos ───────────────────────────────────────────────────
    const atualizarNumeros = () => {
        const estimada = duracaoEstimada(roteiro);
        const selo = document.getElementById('ed-duracao');
        if (selo) {
            selo.className = `dn-selo dn-selo--${situacao(estimada, roteiro.duracao_alvo)}`;
            selo.innerHTML = `<i data-lucide="timer"></i> ${duracao(estimada)}`;
        }
        const alvo = document.getElementById('ed-alvo-rotulo');
        if (alvo) alvo.textContent = `de ${duracao(roteiro.duracao_alvo)}`;

        const cliente = document.getElementById('ed-cliente');
        if (cliente) {
            const c = roteiro.cliente_id ? clientes.find(x => x.id === roteiro.cliente_id) : null;
            cliente.hidden = !c;
            if (c) cliente.innerHTML = `<span class="ed-cliente__ponto" style="background:${esc(c.cor || '#A855FF')}"></span> ${esc(c.nome)}`;
        }

        const conta = document.getElementById('ed-conta');
        if (conta) {
            const cenas = (roteiro.cenas || []).length;
            const tomadas = contarTomadas(roteiro);
            conta.textContent = `${cenas} ${cenas === 1 ? 'cena' : 'cenas'} · ${tomadas} ${tomadas === 1 ? 'tomada' : 'tomadas'}`;
        }
        if (window.lucide) lucide.createIcons();
    };

    // ── Esqueleto ───────────────────────────────────────────────────────
    const { content } = renderShell(container, {
        path: '/',
        title: roteiro.titulo,
        subtitle: roteiro.conceito
            ? esc(roteiro.conceito.slice(0, 120)) + (roteiro.conceito.length > 120 ? '…' : '')
            : 'Sem conceito escrito ainda.',
        actions: `
            <a class="ds-btn ds-btn--ghost ds-btn--sm" href="/">
                <i data-lucide="arrow-left"></i> Roteiros
            </a>
            <button class="ds-btn ds-btn--ghost" id="ed-detalhes">
                <i data-lucide="sliders-horizontal"></i> Detalhes
            </button>
            <button class="ds-btn ds-btn--ghost" id="ed-exportar" aria-haspopup="menu" aria-expanded="false">
                <i data-lucide="download"></i> Exportar
            </button>
            <button class="ds-btn ds-btn--primary" id="ed-imprimir" aria-haspopup="menu" aria-expanded="false">
                <i data-lucide="printer"></i> PDF
            </button>`,
    });

    container.insertAdjacentHTML('beforeend', ESTILOS);

    content.innerHTML = `
        <!-- ══ Barra de contexto ═══════════════════════════════════════════
             Formato, alvo, duração estimada e estado da gravação. Fica acima
             das abas porque vale para as duas: a duração é consequência do
             script técnico, mas quem escreve o Ato I também precisa vê-la. -->
        <section class="ds-card ed-contexto no-print">
            <span class="ds-chip">${esc(rotuloFormato(roteiro.formato))}</span>
            <span class="ed-cliente" id="ed-cliente" hidden></span>
            <span class="ed-contexto__conta" id="ed-conta"></span>
            <span class="dn-barra__espaco"></span>
            <span class="ed-contexto__alvo" id="ed-alvo-rotulo"></span>
            <span class="dn-selo" id="ed-duracao"></span>
            <span class="ed-estado" id="ed-estado"></span>
        </section>

        <!-- ══ Abas ════════════════════════════════════════════════════════ -->
        <div class="ed-abas no-print" id="ed-abas" role="tablist">
            <button class="ed-aba" data-aba="narrativa" role="tab" aria-selected="false">
                <span class="ed-aba__num">1</span> Roteiro <span class="ed-aba__extra">— três atos</span>
            </button>
            <button class="ed-aba" data-aba="tecnica" role="tab" aria-selected="false">
                <span class="ed-aba__num">2</span> Script técnico <span class="ed-aba__extra">— vídeo e áudio</span>
            </button>
        </div>

        <div id="ed-painel"></div>
    `;

    // ─────────────────────────────────────────────────────────────────────
    const trocarAba = (nova) => {
        aba = nova;
        marcarAtivo(document.getElementById('ed-abas'), 'aba', aba);
        document.querySelectorAll('#ed-abas [data-aba]').forEach(b =>
            b.setAttribute('aria-selected', String(b.dataset.aba === aba)));
        const painel = document.getElementById('ed-painel');
        painel.innerHTML = aba === 'narrativa' ? PAINEL_NARRATIVA(roteiro) : PAINEL_TECNICO();
        if (aba === 'narrativa') ligarNarrativa(); else ligarTecnica();
        atualizarNumeros();
        if (window.lucide) lucide.createIcons();
    };

    document.getElementById('ed-abas').addEventListener('click', (e) => {
        const b = e.target.closest('[data-aba]');
        if (b) trocarAba(b.dataset.aba);
    });

    /* ═════════════════════════════════════════════════════════════════════
       ABA 1 — NARRATIVA
       ═════════════════════════════════════════════════════════════════════ */
    const ligarNarrativa = () => {
        // Os campos de texto longo são <textarea> e guardam TEXTO PURO. Só as
        // células do script técnico são contenteditable, e por um motivo que
        // está no cabeçalho deste arquivo.
        const campos = [
            ['ed-conceito',  (v) => { roteiro.conceito = v; }],
            ['ed-tom',       (v) => { roteiro.tom = v; }],
            ['ed-ato-1',     (v) => { roteiro.atos.apresentacao = v; }],
            ['ed-ato-2',     (v) => { roteiro.atos.confronto = v; }],
            ['ed-ato-3',     (v) => { roteiro.atos.resolucao = v; }],
        ];

        campos.forEach(([id, gravar]) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.addEventListener('input', () => {
                gravar(el.value);
                const contador = el.closest('.ed-bloco')?.querySelector('.ed-contagem');
                if (contador) contador.textContent = medida(el.value);
                tocar();
            });
            // Altura que acompanha o texto: um ato de dez linhas não deveria
            // rolar dentro de uma caixa de três enquanto a página inteira
            // tem espaço sobrando.
            const crescer = () => {
                el.style.height = 'auto';
                el.style.height = `${el.scrollHeight}px`;
            };
            el.addEventListener('input', crescer);
            crescer();
        });

        // ── Personagens ─────────────────────────────────────────────────
        const desenharPersonagens = () => {
            const caixa = document.getElementById('ed-personagens');
            const lista = roteiro.personagens || [];
            caixa.innerHTML = lista.length
                ? lista.map(p => `
                    <span class="dn-etiqueta">
                        ${esc(p)}
                        <button class="dn-etiqueta__tirar" data-tirar="${esc(p)}"
                                aria-label="Remover ${esc(p)}"><i data-lucide="x"></i></button>
                    </span>`).join('')
                : `<span class="dn-apoio">Nenhum personagem cadastrado.</span>`;

            caixa.querySelectorAll('[data-tirar]').forEach(b =>
                b.addEventListener('click', () => {
                    roteiro.personagens = (roteiro.personagens || [])
                        .filter(p => p !== b.dataset.tirar);
                    desenharPersonagens();
                    tocar();
                }));
            if (window.lucide) lucide.createIcons();
        };

        const campoNovo = document.getElementById('ed-personagem-novo');
        const acrescentar = () => {
            /* Maiúsculas e sem pontuação, sempre. É convenção de roteiro, mas
               aqui tem consequência técnica: o nome em caixa alta numa linha
               curta é o que faz a contagem de duração reconhecer aquilo como
               rubrica de quem fala, e não como fala. Ver lib/duracao.js. */
            const nome = campoNovo.value
                .replace(/[^\p{L}\p{N}\s-]/gu, '').trim().toUpperCase();
            if (!nome) return;
            roteiro.personagens = roteiro.personagens || [];
            if (roteiro.personagens.includes(nome)) {
                toast(`${nome} já está na lista.`);
                campoNovo.value = '';
                return;
            }
            roteiro.personagens.push(nome);
            campoNovo.value = '';
            desenharPersonagens();
            tocar();
        };

        document.getElementById('ed-personagem-add').addEventListener('click', acrescentar);
        campoNovo.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); acrescentar(); }
        });

        desenharPersonagens();
    };

    /* ═════════════════════════════════════════════════════════════════════
       ABA 2 — SCRIPT TÉCNICO
       ═════════════════════════════════════════════════════════════════════ */
    let arrastando = null;

    const ligarTecnica = () => {
        desenharGrade();

        document.getElementById('ed-nova-cena').addEventListener('click', () => {
            roteiro.cenas = roteiro.cenas || [];
            roteiro.cenas.push(novaCena());
            reindexar(roteiro);
            desenharGrade();
            tocar();
            // Foco no título da cena nova: quem cria uma cena vai nomeá-la.
            const titulos = document.querySelectorAll('.ed-cena__titulo');
            titulos[titulos.length - 1]?.focus();
        });

        document.getElementById('ed-nova-tomada').addEventListener('click', () => {
            const cenas = roteiro.cenas || [];
            if (!cenas.length) { document.getElementById('ed-nova-cena').click(); return; }
            acrescentarTomada(cenas[cenas.length - 1].id);
        });
    };

    const acrescentarTomada = (cenaId, depoisDe = null) => {
        const cena = (roteiro.cenas || []).find(c => c.id === cenaId);
        if (!cena) return;
        const nova = novaTomada();
        const pos = depoisDe ? cena.tomadas.findIndex(t => t.id === depoisDe) + 1 : cena.tomadas.length;
        cena.tomadas.splice(pos, 0, nova);
        reindexar(roteiro);
        desenharGrade();
        tocar();
        document.querySelector(`[data-tomada="${nova.id}"] .ed-celula--video`)?.focus();
    };

    const desenharGrade = () => {
        const corpo = document.getElementById('ed-corpo');
        const vazio = document.getElementById('ed-vazio');
        const grade = document.getElementById('ed-grade');
        if (!corpo) return;

        const temConteudo = (roteiro.cenas || []).length > 0;
        grade.hidden = !temConteudo;
        vazio.hidden = temConteudo;
        corpo.innerHTML = '';
        if (!temConteudo) { atualizarNumeros(); return; }

        roteiro.cenas.forEach((cena, i) => {
            corpo.appendChild(linhaDeCena(cena, i));
            cena.tomadas.forEach(tomada => corpo.appendChild(linhaDeTomada(cena, tomada)));
        });

        atualizarNumeros();
        if (window.lucide) lucide.createIcons();
    };

    // ── Linha de cena ───────────────────────────────────────────────────
    const linhaDeCena = (cena, indice) => {
        const linha = document.createElement('div');
        linha.className = 'ed-cena';
        linha.dataset.cena = cena.id;
        linha.innerHTML = `
            <span class="ed-cena__num">Cena ${String(indice + 1).padStart(2, '0')}</span>
            <div class="ed-cena__titulo" contenteditable="true" spellcheck="false"
                 data-vazio="CABEÇALHO DE CENA — INT. QUARTO - NOITE"></div>
            <button class="ds-icon-btn ed-cena__tirar" aria-label="Excluir cena">
                <i data-lucide="trash-2"></i>
            </button>`;

        const titulo = linha.querySelector('.ed-cena__titulo');
        titulo.textContent = cena.titulo;

        /* Caixa alta no BLUR, e não a cada tecla. Reescrever o conteúdo
           durante a digitação joga o cursor para o começo do campo a cada
           letra — o campo fica escrevendo de trás para frente. */
        titulo.addEventListener('blur', () => {
            const novo = (titulo.textContent || '').trim().toUpperCase() || 'CENA SEM TÍTULO';
            titulo.textContent = novo;
            if (novo !== cena.titulo) { cena.titulo = novo; tocar(); }
        });
        titulo.addEventListener('keydown', (e) => {
            // Enter num cabeçalho de cena não quebra linha: confirma.
            if (e.key === 'Enter') { e.preventDefault(); titulo.blur(); }
        });

        linha.querySelector('.ed-cena__tirar').addEventListener('click', () =>
            confirmarExclusaoDeCena(cena));

        /* Soltar uma tomada sobre o cabeçalho manda ela para o COMEÇO desta
           cena. Sem isto, a primeira posição de uma cena era inalcançável:
           não existe alvo acima da primeira tomada, e a única saída era
           arrastar todas as outras para baixo, uma a uma. */
        linha.addEventListener('dragover', (e) => {
            if (!arrastando) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            linha.after(arrastando);
        });
        linha.addEventListener('drop', (e) => e.preventDefault());

        return linha;
    };

    const confirmarExclusaoDeCena = (cena) => abrirFormulario({
        titulo: 'Excluir cena',
        subtitulo: esc(cena.titulo),
        campos: [{ nome: 'aviso', tipo: 'nota-viva',
                   texto: `As ${cena.tomadas.length} tomada(s) desta cena vão junto. Não há como desfazer.` }],
        valores: cena,
        rotuloSalvar: 'Manter cena',
        aoSalvar: async () => {},
        aoExcluir: async () => {
            roteiro.cenas = roteiro.cenas.filter(c => c.id !== cena.id);
            reindexar(roteiro);
            desenharGrade();
            tocar();
            toast('Cena excluída.');
        },
    });

    // ── Linha de tomada ─────────────────────────────────────────────────
    const linhaDeTomada = (cena, tomada) => {
        const linha = document.createElement('div');
        linha.className = 'ed-tomada';
        linha.dataset.tomada = tomada.id;
        linha.dataset.cena = cena.id;
        linha.innerHTML = `
            <div class="ed-tomada__num" draggable="true" title="Arraste para reordenar">
                <i data-lucide="grip-vertical"></i><span>${esc(tomada.indice)}</span>
            </div>
            <div class="ed-celula ed-celula--video" contenteditable="true" data-campo="video"
                 data-vazio="PLANO MÉDIO - FRONTAL.&#10;&#10;O que a câmera vê."></div>
            <div class="ed-celula ed-celula--audio" contenteditable="true" data-campo="audio"
                 data-vazio="BG: trilha…&#10;&#10;PERSONAGEM&#10;A fala."></div>
            <div class="ed-tomada__acoes no-print">
                <button class="ds-icon-btn" data-acao="duplicar" aria-label="Duplicar tomada">
                    <i data-lucide="copy"></i>
                </button>
                <button class="ds-icon-btn" data-acao="excluir" aria-label="Excluir tomada">
                    <i data-lucide="trash-2"></i>
                </button>
            </div>`;

        const video = linha.querySelector('.ed-celula--video');
        const audio = linha.querySelector('.ed-celula--audio');
        // innerHTML UMA vez, no desenho. Daqui em diante quem manda no
        // conteúdo é o navegador — ver o cabeçalho do arquivo.
        video.innerHTML = tomada.video || '';
        audio.innerHTML = tomada.audio || '';

        ligarCelula(video, tomada, 'video');
        ligarCelula(audio, tomada, 'audio');
        ligarArrasto(linha);

        linha.querySelector('[data-acao="duplicar"]').addEventListener('click', () => {
            const copia = novaTomada({ video: tomada.video, audio: tomada.audio });
            const i = cena.tomadas.findIndex(t => t.id === tomada.id);
            cena.tomadas.splice(i + 1, 0, copia);
            reindexar(roteiro);
            desenharGrade();
            tocar();
        });

        linha.querySelector('[data-acao="excluir"]').addEventListener('click', () => {
            cena.tomadas = cena.tomadas.filter(t => t.id !== tomada.id);
            /* Cena sem tomada nenhuma deixa de existir: um cabeçalho de cena
               solto não é nada — nem no papel, nem no set. É o mesmo
               comportamento do AutoScript original. */
            if (!cena.tomadas.length) roteiro.cenas = roteiro.cenas.filter(c => c.id !== cena.id);
            reindexar(roteiro);
            desenharGrade();
            tocar();
        });

        return linha;
    };

    // ── Comportamento de célula ─────────────────────────────────────────
    const ligarCelula = (celula, tomada, campo) => {
        celula.addEventListener('input', () => {
            tomada[campo] = celula.innerHTML;
            atualizarNumeros();
            tocar();
            sugerir(celula, campo);
        });

        celula.addEventListener('blur', () => {
            tomada[campo] = celula.innerHTML;
            // Fecha a caixa de sugestão com atraso: sem isso o blur causado
            // pelo próprio clique na sugestão a fecharia antes do clique
            // chegar, e a sugestão nunca seria aplicada.
            setTimeout(fecharSugestoes, 150);
        });

        celula.addEventListener('keydown', (e) => {
            if (teclaNaSugestao(e)) return;

            /* Enter no ÁUDIO cria a próxima tomada; no vídeo, quebra linha.
               A assimetria é do original e faz sentido no gesto: o áudio é a
               última coluna da linha, então terminar de escrevê-lo é terminar
               a tomada. Shift+Enter continua quebrando linha nos dois. */
            if (e.key === 'Enter' && !e.shiftKey && campo === 'audio') {
                e.preventDefault();
                const linha = celula.closest('.ed-tomada');
                acrescentarTomada(linha.dataset.cena, linha.dataset.tomada);
                return;
            }

            // Tab: vídeo → áudio → vídeo da próxima tomada. Na última, cria.
            if (e.key === 'Tab' && !e.shiftKey) {
                e.preventDefault();
                const linha = celula.closest('.ed-tomada');
                if (campo === 'video') { linha.querySelector('.ed-celula--audio').focus(); return; }

                let proxima = linha.nextElementSibling;
                while (proxima && !proxima.classList.contains('ed-tomada')) {
                    proxima = proxima.nextElementSibling;   // pula cabeçalho de cena
                }
                if (proxima) proxima.querySelector('.ed-celula--video').focus();
                else acrescentarTomada(linha.dataset.cena);
                return;
            }

            // Shift+Tab: o caminho de volta.
            if (e.key === 'Tab' && e.shiftKey) {
                e.preventDefault();
                const linha = celula.closest('.ed-tomada');
                if (campo === 'audio') { linha.querySelector('.ed-celula--video').focus(); return; }
                let anterior = linha.previousElementSibling;
                while (anterior && !anterior.classList.contains('ed-tomada')) {
                    anterior = anterior.previousElementSibling;
                }
                anterior?.querySelector('.ed-celula--audio')?.focus();
            }
        });

        /* Colar SEM formatação. Um trecho copiado do Word ou do Google Docs
           traz fonte, tamanho e cor embutidos, e a célula passaria a exibir
           texto que ignora o design system — além de inflar o registro com
           marcação inútil. */
        celula.addEventListener('paste', (e) => {
            e.preventDefault();
            const texto = (e.clipboardData || window.clipboardData).getData('text/plain');
            document.execCommand('insertText', false, texto);
        });
    };

    /* ── Arrastar para reordenar ──────────────────────────────────────────
       A alça é o número da tomada, não a linha inteira: com a linha inteira
       arrastável, selecionar uma palavra dentro da célula iniciava um
       arrasto e o texto saía voando.

       A reordenação acontece no DOM enquanto se arrasta e o MODELO é
       reconstruído no fim, a partir da ordem final da tela. Mexer no modelo
       a cada passagem do mouse exigiria redesenhar a grade no meio do
       arrasto — e redesenhar destrói o elemento que está sendo arrastado. */
    const ligarArrasto = (linha) => {
        const alca = linha.querySelector('.ed-tomada__num');

        alca.addEventListener('dragstart', (e) => {
            arrastando = linha;
            linha.classList.add('is-arrastando');
            e.dataTransfer.effectAllowed = 'move';
            // Alguns navegadores cancelam o arrasto sem dado no dataTransfer.
            e.dataTransfer.setData('text/plain', linha.dataset.tomada);
        });

        alca.addEventListener('dragend', () => {
            linha.classList.remove('is-arrastando');
            arrastando = null;
            reconstruirDaTela();
        });

        linha.addEventListener('dragover', (e) => {
            if (!arrastando || arrastando === linha) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            const corpo = document.getElementById('ed-corpo');
            const filhos = [...corpo.children];
            const de = filhos.indexOf(arrastando);
            const para = filhos.indexOf(linha);
            corpo.insertBefore(arrastando, de < para ? linha.nextElementSibling : linha);
        });

        /* Soltar sobre um CABEÇALHO DE CENA move a tomada para o começo
           daquela cena. Sem isto, mandar uma tomada para a primeira posição
           de uma cena era impossível: não há alvo acima da primeira linha. */
        linha.addEventListener('drop', (e) => e.preventDefault());
    };

    /**
     * Reconstrói cenas e tomadas a partir da ordem que está na tela.
     *
     * Reaproveita os OBJETOS existentes, localizados por id — e não o texto
     * lido de volta das células. Ler o HTML de volta funcionaria, mas faria
     * o conteúdo dar uma volta a mais pelo DOM a cada arrasto, e é
     * exatamente aí que caractere especial e marcação se perdem.
     */
    const reconstruirDaTela = () => {
        const corpo = document.getElementById('ed-corpo');
        const antigas = roteiro.cenas || [];
        const novas = [];
        let cenaCorrente = null;

        [...corpo.children].forEach(el => {
            if (el.classList.contains('ed-cena')) {
                const original = antigas.find(c => c.id === el.dataset.cena);
                cenaCorrente = { ...original, tomadas: [] };
                novas.push(cenaCorrente);
                return;
            }
            if (!el.classList.contains('ed-tomada') || !cenaCorrente) return;
            for (const c of antigas) {
                const achada = (c.tomadas || []).find(t => t.id === el.dataset.tomada);
                if (achada) { cenaCorrente.tomadas.push(achada); break; }
            }
        });

        /* TRAVA DE SEGURANÇA. Reordenar não cria nem destrói tomada nenhuma:
           se a conta não bate, alguma premissa desta função deixou de valer
           e o certo é NÃO gravar. Redesenhar a partir do modelo intacto
           desfaz o arrasto na tela, que é um incômodo — perder o roteiro não
           seria.

           Não é hipótese: foi exatamente o que aconteceu quando as tomadas
           vinham sem id (ver garantirIds em lib/roteiro.js). O defeito estava
           lá, mas quem o transformou em perda de trabalho foi esta função,
           gravando um resultado que ela mesma poderia ter reconhecido como
           impossível. */
        const antesDe = antigas.reduce((t, c) => t + (c.tomadas || []).length, 0);
        const depoisDe = novas.reduce((t, c) => t + c.tomadas.length, 0);
        if (antesDe !== depoisDe) {
            console.error('[editor] reordenação abortada: %d tomadas antes, %d depois.',
                antesDe, depoisDe);
            desenharGrade();
            toast('Não consegui reordenar. Nada foi alterado.');
            return;
        }

        // Uma cena que ficou sem tomadas depois do arrasto some, pelo mesmo
        // motivo de sempre: cabeçalho solto não é cena.
        roteiro.cenas = novas.filter(c => c.tomadas.length);
        reindexar(roteiro);
        desenharGrade();
        tocar();
    };

    /* ── Sugestões ────────────────────────────────────────────────────────
       Uma caixa só, no <body>, reaproveitada por todas as células. Ela vive
       fora do card pelo mesmo motivo do menu de ações: .ds-card tem
       overflow:hidden e recortaria qualquer coisa que passe da borda. */
    let caixaSugestoes = null;

    const fecharSugestoes = () => {
        caixaSugestoes?.remove();
        caixaSugestoes = null;
    };

    /** A palavra que está sendo digitada, do último espaço até o cursor. */
    const palavraCorrente = (celula) => {
        const texto = textoPuro(celula.innerHTML);
        const ultima = texto.split(/[\s\n]/).pop() || '';
        return ultima;
    };

    const sugerir = (celula, campo) => {
        const parcial = palavraCorrente(celula);
        // Duas letras antes de sugerir: com uma, a caixa aparece a cada
        // palavra nova e cobre o texto que a pessoa está escrevendo.
        if (parcial.length < 2) return fecharSugestoes();

        const alvo = parcial.toUpperCase();
        const opcoes = campo === 'video'
            ? SUGESTOES_VIDEO.filter(s => s.startsWith(alvo))
            : [
                ...(roteiro.personagens || []).filter(p => p.startsWith(alvo)),
                ...SUGESTOES_AUDIO.filter(s => s.toUpperCase().startsWith(alvo)),
              ];

        if (!opcoes.length) return fecharSugestoes();

        fecharSugestoes();
        caixaSugestoes = document.createElement('div');
        caixaSugestoes.className = 'ds-menu ed-sugestoes is-aberto';
        caixaSugestoes.setAttribute('role', 'listbox');
        caixaSugestoes.innerHTML = opcoes.slice(0, 8).map((o, i) => `
            <button class="ds-menu__item ${i === 0 ? 'is-marcado' : ''}" role="option"
                    data-sugestao="${esc(o)}">${esc(o)}</button>`).join('');
        document.body.appendChild(caixaSugestoes);

        const r = celula.getBoundingClientRect();
        caixaSugestoes.style.position = 'fixed';
        caixaSugestoes.style.left = `${Math.min(r.left, window.innerWidth - 240)}px`;
        caixaSugestoes.style.top  = `${Math.min(r.bottom + 4, window.innerHeight - 200)}px`;

        caixaSugestoes.querySelectorAll('[data-sugestao]').forEach(b =>
            b.addEventListener('mousedown', (e) => {
                // mousedown, não click: o click chegaria depois do blur da
                // célula, quando a seleção já se perdeu.
                e.preventDefault();
                aplicarSugestao(celula, b.dataset.sugestao);
            }));
    };

    /** Troca a palavra parcial pela sugestão inteira e devolve o cursor. */
    const aplicarSugestao = (celula, sugestao) => {
        const parcial = palavraCorrente(celula);
        celula.focus();

        /* Apaga caractere a caractere com o comando de edição do navegador,
           em vez de mexer no Range na mão. Parece indireto, mas é o único
           caminho que atravessa a fronteira entre nós de texto sem cálculo:
           uma célula com "PLANO<br>MED" tem a palavra parcial num nó
           diferente do início, e um deleteContents por offset apagaria o
           pedaço errado. De quebra, o histórico de desfazer continua
           coerente — Ctrl+Z devolve o que foi digitado. */
        for (let i = 0; i < parcial.length; i++) document.execCommand('delete');
        document.execCommand('insertText', false, sugestao);

        const linha = celula.closest('.ed-tomada');
        const { tomada } = acharTomada(roteiro, linha.dataset.cena, linha.dataset.tomada);
        if (tomada) tomada[celula.dataset.campo] = celula.innerHTML;

        fecharSugestoes();
        atualizarNumeros();
        tocar();
    };

    /** Teclas que a caixa de sugestão captura. Devolve true se consumiu. */
    const teclaNaSugestao = (e) => {
        if (!caixaSugestoes) return false;
        const itens = [...caixaSugestoes.querySelectorAll('[data-sugestao]')];
        const atual = caixaSugestoes.querySelector('.is-marcado');
        const i = itens.indexOf(atual);

        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            atual?.classList.remove('is-marcado');
            const passo = e.key === 'ArrowDown' ? 1 : -1;
            itens[(i + passo + itens.length) % itens.length].classList.add('is-marcado');
            return true;
        }
        if (e.key === 'Enter' || e.key === 'Tab') {
            e.preventDefault();
            const alvo = atual || itens[0];
            const celula = e.target.closest('.ed-celula');
            if (alvo && celula) aplicarSugestao(celula, alvo.dataset.sugestao);
            return true;
        }
        if (e.key === 'Escape') { e.preventDefault(); fecharSugestoes(); return true; }
        return false;
    };

    // Rolar a página deixaria a caixa flutuando longe da célula — é fixed.
    document.addEventListener('scroll', fecharSugestoes, true);

    /* ═════════════════════════════════════════════════════════════════════
       AÇÕES DO CABEÇALHO
       ═════════════════════════════════════════════════════════════════════ */
    document.getElementById('ed-detalhes').addEventListener('click', () => abrirFormulario({
        titulo: 'Detalhes do roteiro',
        subtitulo: 'Título, cliente, formato e duração alvo',
        campos: [
            { nome: 'titulo', rotulo: 'Título', obrigatorio: true },
            { nome: 'cliente_id', rotulo: 'Cliente', tipo: 'select',
              opcoes: [{ valor: '', rotulo: clientes.length ? 'Sem cliente' : 'Nenhum cliente cadastrado' },
                       ...clientes.map(c => ({ valor: c.id, rotulo: c.nome }))] },
            { nome: 'formato', rotulo: 'Formato', tipo: 'select', largura: 'metade',
              opcoes: FORMATOS.map(f => ({ valor: f.valor, rotulo: f.rotulo })) },
            { nome: 'duracao_alvo', rotulo: 'Duração alvo', tipo: 'duracao', largura: 'metade',
              dica: 'Aceita "30", "1m30" ou "3 min".' },
        ],
        valores: roteiro,
        aoSalvar: async (dados) => {
            Object.assign(roteiro, {
                titulo: dados.titulo,
                cliente_id: dados.cliente_id || null,
                formato: dados.formato,
                duracao_alvo: dados.duracao_alvo || alvoDoFormato(dados.formato),
            });
            await store.roteiros.salvar(roteiro);
            estado.atual = 'salvo';
            // Redesenha a tela inteira: o título mora no herói, e o formato
            // na barra de contexto — atualizar os dois na mão seria a mesma
            // informação escrita em três lugares.
            renderEditor(container, roteiro.id);
            toast('Detalhes atualizados.');
        },
    }));

    document.getElementById('ed-exportar').addEventListener('click', (e) => {
        e.stopPropagation();
        abrirMenu(e.currentTarget, [
            { id: 'csv', label: 'Planilha CSV', icon: 'sheet', onClick: () => exportarCSV(roteiro) },
            { id: 'json', label: 'Arquivo JSON', icon: 'file-json', onClick: () => exportarJSON(roteiro) },
        ]);
    });

    document.getElementById('ed-imprimir').addEventListener('click', (e) => {
        e.stopPropagation();
        abrirMenu(e.currentTarget, [
            { id: 'completo', label: 'Roteiro completo', icon: 'file-text',
              onClick: () => imprimir(roteiro, 'completo') },
            { id: 'narrativa', label: 'Só a narrativa', icon: 'book-open',
              onClick: () => imprimir(roteiro, 'narrativa') },
            { id: 'tecnica', label: 'Só o script técnico', icon: 'table-2',
              onClick: () => imprimir(roteiro, 'tecnica') },
        ]);
    });

    /* Ctrl/Cmd+P imprime o roteiro completo, e não a tela. Sem isto, o atalho
       que todo mundo usa entregaria a interface impressa — que a folha de
       impressão esconde, resultando em papel em branco. */
    const atalhoImprimir = (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
            e.preventDefault();
            imprimir(roteiro, 'completo');
        }
    };
    document.addEventListener('keydown', atalhoImprimir);
    // O listener é do documento e sobreviveria à troca de página; a saída da
    // rota é o momento de recolhê-lo.
    window.addEventListener('popstate', () =>
        document.removeEventListener('keydown', atalhoImprimir), { once: true });

    // ── Início ──────────────────────────────────────────────────────────
    pintarEstado();
    trocarAba('narrativa');
};

/* ═══════════════════════════════════════════════════════════════════════════
   MOLDES
   ═══════════════════════════════════════════════════════════════════════════ */

/** "1.240 caracteres · ~180 palavras" — o rodapé de cada bloco de ato. */
const medida = (texto) => {
    const t = String(texto || '').trim();
    const palavras = t ? t.split(/\s+/).length : 0;
    return `${t.length} ${t.length === 1 ? 'caractere' : 'caracteres'} · ${palavras} ${palavras === 1 ? 'palavra' : 'palavras'}`;
};

const bloco = ({ id, etiqueta, titulo, ajuda, valor, placeholder }) => `
    <article class="ds-card dn-secao ed-bloco">
        <div class="dn-secao__cabeca">
            <div>
                ${etiqueta ? `<span class="ds-eyebrow">${etiqueta}</span>` : ''}
                <h2 class="ds-card-title">${titulo}</h2>
            </div>
        </div>
        <p class="dn-apoio">${ajuda}</p>
        <textarea class="ds-input ed-texto" id="${id}" rows="4"
                  placeholder="${esc(placeholder)}">${esc(valor || '')}</textarea>
        <span class="ed-contagem">${medida(valor)}</span>
    </article>`;

const PAINEL_NARRATIVA = (r) => `
    <div class="ed-narrativa">
        <div class="ed-narrativa__par">
            ${bloco({
                id: 'ed-conceito', titulo: 'Conceito', valor: r.conceito,
                ajuda: 'A premissa em uma frase. Se ela não couber em uma frase, ainda não está resolvida.',
                placeholder: 'Um jovem descobre um relógio que para o tempo — e o preço de usá-lo.',
            })}
            ${bloco({
                id: 'ed-tom', titulo: 'Tom e estilo visual', valor: r.tom,
                ajuda: 'Como isso parece e soa. É o que a equipe de imagem e a de som leem antes de qualquer coisa.',
                placeholder: 'Cinematográfico, cortes rápidos, contraste alto, azul e sombra.',
            })}
        </div>

        <article class="ds-card dn-secao">
            <div class="dn-secao__cabeca">
                <div>
                    <h2 class="ds-card-title">Personagens e vozes</h2>
                    <span class="ds-card-sub">Quem entra aqui vira sugestão na coluna de áudio do script técnico</span>
                </div>
            </div>
            <div class="ed-personagem-add">
                <input class="ds-input" id="ed-personagem-novo" placeholder="Nome do personagem"
                       autocomplete="off" aria-label="Novo personagem">
                <button class="ds-btn ds-btn--ghost" id="ed-personagem-add">
                    <i data-lucide="plus"></i> Adicionar
                </button>
            </div>
            <div class="dn-etiquetas" id="ed-personagens"></div>
        </article>

        ${bloco({
            id: 'ed-ato-1', etiqueta: 'Ato I', titulo: 'Apresentação', valor: r.atos?.apresentacao,
            ajuda: 'Personagens, mundo e rotina — e então o incidente que tira o protagonista do lugar. Em peça curta, isso são os três primeiros segundos.',
            placeholder: 'Quem é, onde está, e o que acontece de errado.',
        })}
        ${bloco({
            id: 'ed-ato-2', etiqueta: 'Ato II', titulo: 'Confronto', valor: r.atos?.confronto,
            ajuda: 'A tentativa de resolver e os obstáculos que crescem. É o ato mais longo e o primeiro a estourar o tempo.',
            placeholder: 'O que ele tenta, e por que não funciona.',
        })}
        ${bloco({
            id: 'ed-ato-3', etiqueta: 'Ato III', titulo: 'Resolução', valor: r.atos?.resolucao,
            ajuda: 'O clímax e o que fica depois dele. Em vídeo de vendas, é aqui que mora a chamada para ação.',
            placeholder: 'O ápice, e como as coisas ficam.',
        })}
    </div>`;

const PAINEL_TECNICO = () => `
    <div class="ed-tecnica">
        <section class="ds-card dn-barra ed-ferramentas no-print">
            <p class="dn-apoio ed-ferramentas__dica">
                <kbd>Tab</kbd> anda entre as células · <kbd>Enter</kbd> no áudio cria a próxima tomada ·
                arraste pelo número para reordenar
            </p>
            <span class="dn-barra__espaco"></span>
            <button class="ds-btn ds-btn--ghost" id="ed-nova-cena">
                <i data-lucide="clapperboard"></i> Nova cena
            </button>
            <button class="ds-btn ds-btn--primary" id="ed-nova-tomada">
                <i data-lucide="plus"></i> Nova tomada
            </button>
        </section>

        <section class="ds-card ed-grade" id="ed-grade">
            <div class="ed-grade__cabeca">
                <span class="ed-col-num">Tom.</span>
                <span>Vídeo <small>imagem, enquadramento, ação</small></span>
                <span>Áudio <small>voz, diálogo, trilha, efeitos</small></span>
                <span class="ed-col-acoes no-print"></span>
            </div>
            <div id="ed-corpo"></div>
        </section>

        <div class="ds-empty dn-vazio" id="ed-vazio" hidden>
            <span class="ds-empty__icon"><i data-lucide="table-2"></i></span>
            <p class="ds-empty__text">
                O script técnico está vazio.<br>
                <strong>Crie a primeira cena</strong> para começar a decupar.
            </p>
        </div>
    </div>`;

const ESTILOS = `
<style>
/* ── Barra de contexto ──────────────────────────────────────────────────── */
.ed-contexto {
    display: flex; align-items: center; gap: var(--space-3); flex-wrap: wrap;
    padding: var(--space-3) var(--space-4);
}
.ed-contexto__conta,
.ed-contexto__alvo { font-size: var(--text-xs); color: var(--text-tertiary); font-variant-numeric: tabular-nums; }

.ed-cliente {
    display: inline-flex; align-items: center; gap: 6px;
    font-size: var(--text-xs); font-weight: 500; color: var(--text-secondary);
}
.ed-cliente[hidden] { display: none; }
.ed-cliente__ponto { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }

/* Estado da gravação. Discreto de propósito: é uma confirmação, não um
   alerta — só o erro sobe de tom. */
.ed-estado {
    display: inline-flex; align-items: center; gap: 6px;
    font-size: var(--text-xs); color: var(--text-tertiary); white-space: nowrap;
}
.ed-estado i, .ed-estado svg { width: 13px; height: 13px; }
.ed-estado--indo { color: var(--text-secondary); }
.ed-estado--indo i, .ed-estado--indo svg { animation: ed-girar 1s linear infinite; }
.ed-estado--erro { color: var(--danger); font-weight: 600; }
@keyframes ed-girar { to { transform: rotate(360deg); } }

/* ── Abas ───────────────────────────────────────────────────────────────── */
.ed-abas { display: flex; align-items: center; gap: var(--space-2); flex-wrap: wrap; }
.ed-aba {
    display: inline-flex; align-items: center; gap: var(--space-2);
    height: 40px; padding: 0 var(--space-5);
    border: 1px solid var(--border-subtle); border-radius: var(--radius-pill);
    background: var(--surface-1); color: var(--text-tertiary);
    font-family: var(--font-sans); font-size: var(--text-sm); font-weight: 500;
    cursor: pointer; white-space: nowrap;
    transition: background-color var(--dur-fast), color var(--dur-fast), border-color var(--dur-fast);
}
.ed-aba:hover { color: var(--text-primary); border-color: var(--border-default); }
.ed-aba.is-active {
    background: var(--accent-muted); border-color: var(--accent-border); color: var(--accent);
    font-weight: 600;
}
.ed-aba__num {
    width: 20px; height: 20px; flex-shrink: 0;
    display: inline-flex; align-items: center; justify-content: center;
    border-radius: 50%; background: var(--surface-3); color: var(--text-tertiary);
    font-size: 11px; font-weight: 700;
}
.ed-aba.is-active .ed-aba__num { background: var(--accent); color: var(--accent-contrast); }
.ed-aba__extra { color: var(--text-disabled); font-weight: 400; }
.ed-aba.is-active .ed-aba__extra { color: var(--accent); opacity: 0.7; }

/* ── Aba narrativa ──────────────────────────────────────────────────────── */
.ed-narrativa { display: flex; flex-direction: column; gap: var(--bento-gap); }
/* Conceito e tom lado a lado: são as duas respostas curtas, e lê-las juntas é
   como a equipe as usa. Os atos ficam em largura cheia porque são texto
   longo — duas colunas de texto longo obrigam o olho a voltar. */
.ed-narrativa__par {
    display: grid; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
    gap: var(--bento-gap);
}
.ed-texto {
    height: auto; min-height: 120px;
    padding: var(--space-4);
    resize: vertical; line-height: var(--leading-body);
    font-family: var(--font-sans); font-size: var(--text-body);
}
.ed-contagem { font-size: var(--text-xs); color: var(--text-disabled); font-variant-numeric: tabular-nums; }

.ed-personagem-add { display: flex; align-items: center; gap: var(--space-3); flex-wrap: wrap; }
.ed-personagem-add .ds-input { flex: 1; min-width: 200px; text-transform: uppercase; }

/* ── Aba técnica ────────────────────────────────────────────────────────── */
.ed-tecnica { display: flex; flex-direction: column; gap: var(--bento-gap); }
.ed-ferramentas__dica { display: flex; align-items: center; gap: var(--space-2); flex-wrap: wrap; }
.ed-ferramentas__dica kbd {
    padding: 2px 6px; border-radius: var(--radius-xs);
    border: 1px solid var(--border-default); background: var(--surface-3);
    font-family: var(--font-mono, monospace); font-size: 11px; color: var(--text-secondary);
}

/* [hidden] precisa vencer o display do componente: tanto .ds-card quanto
   .ds-empty declaram display, e o atributo sozinho não derruba isso. */
.ed-grade { padding: 0; overflow: hidden; }
.ed-grade[hidden], #ed-vazio[hidden] { display: none; }

/* A MESMA grade no cabeçalho, na cena e na tomada. Uma variável para as
   quatro colunas: sem ela, ajustar a largura da coluna de vídeo exigiria
   lembrar de três lugares e o desalinhamento só apareceria em revisão. */
.ed-grade__cabeca,
.ed-cena,
.ed-tomada {
    display: grid;
    grid-template-columns: 74px minmax(0, 1fr) minmax(0, 1fr) 78px;
    align-items: stretch;
}

.ed-grade__cabeca {
    padding: var(--space-3) var(--space-4);
    background: var(--surface-3);
    border-bottom: 1px solid var(--border-default);
    font-size: var(--text-xs); font-weight: 600;
    text-transform: uppercase; letter-spacing: var(--tracking-wide);
    color: var(--text-tertiary);
}
.ed-grade__cabeca small {
    display: block; margin-top: 2px;
    font-size: 10px; font-weight: 400; letter-spacing: 0;
    text-transform: none; color: var(--text-disabled);
}

/* ── Linha de cena ──────────────────────────────────────────────────────── */
.ed-cena {
    grid-template-columns: 74px minmax(0, 1fr) 78px;
    align-items: center; gap: var(--space-3);
    padding: var(--space-3) var(--space-4);
    background: var(--surface-3);
    border-bottom: 1px solid var(--border-default);
    border-top: 1px solid var(--border-default);
}
.ed-cena__num {
    font-size: var(--text-xs); font-weight: 700;
    text-transform: uppercase; letter-spacing: var(--tracking-wide);
    color: var(--accent);
}
.ed-cena__titulo {
    padding: var(--space-2) var(--space-3);
    border: 1px solid transparent; border-radius: var(--radius-sm);
    font-size: var(--text-sm); font-weight: 700;
    letter-spacing: var(--tracking-wide); text-transform: uppercase;
    color: var(--text-primary); outline: none;
    transition: background-color var(--dur-fast), border-color var(--dur-fast);
}
.ed-cena__titulo:hover { background: var(--surface-4); }
.ed-cena__titulo:focus { background: var(--surface-1); border-color: var(--accent-border); }
.ed-cena__tirar { justify-self: end; }
.ed-cena__tirar:hover { background: var(--danger-muted); color: var(--danger); }

/* ── Linha de tomada ────────────────────────────────────────────────────── */
.ed-tomada {
    border-bottom: 1px solid var(--border-subtle);
    transition: background-color var(--dur-fast);
}
.ed-tomada:last-child { border-bottom: none; }
.ed-tomada:focus-within { background: var(--surface-1); }
.ed-tomada.is-arrastando { opacity: 0.4; }

.ed-tomada__num {
    display: flex; align-items: center; gap: 4px;
    padding: var(--space-4) var(--space-3);
    font-size: var(--text-xs); font-weight: 600;
    font-variant-numeric: tabular-nums; color: var(--text-tertiary);
    cursor: grab; user-select: none;
}
.ed-tomada__num:active { cursor: grabbing; }
.ed-tomada__num i, .ed-tomada__num svg { width: 13px; height: 13px; color: var(--text-disabled); }

/* A célula editável. Altura mínima igual nas duas colunas para a linha não
   nascer torta quando só uma delas tem texto. */
.ed-celula {
    min-height: 84px;
    padding: var(--space-4);
    border-left: 1px solid var(--border-subtle);
    font-size: var(--text-sm); line-height: var(--leading-body);
    color: var(--text-primary);
    outline: none; white-space: pre-wrap; word-break: break-word;
    transition: background-color var(--dur-fast), box-shadow var(--dur-fast);
}
.ed-celula:focus { background: var(--surface-2); box-shadow: inset 2px 0 0 var(--accent); }

/* Texto de apoio da célula vazia. Vem de data-vazio e não do atributo
   placeholder, que só existe para input e textarea. */
.ed-celula:empty::before {
    content: attr(data-vazio);
    color: var(--text-disabled);
    white-space: pre-wrap;
    pointer-events: none;
}
/* O navegador deixa um <br> solto ao apagar todo o conteúdo, e a célula
   deixa de casar com :empty — o texto de apoio não voltaria nunca. */
.ed-celula:has(> br:only-child)::before {
    content: attr(data-vazio);
    color: var(--text-disabled);
    white-space: pre-wrap;
}

.ed-tomada__acoes {
    display: flex; flex-direction: column; align-items: center; justify-content: flex-start;
    gap: var(--space-1); padding: var(--space-3) 0;
    border-left: 1px solid var(--border-subtle);
    opacity: 0; transition: opacity var(--dur-fast);
}
.ed-tomada:hover .ed-tomada__acoes,
.ed-tomada:focus-within .ed-tomada__acoes { opacity: 1; }
/* Em tela de toque não existe hover: as ações ficam sempre visíveis, senão
   duplicar e excluir tomada seriam inalcançáveis. */
@media (hover: none) { .ed-tomada__acoes { opacity: 1; } }
.ed-tomada__acoes [data-acao="excluir"]:hover { background: var(--danger-muted); color: var(--danger); }

/* ── Caixa de sugestões ─────────────────────────────────────────────────── */
.ed-sugestoes { width: 232px; max-height: 260px; overflow-y: auto; z-index: 520; }
.ed-sugestoes .ds-menu__item { text-align: left; }
.ed-sugestoes .is-marcado { background: var(--accent-muted); color: var(--accent); }

/* ── Responsivo ───────────────────────────────────────────────────────────
   Abaixo de 820px as duas colunas viram duas linhas. Vídeo e áudio lado a
   lado num celular dariam ~150px para cada, e uma marcação de câmera não
   cabe em 150px sem quebrar a cada duas palavras. Empilhadas, cada uma tem
   a largura inteira e ganham rótulo próprio — sem o cabeçalho da grade acima
   delas, seria impossível saber qual é qual. */
@media (max-width: 820px) {
    .ed-grade__cabeca { display: none; }
    .ed-tomada { grid-template-columns: 1fr auto; row-gap: 0; }
    .ed-tomada__num { grid-column: 1; padding-bottom: 0; }
    .ed-tomada__acoes {
        grid-column: 2; grid-row: 1;
        flex-direction: row; border-left: none; padding: var(--space-2) var(--space-3) 0 0;
    }
    .ed-celula { grid-column: 1 / -1; border-left: none; min-height: 64px; }
    .ed-celula::after {
        content: attr(data-campo);
        display: block; margin-top: var(--space-2);
        font-size: 10px; text-transform: uppercase; letter-spacing: var(--tracking-wide);
        color: var(--text-disabled);
    }
    .ed-celula--audio { border-top: 1px dashed var(--border-subtle); }
    .ed-cena { grid-template-columns: 1fr auto; row-gap: var(--space-2); }
    .ed-cena__num { grid-column: 1 / -1; }
    .ed-aba__extra { display: none; }
}
</style>
`;
