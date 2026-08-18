import { store } from '../store.js';
import { renderShell } from '../components/pageshell.js';
import { abrirFormulario } from '../components/campos.js';
import { openDrawer, closeDrawer } from '../components/drawer.js';
import { toast } from '../components/toast.js';
import { esc, iniciais } from '../lib/formato.js';
import { lerCartela, chaveNome } from '../lib/gestor.js';

/* ═══════════════════════════════════════════════════════════════════════════
   CADASTROS — os clientes do estúdio.

   Lista curta por natureza (dezenas, não milhares), então sem busca nem
   paginação — o que existe cabe na tela, como no Gestor.

   Um roteiro pode existir sem cliente (peça institucional, teste, exercício)
   — por isso "Cliente" nunca é obrigatório em lugar nenhum que o use. Este
   cadastro serve só para dar nome a quem TEM cliente, e para a ponte com o
   Chronos ter para onde copiar o que traz de lá.
   ═══════════════════════════════════════════════════════════════════════════ */

/* Paleta de identificação, tirada da sequência de dados do design system.
   Mesma lista do Gestor — não carrega significado, só dá rosto às iniciais. */
const CORES = ['#A855FF', '#FF7A45', '#4FD1FF', '#FFC96B', '#3DDC97', '#D45AC0'];
const corSugerida = (quantos) => CORES[quantos % CORES.length];

export const renderCadastros = async (container) => {
    let clientes = await store.clientes.listar();

    const { content } = renderShell(container, {
        path: '/cadastros',
        title: 'Cadastros',
        subtitle: 'Os clientes para quem o estúdio escreve.',
        actions: `
            <button class="ds-btn ds-btn--ghost" id="cd-gestor">
                <i data-lucide="download"></i> Trazer do Gestor
            </button>
            <button class="ds-btn ds-btn--primary" id="cd-novo">
                <i data-lucide="plus"></i> Novo cliente
            </button>`,
    });

    container.insertAdjacentHTML('beforeend', ESTILOS);

    const recarregar = async () => {
        store.limparCache();
        clientes = await store.clientes.listar();
        desenhar();
    };

    const abrirCliente = (cl = null) => abrirFormulario({
        titulo: cl ? 'Editar cliente' : 'Novo cliente',
        subtitulo: cl ? esc(cl.nome) : 'Quem esta peça é para',
        campos: [
            { nome: 'nome', rotulo: 'Nome', obrigatorio: true, placeholder: 'Instituto Dr. Tigre' },
            { nome: 'empresa', rotulo: 'Empresa ou marca', largura: 'metade' },
            { nome: 'cor', rotulo: 'Cor', tipo: 'cor', largura: 'metade' },
            { nome: 'nota', rotulo: 'Anotação interna', tipo: 'textarea' },
        ],
        valores: cl || { cor: corSugerida(clientes.length) },
        aoSalvar: async (dados) => {
            await store.clientes.salvar(dados);
            await recarregar();
            toast(cl ? 'Cliente atualizado.' : 'Cliente cadastrado.');
        },
        aoExcluir: cl ? async () => {
            /* Roteiros deste cliente NÃO são apagados nem perdem o texto —
               só o vínculo, que passa a mostrar "sem cliente". Apagar um
               cadastro não pode custar um roteiro inteiro. */
            await store.clientes.excluir(cl.id);
            const afetados = (await store.roteiros.listar()).filter(r => r.cliente_id === cl.id);
            for (const r of afetados) await store.roteiros.salvar({ ...r, cliente_id: null });
            await recarregar();
            toast(afetados.length
                ? `Cliente excluído. ${afetados.length} roteiro(s) ficaram sem cliente.`
                : 'Cliente excluído.');
        } : null,
    });

    document.getElementById('cd-novo').addEventListener('click', () => abrirCliente());
    document.getElementById('cd-gestor').addEventListener('click', () => abrirCartela(clientes, recarregar));

    const desenhar = () => {
        content.innerHTML = `
            <article class="ds-card dn-secao">
                <div class="dn-secao__cabeca">
                    <div>
                        <h2 class="ds-card-title">Clientes</h2>
                        <span class="ds-card-sub">${clientes.length} cadastrado${clientes.length === 1 ? '' : 's'}</span>
                    </div>
                </div>
                ${clientes.length ? `
                    <div class="cd-lista" id="cd-lista">
                        ${clientes.map(c => `
                            <button class="cd-linha" data-cliente="${esc(c.id)}">
                                <span class="cd-linha__marca" style="background:${esc(c.cor || '#A855FF')}22;color:${esc(c.cor || '#A855FF')}">
                                    ${esc(iniciais(c.nome))}
                                </span>
                                <div class="cd-linha__info">
                                    <p class="cd-linha__titulo">${esc(c.nome)}</p>
                                    <p class="cd-linha__meta">${esc(c.empresa || 'Sem empresa')}</p>
                                </div>
                                <i data-lucide="chevron-right" class="cd-seta"></i>
                            </button>`).join('')}
                    </div>` : `
                    <div class="ds-empty dn-vazio">
                        <span class="ds-empty__icon"><i data-lucide="building-2"></i></span>
                        <p class="ds-empty__text">
                            Nenhum cliente cadastrado.<br>
                            <strong>Cadastre um</strong> ou traga a lista do Gestor.
                        </p>
                    </div>`}
            </article>
        `;

        content.querySelectorAll('[data-cliente]').forEach(el => el.addEventListener('click',
            () => abrirCliente(clientes.find(c => c.id === el.dataset.cliente))));

        if (window.lucide) lucide.createIcons();
    };

    desenhar();
};

/**
 * A cartela do Gestor, para copiar quem ainda não está aqui.
 *
 * Idêntico ao fluxo que o 5K9 Chronos já oferece para a mesma ponte: compara
 * por nome normalizado (bancos diferentes, ids sem relação nenhuma), mostra
 * quem falta, deixa desmarcar antes de copiar.
 */
async function abrirCartela(jaTenho, aoTerminar) {
    const painel = openDrawer({
        title: 'Trazer do Gestor',
        subtitle: 'A cartela de clientes do estúdio',
        body: `<p class="ds-hint"><i data-lucide="loader"></i> Lendo a cartela…</p>`,
        footer: `<span style="flex:1"></span>
                 <button class="ds-btn ds-btn--ghost" id="ct-fechar">Fechar</button>`,
    });
    painel.querySelector('#ct-fechar').addEventListener('click', closeDrawer);

    let cartela;
    try {
        cartela = await lerCartela();
    } catch (e) {
        painel.querySelector('.dw__body').innerHTML =
            `<p class="ds-hint ds-hint--aviso"><i data-lucide="triangle-alert"></i> ${esc(e.message)}</p>`;
        if (window.lucide) lucide.createIcons();
        return;
    }

    const conhecido = new Set(jaTenho.map(c => chaveNome(c.nome)));
    const novos = cartela.clientes.filter(c => !conhecido.has(chaveNome(c.nome)));

    painel.querySelector('.dw__body').innerHTML = `
        <p class="dn-apoio">
            <strong>${cartela.clientes.length}</strong> clientes no Gestor.
            ${novos.length
                ? `<strong>${novos.length}</strong> ainda não estão aqui.`
                : 'Todos já estão aqui.'}
        </p>

        ${novos.length ? `
            <div class="dn-marcaveis">
                ${novos.map((c, i) => `
                    <label class="dn-marcavel">
                        <input type="checkbox" data-cliente="${i}" checked>
                        <span class="dn-marcavel__info">
                            <span class="dn-marcavel__nome">${esc(c.nome)}</span>
                            ${c.empresa ? `<span class="dn-marcavel__meta">${esc(c.empresa)}</span>` : ''}
                        </span>
                    </label>`).join('')}
            </div>
            <button class="ds-btn ds-btn--primary" id="ct-copiar">
                <i data-lucide="download"></i> Copiar selecionados
            </button>
            <p class="ds-hint">
                <i data-lucide="info"></i>
                O que vem do Gestor é só o nome, a empresa e a cor.
            </p>` : ''}
    `;

    painel.querySelector('#ct-copiar')?.addEventListener('click', async (e) => {
        const b = e.target.closest('button');
        const marcados = [...painel.querySelectorAll('[data-cliente]:checked')]
            .map(cx => novos[Number(cx.dataset.cliente)]);
        if (!marcados.length) { closeDrawer(); return; }

        b.disabled = true;
        b.textContent = 'Copiando…';
        for (const c of marcados) {
            await store.clientes.salvar({ nome: c.nome, empresa: c.empresa || null, cor: c.cor || '#A855FF' });
        }
        closeDrawer();
        toast(`${marcados.length} cliente(s) copiado(s) do Gestor.`);
        aoTerminar();
    });

    if (window.lucide) lucide.createIcons();
}

const ESTILOS = `
<style>
.cd-lista { display: flex; flex-direction: column; gap: var(--space-2); }
.cd-linha {
    display: flex; align-items: center; gap: var(--space-4);
    width: 100%; padding: var(--space-3) var(--space-4);
    border: 1px solid var(--border-subtle); border-radius: var(--radius-md);
    background: var(--surface-3);
    font-family: var(--font-sans); text-align: left; cursor: pointer;
    transition: border-color var(--dur-fast), background-color var(--dur-fast);
}
.cd-linha:hover { border-color: var(--border-default); background: var(--surface-4); }
.cd-linha__marca {
    width: 38px; height: 38px; flex-shrink: 0; border-radius: var(--radius-sm);
    display: inline-flex; align-items: center; justify-content: center;
    font-size: var(--text-xs); font-weight: 700;
}
.cd-linha__info { min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 2px; }
.cd-linha__titulo { font-size: var(--text-body); font-weight: 600; color: var(--text-primary); margin: 0; }
.cd-linha__meta { font-size: var(--text-xs); color: var(--text-tertiary); margin: 0; }
.cd-seta { width: 15px; height: 15px; color: var(--text-tertiary); flex-shrink: 0; }
</style>
`;
