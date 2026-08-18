import { store } from '../store.js';
import { openDrawer, closeDrawer } from '../components/drawer.js';
import { toast } from '../components/toast.js';
import { esc, dataBR } from '../lib/formato.js';
import { chaveNome } from '../lib/gestor.js';
import { novoRoteiro, novaCena, novaTomada } from '../lib/roteiro.js';
import {
    PONTE_LIGADA, sessaoChronos, entrarChronos, sairChronos,
    lerClientesChronos, lerConteudosChronos,
} from '../lib/chronos.js';

/* ═══════════════════════════════════════════════════════════════════════════
   IMPORTAR DO CHRONOS — trazer um tema ou roteiro já escrito lá.

   Três telas dentro do mesmo painel: entrar, escolher o cliente, escolher o
   que trazer. A sessão (ver lib/chronos.js) fica salva entre uma importação e
   outra — só a primeira vez pede login.

   ── A CONVERSÃO DE BLOCOS PARA CENAS/TOMADAS ──────────────────────────────
   O Chronos escreve em blocos soltos (gancho, fala, frase, seção, bloco
   livre, CTA, orientação) — pensado para post e Reels de rede social, sem
   separação entre vídeo e áudio. O Dionísio decupa em cena → tomada, com
   vídeo e áudio lado a lado — pensado para quem vai gravar.

   A tradução é literal e não tenta ser esperta:
     · um bloco de SEÇÃO abre uma cena nova, com o título da seção;
     · um bloco de ORIENTAÇÃO (não falado) vira o lado do VÍDEO de uma tomada
       — é instrução de câmera, é o que a coluna de vídeo já significa aqui;
     · qualquer outro bloco (gancho, fala, frase, bloco livre, CTA) vira o
       lado do ÁUDIO de uma tomada — é o que sai pela boca.

   Cada bloco vira UMA tomada própria, nunca dois blocos costurados numa
   linha só. Juntar uma orientação com a fala que vem depois pareceria mais
   "pronto", mas seria uma decisão de decupagem inventada por este código —
   e decupar é trabalho de quem produz, não do importador. Uma tomada com só
   vídeo ou só áudio preenchidos é um convite explícito a completar o outro
   lado, não um defeito a esconder.
   ═══════════════════════════════════════════════════════════════════════════ */

const ROTULO_STATUS = {
    rascunho: { texto: 'rascunho', variante: '' },
    em_revisao: { texto: 'em revisão', variante: 'ds-chip--warning' },
    aprovado: { texto: 'aprovado', variante: 'ds-chip--success' },
    ajuste: { texto: 'pediu ajuste', variante: 'ds-chip--danger' },
    publicado: { texto: 'publicado', variante: 'ds-chip--accent' },
};

/** Converte os blocos de um conteúdo do Chronos em cenas/tomadas. */
const converterBlocos = (blocos) => {
    const ordenados = [...(blocos || [])].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
    const cenas = [];
    let atual = null;

    const garantirCena = () => {
        if (!atual) { atual = novaCena({ titulo: 'CENA 1' }); atual.tomadas = []; cenas.push(atual); }
        return atual;
    };

    for (const b of ordenados) {
        const texto = String(b.texto || b.titulo || '').trim();
        if (!texto) continue;

        if (b.tipo === 'secao') {
            atual = novaCena({ titulo: (b.titulo || texto || 'CENA').toUpperCase() });
            atual.tomadas = [];
            cenas.push(atual);
            continue;
        }

        const cena = garantirCena();
        const html = esc(texto).replace(/\n/g, '<br>');
        cena.tomadas.push(novaTomada(
            b.tipo === 'nota' ? { video: html } : { audio: html },
        ));
    }

    return cenas.filter(c => c.tomadas.length);
};

/** Ponto de entrada: abre o painel e conduz as três etapas. */
export const abrirImportarChronos = async (clientesLocais, aoImportar) => {
    if (!PONTE_LIGADA) {
        toast('A ponte com o Chronos está desligada. Preencha CHRONOS_URL e CHRONOS_ANON em lib/chronos.js.');
        return;
    }

    const painel = openDrawer({
        title: 'Trazer do Chronos',
        subtitle: 'Um tema ou roteiro já escrito lá',
        body: `<p class="ds-hint"><i data-lucide="loader"></i> Verificando sessão…</p>`,
        footer: `<span style="flex:1"></span>
                 <button class="ds-btn ds-btn--ghost" id="ic-fechar">Fechar</button>`,
    });
    painel.querySelector('#ic-fechar').addEventListener('click', closeDrawer);

    const sessao = await sessaoChronos().catch(() => null);
    if (sessao) telaClientes(painel, clientesLocais, aoImportar, sessao);
    else telaLogin(painel, clientesLocais, aoImportar);
};

// ── Etapa 1: login ──────────────────────────────────────────────────────
function telaLogin(painel, clientesLocais, aoImportar) {
    painel.querySelector('.dw__body').innerHTML = `
        <p class="ds-hint">
            <i data-lucide="info"></i>
            Entre com a mesma conta que você usa no 5K9 Chronos. É a sessão de lá que decide
            o que pode ser lido — nada aqui fica salvo sem ela.
        </p>
        <form class="ic-login" id="ic-login">
            <label class="ic-campo">
                <span>E-mail</span>
                <input class="ds-input" type="email" id="ic-email" required autocomplete="username">
            </label>
            <label class="ic-campo">
                <span>Senha</span>
                <input class="ds-input" type="password" id="ic-senha" required autocomplete="current-password">
            </label>
            <p class="ic-erro" id="ic-erro" hidden></p>
            <button class="ds-btn ds-btn--primary" type="submit" id="ic-entrar">Entrar</button>
        </form>
    `;
    if (window.lucide) lucide.createIcons();

    const form = painel.querySelector('#ic-login');
    const erro = painel.querySelector('#ic-erro');
    const botao = painel.querySelector('#ic-entrar');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        erro.hidden = true;
        botao.disabled = true;
        botao.textContent = 'Entrando…';

        const { error } = await entrarChronos(
            painel.querySelector('#ic-email').value.trim(),
            painel.querySelector('#ic-senha').value,
        );

        if (error) {
            erro.textContent = /invalid/i.test(error.message)
                ? 'E-mail ou senha incorretos.' : 'Não foi possível entrar. Tente de novo.';
            erro.hidden = false;
            botao.disabled = false;
            botao.textContent = 'Entrar';
            return;
        }
        telaClientes(painel, clientesLocais, aoImportar, await sessaoChronos());
    });
}

// ── Etapa 2: escolher o cliente ─────────────────────────────────────────
async function telaClientes(painel, clientesLocais, aoImportar, sessao) {
    painel.querySelector('.dw__body').innerHTML =
        `<p class="ds-hint"><i data-lucide="loader"></i> Lendo os clientes do Chronos…</p>`;

    let clientesChronos;
    try {
        clientesChronos = await lerClientesChronos();
    } catch (e) {
        painel.querySelector('.dw__body').innerHTML =
            `<p class="ds-hint ds-hint--aviso"><i data-lucide="triangle-alert"></i> ${esc(e.message)}</p>`;
        if (window.lucide) lucide.createIcons();
        return;
    }

    painel.querySelector('.dw__body').innerHTML = `
        <p class="ic-sessao">
            <i data-lucide="user-check"></i> ${esc(sessao?.email || '')}
            <button class="ic-sair" id="ic-sair">sair</button>
        </p>
        ${clientesChronos.length ? `
            <div class="dn-marcaveis">
                ${clientesChronos.map(c => `
                    <button class="dn-marcavel ic-cliente" data-chronos="${esc(c.id)}">
                        <span class="dn-marcavel__info">
                            <span class="dn-marcavel__nome">${esc(c.nome)}</span>
                            ${c.empresa ? `<span class="dn-marcavel__meta">${esc(c.empresa)}</span>` : ''}
                        </span>
                        <i data-lucide="chevron-right"></i>
                    </button>`).join('')}
            </div>` : `
            <p class="ds-hint"><i data-lucide="info"></i> Não há clientes cadastrados no Chronos.</p>`}
    `;
    if (window.lucide) lucide.createIcons();

    painel.querySelector('#ic-sair').addEventListener('click', async () => {
        await sairChronos();
        telaLogin(painel, clientesLocais, aoImportar);
    });

    painel.querySelectorAll('[data-chronos]').forEach(b => b.addEventListener('click', () => {
        const cl = clientesChronos.find(c => c.id === b.dataset.chronos);
        telaConteudos(painel, clientesLocais, aoImportar, cl, () =>
            telaClientes(painel, clientesLocais, aoImportar, sessao));
    }));
}

// ── Etapa 3: escolher o que trazer ──────────────────────────────────────
async function telaConteudos(painel, clientesLocais, aoImportar, clienteChronos, aoVoltar) {
    painel.querySelector('.dw__title').textContent = clienteChronos.nome;
    painel.querySelector('.dw__body').innerHTML =
        `<p class="ds-hint"><i data-lucide="loader"></i> Lendo temas e roteiros…</p>`;

    let conteudos;
    try {
        conteudos = await lerConteudosChronos(clienteChronos.id);
    } catch (e) {
        painel.querySelector('.dw__body').innerHTML =
            `<p class="ds-hint ds-hint--aviso"><i data-lucide="triangle-alert"></i> ${esc(e.message)}</p>`;
        if (window.lucide) lucide.createIcons();
        return;
    }

    painel.querySelector('.dw__body').innerHTML = `
        <button class="ic-voltar" id="ic-voltar"><i data-lucide="arrow-left"></i> Outro cliente</button>
        ${conteudos.length ? `
            <div class="dn-marcaveis">
                ${conteudos.map((c, i) => {
                    const st = ROTULO_STATUS[c.status] || ROTULO_STATUS.rascunho;
                    return `
                    <label class="dn-marcavel">
                        <input type="checkbox" data-conteudo="${i}">
                        <span class="dn-marcavel__info">
                            <span class="dn-marcavel__nome">${esc(c.titulo || c.tema || 'Sem título')}</span>
                            <span class="dn-marcavel__meta">
                                ${c.tema ? `${esc(c.tema)} · ` : ''}${dataBR(c.data)} ·
                                ${c.blocos.length} bloco${c.blocos.length === 1 ? '' : 's'}
                            </span>
                        </span>
                        <span class="ds-chip ${st.variante}">${st.texto}</span>
                    </label>`;
                }).join('')}
            </div>
            <button class="ds-btn ds-btn--primary" id="ic-importar" disabled>
                <i data-lucide="download"></i> Importar selecionados
            </button>
            <p class="ds-hint">
                <i data-lucide="info"></i>
                Cada um vira um roteiro novo em rascunho. As seções do Chronos viram cenas; cada
                bloco vira uma tomada, do lado de vídeo ou de áudio conforme o tipo — a decupagem
                fina continua sendo trabalho de quem produz.
            </p>` : `
            <p class="ds-hint"><i data-lucide="info"></i> Este cliente ainda não tem tema nem roteiro no Chronos.</p>`}
    `;
    if (window.lucide) lucide.createIcons();

    painel.querySelector('#ic-voltar').addEventListener('click', aoVoltar);

    const botaoImportar = painel.querySelector('#ic-importar');
    const caixas = painel.querySelectorAll('[data-conteudo]');
    caixas.forEach(cx => cx.addEventListener('change', () => {
        if (botaoImportar) botaoImportar.disabled = ![...caixas].some(x => x.checked);
    }));

    botaoImportar?.addEventListener('click', async (e) => {
        const b = e.target.closest('button');
        const marcados = [...caixas].filter(cx => cx.checked).map(cx => conteudos[Number(cx.dataset.conteudo)]);
        if (!marcados.length) return;

        b.disabled = true;
        b.textContent = 'Importando…';

        const clienteId = await encontrarOuCopiarCliente(clientesLocais, clienteChronos);

        let ultimoId = null;
        for (const c of marcados) {
            const cenas = converterBlocos(c.blocos);
            const roteiro = novoRoteiro({
                titulo: c.titulo || c.tema || 'Roteiro sem título',
                cliente_id: clienteId,
                conceito: c.intencao || c.tema || '',
                cenas: cenas.length ? cenas : undefined,
                importado_de: 'chronos',
            });
            const salvo = await store.roteiros.salvar(roteiro);
            ultimoId = salvo.id;
        }

        closeDrawer();
        toast(marcados.length === 1 ? 'Roteiro importado.' : `${marcados.length} roteiros importados.`);
        await aoImportar(marcados.length === 1 ? ultimoId : null);
    });
}

/**
 * Garante que o cliente do Chronos tenha um par local, criando-o se faltar.
 * Comparação por nome normalizado — os dois sistemas vivem em bancos
 * diferentes, sem id em comum (ver chaveNome em lib/gestor.js).
 */
async function encontrarOuCopiarCliente(clientesLocais, clienteChronos) {
    const chave = chaveNome(clienteChronos.nome);
    const existente = clientesLocais.find(c => chaveNome(c.nome) === chave);
    if (existente) return existente.id;

    const criado = await store.clientes.salvar({
        nome: clienteChronos.nome,
        empresa: clienteChronos.empresa || null,
        cor: clienteChronos.cor || '#A855FF',
    });
    clientesLocais.push(criado);   // a lista em mãos de quem chamou também atualiza
    return criado.id;
}

const ESTILOS_ID = 'importar-chronos-styles';
if (!document.getElementById(ESTILOS_ID)) {
    const style = document.createElement('style');
    style.id = ESTILOS_ID;
    style.textContent = `
        .ic-login { display: flex; flex-direction: column; gap: var(--space-4); }
        .ic-campo { display: flex; flex-direction: column; gap: var(--space-2); }
        .ic-campo span { font-size: var(--text-sm); font-weight: 500; color: var(--text-secondary); }
        .ic-erro {
            margin: 0; padding: var(--space-3) var(--space-4);
            background: var(--danger-muted); border-radius: var(--radius-md);
            font-size: var(--text-sm); color: var(--danger);
        }
        .ic-erro[hidden] { display: none; }

        .ic-sessao {
            display: flex; align-items: center; gap: var(--space-2);
            margin: 0 0 var(--space-4);
            font-size: var(--text-xs); color: var(--text-tertiary);
        }
        .ic-sessao i, .ic-sessao svg { width: 13px; height: 13px; }
        .ic-sair {
            margin-left: auto; padding: 0; border: none; background: none;
            color: var(--text-tertiary); font-size: var(--text-xs); text-decoration: underline;
            cursor: pointer;
        }
        .ic-sair:hover { color: var(--text-primary); }

        .ic-voltar {
            display: inline-flex; align-items: center; gap: var(--space-2);
            margin-bottom: var(--space-4); padding: 0; border: none; background: none;
            color: var(--text-tertiary); font-family: var(--font-sans); font-size: var(--text-sm);
            cursor: pointer;
        }
        .ic-voltar:hover { color: var(--text-primary); }
        .ic-voltar i, .ic-voltar svg { width: 14px; height: 14px; }

        .ic-cliente {
            width: 100%; border: none; background: none;
            font-family: var(--font-sans); cursor: pointer;
        }
        .ic-cliente i, .ic-cliente svg { width: 15px; height: 15px; color: var(--text-tertiary); flex-shrink: 0; }
    `;
    document.head.appendChild(style);
}
