import { store } from '../store.js';
import { renderShell } from '../components/pageshell.js';
import { abrirFormulario } from '../components/campos.js';
import { abrirMenu } from '../components/menu.js';
import { toast } from '../components/toast.js';
import { navegar } from '../lib/rotas.js';
import { marcarAtivo, trocarSuave } from '../lib/ui.js';
import { esc, quando, duracao, textoPuro } from '../lib/formato.js';
import { duracaoEstimada, contarTomadas, situacao } from '../lib/duracao.js';
import {
    FORMATOS, rotuloFormato, alvoDoFormato, novoRoteiro, normalizar,
} from '../lib/roteiro.js';
import { exportarJSON, exportarCSV } from '../lib/exportar.js';
import { MODELOS, modeloPorId } from '../seed/modelos.js';
import { abrirImportarChronos } from './importar-chronos.js';

/* ═══════════════════════════════════════════════════════════════════════════
   ROTEIROS — o acervo.

   A tela inicial responde a uma pergunta só: "qual eu abro agora?". Por isso
   a ordenação padrão é por ÚLTIMA EDIÇÃO e não por título — quem chega aqui
   quase sempre quer voltar ao que estava fazendo, e ordem alfabética esconde
   isso no meio da lista.

   Cada cartão mostra o que decide a escolha sem precisar abrir: o formato, o
   quanto o roteiro já tem escrito, e se ele cabe no tempo. Esse último é o
   único número com cor — ver .dn-selo em pages/dionisio.css.

   No AutoScript original a lista era uma barra lateral permanente ao lado do
   editor. Virou tela por dois motivos: a barra roubava largura fixa da área
   de escrita (o script técnico tem duas colunas de texto e precisa de todo
   espaço disponível), e no celular ela já era uma gaveta que cobria tudo —
   ou seja, já era uma tela, só que sem endereço próprio.
   ═══════════════════════════════════════════════════════════════════════════ */

export const renderRoteiros = async (container) => {
    let [roteiros, clientes] = await Promise.all([store.roteiros.listar(), store.clientes.listar()]);

    let busca = '';
    let formato = 'todos';
    let clienteFiltro = 'todos';

    const { content } = renderShell(container, {
        path: '/',
        title: 'Roteiros',
        subtitle: 'Tudo que o estúdio escreveu — narrativa e script técnico no mesmo lugar.',
        actions: `
            <button class="ds-btn ds-btn--ghost" id="rt-trazer" aria-haspopup="menu" aria-expanded="false">
                <i data-lucide="download"></i> Trazer
            </button>
            <button class="ds-btn ds-btn--primary" id="rt-novo">
                <i data-lucide="plus"></i> Novo roteiro
            </button>
            <input type="file" id="rt-arquivo" accept="application/json" hidden>`,
    });

    container.insertAdjacentHTML('beforeend', ESTILOS);

    const recarregar = async () => {
        store.limparCache();
        [roteiros, clientes] = await Promise.all([store.roteiros.listar(), store.clientes.listar()]);
        desenhar();
    };

    // ── Criar ───────────────────────────────────────────────────────────
    const abrirNovo = () => {
        let modeloEscolhido = 'branco';

        abrirFormulario({
            titulo: 'Novo roteiro',
            subtitulo: 'Escolha um ponto de partida',
            rotuloSalvar: 'Criar e abrir',
            campos: [
                { nome: 'titulo', rotulo: 'Título', obrigatorio: true,
                  placeholder: 'Reel de lançamento — Cliente X' },
                { nome: 'cliente_id', rotulo: 'Cliente', tipo: 'select',
                  opcoes: [{ valor: '', rotulo: clientes.length ? 'Sem cliente' : 'Nenhum cliente cadastrado' },
                           ...clientes.map(c => ({ valor: c.id, rotulo: c.nome }))],
                  dica: clientes.length ? '' : 'Cadastre clientes em Cadastros para vincular um roteiro a um deles.' },
                { nome: 'formato', rotulo: 'Formato', tipo: 'select', largura: 'metade',
                  opcoes: FORMATOS.map(f => ({ valor: f.valor, rotulo: f.rotulo })) },
                { nome: 'duracao_alvo', rotulo: 'Duração alvo', tipo: 'duracao', largura: 'metade',
                  dica: 'Aceita "30", "1m30" ou "3 min".' },
            ],
            valores: { formato: 'reel', duracao_alvo: 30 },

            aoMontar: (painel) => {
                // A galeria de modelos entra ANTES dos campos: a escolha do
                // modelo muda formato e duração, e um controle que altera
                // outros precisa vir antes deles na leitura.
                const form = painel.querySelector('#cp-form');
                form.insertAdjacentHTML('afterbegin', `
                    <div class="cp-campo" data-campo="modelo">
                        <label class="cp-campo__rotulo">Modelo</label>
                        <div class="nv-modelos" id="nv-modelos">
                            ${MODELOS.map(m => `
                                <button type="button" class="nv-modelo ${m.id === 'branco' ? 'is-active' : ''}"
                                        data-modelo="${m.id}" aria-pressed="${m.id === 'branco'}">
                                    <span class="nv-modelo__icone"><i data-lucide="${m.icone}"></i></span>
                                    <span class="nv-modelo__texto">
                                        <b>${esc(m.nome)}</b>
                                        <small>${esc(m.descricao)}</small>
                                    </span>
                                </button>`).join('')}
                        </div>
                    </div>`);

                const campoFormato = painel.querySelector('[name="formato"]');
                const campoAlvo    = painel.querySelector('[name="duracao_alvo"]');

                painel.querySelector('#nv-modelos').addEventListener('click', (e) => {
                    const botao = e.target.closest('[data-modelo]');
                    if (!botao) return;
                    modeloEscolhido = botao.dataset.modelo;
                    marcarAtivo(painel.querySelector('#nv-modelos'), 'modelo', modeloEscolhido);

                    // O modelo traz o formato e o alvo que combinam com ele —
                    // e a pessoa continua livre para trocar os dois depois.
                    const m = modeloPorId(modeloEscolhido).roteiro;
                    campoFormato.value = m.formato;
                    campoAlvo.value = m.duracao_alvo;
                });

                // Trocar o formato à mão reajusta o alvo, porque a duração
                // típica de um Reel e a de um vídeo de YouTube não têm
                // relação nenhuma. Só quando o campo ainda está no valor
                // sugerido: se a pessoa escreveu 45, esse número é dela.
                campoFormato.addEventListener('change', () => {
                    const sugeridoAntes = FORMATOS.some(f => String(f.alvo) === String(campoAlvo.value));
                    if (sugeridoAntes) campoAlvo.value = alvoDoFormato(campoFormato.value);
                });

                if (window.lucide) lucide.createIcons();
            },

            aoSalvar: async (dados) => {
                const base = modeloPorId(modeloEscolhido).roteiro;
                // Cópia profunda do modelo: sem ela, dois roteiros criados a
                // partir do mesmo modelo compartilhariam o mesmo array de
                // cenas, e editar um mexeria no outro.
                const roteiro = novoRoteiro({
                    ...structuredClone(base),
                    titulo: dados.titulo,
                    cliente_id: dados.cliente_id || null,
                    formato: dados.formato,
                    duracao_alvo: dados.duracao_alvo || alvoDoFormato(dados.formato),
                });
                const salvo = await store.roteiros.salvar(roteiro);
                navegar(`/roteiro/${salvo.id}`);
            },
        });
    };

    document.getElementById('rt-novo').addEventListener('click', abrirNovo);

    const aoImportarDoChronos = async (idParaAbrir) => {
        await recarregar();
        if (idParaAbrir) navegar(`/roteiro/${idParaAbrir}`);
    };

    // ── Trazer ──────────────────────────────────────────────────────────
    /* Aceita o formato do sistema E o do AutoScript original — a conversão
       mora em normalizar(), lib/roteiro.js. Um arquivo só por vez: importar
       vários de uma vez é um recurso que ninguém pediu, e a mensagem de erro
       de um lote parcial ("três entraram, um não") é sempre pior que a de um
       arquivo isolado. */
    const arquivo = document.getElementById('rt-arquivo');

    document.getElementById('rt-trazer').addEventListener('click', (e) => {
        e.stopPropagation();
        abrirMenu(e.currentTarget, [
            { id: 'json', label: 'Arquivo JSON', icon: 'file-json', onClick: () => arquivo.click() },
            { id: 'chronos', label: 'Do Chronos…', icon: 'calendar-range',
              onClick: () => abrirImportarChronos(clientes, aoImportarDoChronos) },
        ]);
    });

    arquivo.addEventListener('change', async () => {
        const f = arquivo.files?.[0];
        if (!f) return;
        try {
            const cru = JSON.parse(await f.text());
            // Uma exportação inteira do sistema tem { roteiros: [...] };
            // um roteiro só é o próprio objeto.
            const lista = Array.isArray(cru?.roteiros) ? cru.roteiros : [cru];
            const bons = lista.map(normalizar).filter(Boolean);
            if (!bons.length) throw new Error('Não encontrei nenhum roteiro neste arquivo.');

            // Id novo sempre: importar duas vezes o mesmo arquivo deve
            // resultar em duas cópias, não em uma sobrescrita silenciosa do
            // que você já editou.
            for (const r of bons) await store.roteiros.salvar({ ...r, id: crypto.randomUUID() });
            await recarregar();
            toast(bons.length === 1 ? 'Roteiro importado.' : `${bons.length} roteiros importados.`);
        } catch (e) {
            console.error('[roteiros] importação falhou:', e);
            toast(e.message || 'Não foi possível ler o arquivo.');
        } finally {
            // Zera o input: escolher o MESMO arquivo de novo não dispara
            // 'change' se o valor não mudar, e a segunda tentativa parecia
            // travada.
            arquivo.value = '';
        }
    });

    // ── Desenho ─────────────────────────────────────────────────────────
    const filtrar = () => {
        const termo = busca.trim().toLowerCase();
        return roteiros
            .filter(r => formato === 'todos' || r.formato === formato)
            .filter(r => clienteFiltro === 'todos' || (r.cliente_id || '') === clienteFiltro)
            .filter(r => {
                if (!termo) return true;
                // Busca também no CORPO do roteiro: quem procura "abdução"
                // pode estar procurando a palavra dentro de uma tomada, não
                // no título. Sem isso, achar um roteiro exige lembrar como
                // ele foi batizado.
                return `${r.titulo} ${r.conceito || ''} ${r.tom || ''} ${(r.personagens || []).join(' ')}`
                    .toLowerCase().includes(termo)
                    || textoPuro(JSON.stringify(r.cenas || [])).toLowerCase().includes(termo);
            })
            .sort((a, b) => String(b.atualizado_em || b.criado_em || '')
                .localeCompare(String(a.atualizado_em || a.criado_em || '')));
    };

    const desenhar = () => {
        const lista = filtrar();
        const totalTomadas = roteiros.reduce((t, r) => t + contarTomadas(r), 0);

        content.innerHTML = `
            <section class="ds-card dn-barra">
                <div class="ds-search dn-barra__busca">
                    <i data-lucide="search"></i>
                    <input type="text" id="rt-busca" placeholder="Buscar por título, conceito, personagem ou fala…"
                           value="${esc(busca)}" aria-label="Buscar roteiros">
                </div>
                ${clientes.length ? `
                    <select class="rt-cliente-filtro" id="rt-cliente-filtro" aria-label="Filtrar por cliente">
                        <option value="todos" ${clienteFiltro === 'todos' ? 'selected' : ''}>Todos os clientes</option>
                        <option value="" ${clienteFiltro === '' ? 'selected' : ''}>Sem cliente</option>
                        ${clientes.map(c => `<option value="${esc(c.id)}" ${clienteFiltro === c.id ? 'selected' : ''}>${esc(c.nome)}</option>`).join('')}
                    </select>` : ''}
                <div class="dn-filtros" id="rt-formatos">
                    <button class="dn-filtro" data-formato="todos" aria-pressed="false">Todos</button>
                    ${FORMATOS.map(f => `
                        <button class="dn-filtro" data-formato="${f.valor}" aria-pressed="false">
                            ${esc(f.rotulo.split(' / ')[0])}
                        </button>`).join('')}
                </div>
            </section>

            ${roteiros.length ? `
                <p class="dn-apoio rt-conta">
                    <strong>${roteiros.length}</strong> ${roteiros.length === 1 ? 'roteiro' : 'roteiros'} ·
                    <strong>${totalTomadas}</strong> ${totalTomadas === 1 ? 'tomada' : 'tomadas'} no total
                </p>` : ''}

            <div id="rt-grade">${grade(lista, roteiros.length, clientes)}</div>
        `;

        marcarAtivo(document.getElementById('rt-formatos'), 'formato', formato);
        ligarEventos();
        if (window.lucide) lucide.createIcons();
    };

    const ligarEventos = () => {
        const campoBusca = document.getElementById('rt-busca');
        campoBusca.addEventListener('input', (e) => {
            busca = e.target.value;
            // Repinta só a grade: redesenhar a seção inteira tiraria o foco
            // do campo e a pessoa perderia o cursor a cada letra.
            const alvo = document.getElementById('rt-grade');
            alvo.innerHTML = grade(filtrar(), roteiros.length, clientes);
            ligarCartoes();
            if (window.lucide) lucide.createIcons();
        });

        document.getElementById('rt-formatos').addEventListener('click', (e) => {
            const b = e.target.closest('[data-formato]');
            if (!b) return;
            formato = b.dataset.formato;
            marcarAtivo(document.getElementById('rt-formatos'), 'formato', formato);
            trocarSuave(document.getElementById('rt-grade'), () => {
                document.getElementById('rt-grade').innerHTML = grade(filtrar(), roteiros.length, clientes);
                ligarCartoes();
                if (window.lucide) lucide.createIcons();
            });
        });

        document.getElementById('rt-cliente-filtro')?.addEventListener('change', (e) => {
            clienteFiltro = e.target.value;
            trocarSuave(document.getElementById('rt-grade'), () => {
                document.getElementById('rt-grade').innerHTML = grade(filtrar(), roteiros.length, clientes);
                ligarCartoes();
                if (window.lucide) lucide.createIcons();
            });
        });

        document.getElementById('rt-vazio-novo')?.addEventListener('click', abrirNovo);
        ligarCartoes();
    };

    const ligarCartoes = () => {
        document.querySelectorAll('#rt-grade [data-acoes]').forEach(botao => {
            botao.addEventListener('click', (e) => {
                // O cartão inteiro é um link; sem isto, abrir o menu abriria
                // o roteiro junto.
                e.preventDefault();
                e.stopPropagation();
                const r = roteiros.find(x => x.id === botao.dataset.acoes);
                if (r) menuDoCartao(botao, r);
            });
        });
    };

    const menuDoCartao = (ancora, roteiro) => abrirMenu(ancora, [
        { id: 'abrir', label: 'Abrir', icon: 'pen-line',
          onClick: () => navegar(`/roteiro/${roteiro.id}`) },
        { id: 'duplicar', label: 'Duplicar', icon: 'copy', onClick: async () => {
            const copia = structuredClone(roteiro);
            delete copia.criado_em;
            delete copia.atualizado_em;
            await store.roteiros.salvar({
                ...copia, id: crypto.randomUUID(), titulo: `${roteiro.titulo} (cópia)`,
            });
            await recarregar();
            toast('Roteiro duplicado.');
        } },
        { id: 'json', label: 'Exportar JSON', icon: 'file-json', separadorAntes: true,
          onClick: () => exportarJSON(roteiro) },
        { id: 'csv', label: 'Exportar planilha', icon: 'sheet',
          onClick: () => exportarCSV(roteiro) },
        { id: 'excluir', label: 'Excluir', icon: 'trash-2', variante: 'danger', separadorAntes: true,
          onClick: () => confirmarExclusao(roteiro) },
    ]);

    /* Excluir abre o painel lateral em vez de um confirm() do navegador. Um
       roteiro é trabalho de horas e não tem lixeira: a confirmação precisa
       mostrar o que vai embora — título, cenas, tomadas — e exigir o mesmo
       gesto deliberado das outras exclusões do sistema (ver campos.js). */
    const confirmarExclusao = (roteiro) => abrirFormulario({
        titulo: 'Excluir roteiro',
        subtitulo: esc(roteiro.titulo),
        campos: [
            { nome: 'aviso', tipo: 'nota-viva',
              texto: `Vão embora ${(roteiro.cenas || []).length} cena(s) e `
                   + `${contarTomadas(roteiro)} tomada(s). Não há como desfazer.` },
        ],
        valores: roteiro,
        rotuloSalvar: 'Manter roteiro',
        aoSalvar: async () => {},          // o botão principal é o de recuar
        aoExcluir: async () => {
            await store.roteiros.excluir(roteiro.id);
            await recarregar();
            toast('Roteiro excluído.');
        },
    });

    desenhar();
};

// ─────────────────────────────────────────────────────────────────────────
const grade = (lista, totalGeral, clientes) => {
    if (!lista.length) {
        // Dois vazios diferentes: não ter nada escrito ainda é um convite;
        // não achar nada na busca é um resultado. Tratá-los igual faria o
        // botão "criar roteiro" aparecer como resposta a uma busca.
        return totalGeral ? `
            <div class="ds-empty dn-vazio">
                <span class="ds-empty__icon"><i data-lucide="search-x"></i></span>
                <p class="ds-empty__text">Nenhum roteiro corresponde ao filtro.</p>
            </div>` : `
            <div class="ds-empty dn-vazio">
                <span class="ds-empty__icon"><i data-lucide="clapperboard"></i></span>
                <p class="ds-empty__text">
                    Nada escrito ainda.<br>
                    <strong>Comece por um modelo</strong> — dá para trocar tudo depois.
                </p>
                <button class="ds-btn ds-btn--primary ds-btn--sm" id="rt-vazio-novo" style="margin-top: var(--space-4)">
                    <i data-lucide="plus"></i> Novo roteiro
                </button>
            </div>`;
    }

    return `<div class="rt-grade">${lista.map(r => cartao(r, clientes)).join('')}</div>`;
};

const cartao = (r, clientes) => {
    const estimada = duracaoEstimada(r);
    const estado = situacao(estimada, r.duracao_alvo);
    const cenas = (r.cenas || []).length;
    const tomadas = contarTomadas(r);
    const cliente = r.cliente_id ? clientes.find(c => c.id === r.cliente_id) : null;

    return `
    <a class="ds-card ds-card--interactive rt-cartao" href="/roteiro/${esc(r.id)}">
        <div class="rt-cartao__topo">
            <span class="ds-chip">${esc(rotuloFormato(r.formato))}</span>
            <div class="dn-secao__lado">
                <span class="dn-selo dn-selo--sm dn-selo--${estado}" title="Duração estimada · alvo de ${duracao(r.duracao_alvo)}">
                    <i data-lucide="timer"></i> ${duracao(estimada)}
                </span>
                <button class="ds-icon-btn rt-cartao__acoes" data-acoes="${esc(r.id)}"
                        aria-haspopup="menu" aria-expanded="false" aria-label="Ações do roteiro">
                    <i data-lucide="ellipsis"></i>
                </button>
            </div>
        </div>

        <h2 class="ds-card-title rt-cartao__titulo">${esc(r.titulo)}</h2>
        ${cliente ? `
            <span class="rt-cartao__cliente">
                <span class="rt-cartao__ponto" style="background:${esc(cliente.cor || '#A855FF')}"></span>
                ${esc(cliente.nome)}
            </span>` : ''}
        <p class="rt-cartao__conceito">${esc(r.conceito) || '<span class="rt-cartao__mudo">Sem conceito escrito ainda.</span>'}</p>

        <div class="rt-cartao__pe">
            <span><i data-lucide="clapperboard"></i> ${cenas} ${cenas === 1 ? 'cena' : 'cenas'}</span>
            <span><i data-lucide="rows-3"></i> ${tomadas} ${tomadas === 1 ? 'tomada' : 'tomadas'}</span>
            <span><i data-lucide="users"></i> ${(r.personagens || []).length}</span>
            <span class="rt-cartao__quando">${quando(r.atualizado_em || r.criado_em)}</span>
        </div>

        ${r.importado_de ? `<span class="ds-chip ds-chip--accent rt-cartao__origem">importado</span>` : ''}
    </a>`;
};

const ESTILOS = `
<style>
.rt-conta { margin-top: calc(var(--space-1) * -1); }

/* Filtro de cliente: select simples, altura igual à dos filtros de formato
   para não desalinhar a barra. */
.rt-cliente-filtro {
    height: 32px; padding: 0 var(--space-3);
    border: 1px solid var(--border-default); border-radius: var(--radius-pill);
    background: var(--surface-3); color: var(--text-primary);
    font-family: var(--font-sans); font-size: var(--text-sm);
    cursor: pointer;
}

/* Grade que se acomoda sozinha. 300px de mínimo é o ponto em que o título de
   duas linhas e o conceito de três ainda cabem sem virar reticências. */
.rt-grade {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: var(--bento-gap);
}

.rt-cartao {
    position: relative;
    display: flex; flex-direction: column; gap: var(--space-3);
    padding: var(--space-5);
    text-decoration: none;
}
.rt-cartao__topo { display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); }
.rt-cartao__titulo { margin: 0; }

.rt-cartao__cliente {
    display: inline-flex; align-items: center; gap: 6px; align-self: flex-start;
    margin-top: -4px;
    font-size: var(--text-xs); font-weight: 500; color: var(--text-tertiary);
}
.rt-cartao__ponto { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }

/* O conceito ocupa três linhas fixas e corta com reticências. Altura fixa,
   e não automática, porque a grade fica desalinhada quando um cartão tem
   conceito de uma linha e o vizinho tem de quatro. */
.rt-cartao__conceito {
    margin: 0; flex: 1;
    font-size: var(--text-sm); color: var(--text-tertiary);
    line-height: var(--leading-body);
    display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical;
    overflow: hidden;
}
.rt-cartao__mudo { color: var(--text-disabled); font-style: italic; }

.rt-cartao__pe {
    display: flex; align-items: center; gap: var(--space-3); flex-wrap: wrap;
    padding-top: var(--space-3);
    border-top: 1px solid var(--border-subtle);
    font-size: var(--text-xs); color: var(--text-tertiary);
    font-variant-numeric: tabular-nums;
}
.rt-cartao__pe span { display: inline-flex; align-items: center; gap: 5px; }
.rt-cartao__pe i, .rt-cartao__pe svg { width: 12px; height: 12px; }
.rt-cartao__quando { margin-left: auto; }

.rt-cartao__origem { position: absolute; bottom: var(--space-5); right: var(--space-5); }

/* ── Galeria de modelos (painel de novo roteiro) ──────────────────────────
   O fundo é um véu translúcido, e não uma superfície opaca, porque estes
   botões vivem DENTRO do painel de vidro: um bloco sólido no meio da
   translucidez lê como buraco. É a mesma receita dos campos do drawer, e
   por isso carrega o mesmo par de valores — o véu branco some sobre vidro
   claro, então o tema claro escurece em vez de clarear (ver o fim de
   tokens-bridge.css). */
.nv-modelos { display: flex; flex-direction: column; gap: var(--space-2); }
.nv-modelo {
    display: flex; align-items: flex-start; gap: var(--space-3);
    padding: var(--space-3);
    border: 1px solid var(--glass-border); border-radius: var(--radius-md);
    background: rgba(255, 255, 255, 0.04);
    font-family: var(--font-sans); text-align: left; cursor: pointer;
    transition: border-color var(--dur-fast), background-color var(--dur-fast);
}
.nv-modelo:hover { border-color: var(--border-strong); }
.nv-modelo.is-active { border-color: var(--accent-border); background: var(--accent-muted); }
.nv-modelo__icone {
    width: 30px; height: 30px; flex-shrink: 0;
    display: inline-flex; align-items: center; justify-content: center;
    border-radius: var(--radius-sm);
    background: var(--surface-3); color: var(--text-secondary);
}
.nv-modelo.is-active .nv-modelo__icone { background: var(--accent-muted); color: var(--accent); }
.nv-modelo__icone i, .nv-modelo__icone svg { width: 15px; height: 15px; }
.nv-modelo__texto { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.nv-modelo__texto b { font-size: var(--text-sm); font-weight: 600; color: var(--text-primary); }
.nv-modelo__texto small { font-size: var(--text-xs); color: var(--text-tertiary); line-height: var(--leading-body); }
html[data-theme="light"] .nv-modelo { background: rgba(13, 13, 13, 0.04); }
html[data-theme="light"] .nv-modelo.is-active { background: var(--accent-muted); }
</style>
`;
