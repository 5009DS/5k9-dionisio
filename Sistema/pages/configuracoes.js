import { store } from '../store.js';
import { renderShell } from '../components/pageshell.js';
import { toast } from '../components/toast.js';
import { theme } from '../theme.js';
import { hoje, duracao } from '../lib/formato.js';
import { duracaoEstimada, contarTomadas } from '../lib/duracao.js';
import { MODELOS, modeloPorId } from '../seed/modelos.js';
import { novoRoteiro } from '../lib/roteiro.js';

/* ═══════════════════════════════════════════════════════════════════════════
   CONFIGURAÇÕES — conexão, cópia de segurança e aparência.

   A seção de conexão vem primeiro porque é a que tem consequência: em modo
   local os roteiros são deste navegador e de mais ninguém. Quem abrir o
   sistema pela primeira vez precisa esbarrar nessa informação antes de
   escrever a tarde inteira achando que o time está vendo.
   ═══════════════════════════════════════════════════════════════════════════ */

export const renderConfiguracoes = async (container) => {
    const roteiros = await store.roteiros.listar();
    const tomadas = roteiros.reduce((t, r) => t + contarTomadas(r), 0);
    const segundos = roteiros.reduce((t, r) => t + duracaoEstimada(r), 0);

    const { content } = renderShell(container, {
        path: '/configuracoes',
        title: 'Configurações',
        subtitle: 'Conexão, cópia de segurança e aparência.',
    });

    container.insertAdjacentHTML('beforeend', ESTILOS);

    const local = store.modo === 'local';

    content.innerHTML = `
        <!-- ══ Conexão ═══════════════════════════════════════════════════ -->
        <article class="ds-card ${local ? '' : 'ds-card--lit'} dn-secao">
            <div class="dn-secao__cabeca">
                <div>
                    <h2 class="ds-card-title">Onde os roteiros estão</h2>
                    <span class="ds-card-sub">${local ? 'Apenas neste navegador' : 'Supabase — compartilhado com o time'}</span>
                </div>
                <span class="ds-chip ${local ? 'ds-chip--warning' : 'ds-chip--success'}">
                    ${local ? 'modo local' : 'conectado'}
                </span>
            </div>

            ${local ? `
                <p class="cf-texto">
                    Tudo que você escrever fica salvo <strong>neste navegador</strong>. Ninguém mais
                    do time enxerga, limpar o cache apaga os roteiros, e o computador de casa não vê
                    o que foi escrito no do estúdio.
                </p>
                <ol class="cf-passos">
                    <li>Crie um projeto novo em <code>supabase.com</code> — separado do Forms e do Gestor.</li>
                    <li>No <b>SQL Editor</b>, cole e rode o conteúdo de <code>Sistema/db/schema.sql</code>.</li>
                    <li>Em <b>Authentication → Users → Add user</b>, crie o acesso de cada pessoa do time.</li>
                    <li>Em <b>Settings → API</b>, copie a <i>Project URL</i> e a chave <code>anon</code>.</li>
                    <li>Cole as duas em <code>Sistema/lib/supabase-config.js</code> e recarregue.</li>
                </ol>
                <p class="ds-hint ds-hint--aviso">
                    <i data-lucide="triangle-alert"></i>
                    Antes de conectar, exporte o que já escreveu aqui — a troca de modo não leva
                    nada junto. Depois de conectado, use "Importar" para subir o arquivo.
                </p>
            ` : `
                <p class="cf-texto">
                    Os roteiros vivem no Supabase e são os mesmos para todo o time. O acesso exige
                    login, e as políticas de segurança do banco (RLS) recusam qualquer leitura sem
                    sessão — não existe tela pública neste sistema.
                </p>
            `}
        </article>

        <!-- ══ Conteúdo ══════════════════════════════════════════════════ -->
        <article class="ds-card dn-secao">
            <div class="dn-secao__cabeca">
                <div>
                    <h2 class="ds-card-title">O que está escrito</h2>
                    <span class="ds-card-sub">${duracao(segundos)} de material estimado, somando tudo</span>
                </div>
            </div>
            <div class="cf-numeros">
                <div class="cf-numero">
                    <span class="cf-numero__valor">${roteiros.length}</span>
                    <span class="cf-numero__rotulo">roteiros</span>
                </div>
                <div class="cf-numero">
                    <span class="cf-numero__valor">${roteiros.reduce((t, r) => t + (r.cenas || []).length, 0)}</span>
                    <span class="cf-numero__rotulo">cenas</span>
                </div>
                <div class="cf-numero">
                    <span class="cf-numero__valor">${tomadas}</span>
                    <span class="cf-numero__rotulo">tomadas</span>
                </div>
            </div>
        </article>

        <!-- ══ Cópia de segurança ════════════════════════════════════════ -->
        <article class="ds-card dn-secao">
            <div class="dn-secao__cabeca">
                <div>
                    <h2 class="ds-card-title">Cópia de segurança</h2>
                    <span class="ds-card-sub">Um arquivo JSON com todos os roteiros</span>
                </div>
            </div>
            <div class="cf-acoes">
                <button class="ds-btn ds-btn--ghost" id="cf-exportar">
                    <i data-lucide="download"></i> Exportar tudo
                </button>
                <button class="ds-btn ds-btn--ghost" id="cf-importar">
                    <i data-lucide="upload"></i> Importar arquivo
                </button>
                <input type="file" id="cf-arquivo" accept="application/json" hidden>
            </div>
            <p class="ds-hint">
                <i data-lucide="info"></i>
                A importação daqui <strong>substitui</strong> todos os roteiros pelos do arquivo.
                Para acrescentar um roteiro sem apagar os outros, use o botão
                <strong>Importar</strong> da tela de roteiros — ele soma em vez de trocar, e também
                aceita arquivos do AutoScript antigo.
            </p>
        </article>

        <!-- ══ Aparência ═════════════════════════════════════════════════ -->
        <article class="ds-card dn-secao">
            <div class="dn-secao__cabeca">
                <div>
                    <h2 class="ds-card-title">Aparência</h2>
                    <span class="ds-card-sub">A escolha vale também para o Forms e o Gestor</span>
                </div>
            </div>
            <div class="cf-acoes">
                <button class="ds-btn ds-btn--ghost" id="cf-tema">
                    <i data-lucide="${theme.get() === 'dark' ? 'sun' : 'moon'}"></i>
                    ${theme.get() === 'dark' ? 'Mudar para o modo claro' : 'Mudar para o modo escuro'}
                </button>
            </div>
            <p class="ds-hint">
                <i data-lucide="info"></i>
                O PDF sai sempre em papel branco com tinta preta, independente do tema —
                um roteiro impresso em fundo escuro gasta a impressora e sai ilegível.
            </p>
        </article>

        <!-- ══ Zona de testes ════════════════════════════════════════════ -->
        <article class="ds-card dn-secao">
            <div class="dn-secao__cabeca">
                <div>
                    <h2 class="ds-card-title">Zona de testes</h2>
                    <span class="ds-card-sub">Para conhecer a ferramenta antes de usar de verdade</span>
                </div>
            </div>
            <div class="cf-acoes">
                <button class="ds-btn ds-btn--ghost" id="cf-exemplo">
                    <i data-lucide="sparkles"></i> Criar um roteiro de cada modelo
                </button>
                <button class="ds-btn ds-btn--ghost cf-perigo" id="cf-limpar">
                    <i data-lucide="trash-2"></i> Apagar todos os roteiros
                </button>
            </div>
            <p class="ds-hint">
                <i data-lucide="info"></i>
                Os roteiros de exemplo nascem como qualquer outro: pode editar, exportar e excluir
                um por um. <strong>Apagar todos</strong> não distingue exemplo de trabalho de
                verdade, e não tem volta.
            </p>
        </article>
    `;

    // ── Exportar ────────────────────────────────────────────────────────
    document.getElementById('cf-exportar').addEventListener('click', async () => {
        const pacote = await store.exportar();
        const blob = new Blob([JSON.stringify(pacote, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `5k9-dionisio-${hoje()}.json`;
        a.click();
        // Sem o revoke o blob fica preso na memória da aba até recarregar.
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        toast('Arquivo exportado.');
    });

    // ── Importar ────────────────────────────────────────────────────────
    const arquivo = document.getElementById('cf-arquivo');
    document.getElementById('cf-importar').addEventListener('click', () => arquivo.click());
    arquivo.addEventListener('change', async () => {
        const f = arquivo.files?.[0];
        if (!f) return;
        try {
            const pacote = JSON.parse(await f.text());
            if (!pacote || typeof pacote !== 'object' || !Array.isArray(pacote.roteiros)) {
                throw new Error('Este arquivo não parece uma exportação do 5K9 Dionísio. Para um roteiro solto, use o botão Importar da tela de roteiros.');
            }
            await store.importar(pacote);
            toast('Roteiros importados.');
            renderConfiguracoes(container);
        } catch (e) {
            console.error('[configuracoes] importação falhou:', e);
            toast(e.message || 'Não foi possível ler o arquivo.');
        } finally {
            // Zera o input: escolher o MESMO arquivo de novo não dispara
            // 'change' se o valor não mudar, e a segunda tentativa parecia
            // travada.
            arquivo.value = '';
        }
    });

    // ── Tema ────────────────────────────────────────────────────────────
    document.getElementById('cf-tema').addEventListener('click', () => {
        theme.alternar();
        renderConfiguracoes(container);
    });

    // ── Exemplos / limpeza ──────────────────────────────────────────────
    document.getElementById('cf-exemplo').addEventListener('click', async (e) => {
        // closest: o clique costuma cair no <i> do ícone, e desabilitar o
        // ícone não impede o segundo clique de disparar tudo de novo.
        const b = e.target.closest('button');
        b.disabled = true;
        b.textContent = 'Criando…';
        for (const m of MODELOS) {
            const base = modeloPorId(m.id).roteiro;
            await store.roteiros.salvar(novoRoteiro({
                ...structuredClone(base),
                titulo: `Exemplo — ${m.nome}`,
            }));
        }
        toast(`${MODELOS.length} roteiros de exemplo criados.`);
        renderConfiguracoes(container);
    });

    const btnLimpar = document.getElementById('cf-limpar');
    btnLimpar.addEventListener('click', async () => {
        // Dois toques no próprio botão, como no painel de edição: um
        // confirm() nativo é fácil demais de dispensar no automático.
        if (btnLimpar.dataset.confirmando !== 'sim') {
            btnLimpar.dataset.confirmando = 'sim';
            btnLimpar.classList.add('cf-perigo--confirma');
            btnLimpar.innerHTML = `Confirmar: apagar ${roteiros.length} roteiro(s)`;
            setTimeout(() => {
                if (!btnLimpar.isConnected) return;
                btnLimpar.dataset.confirmando = '';
                btnLimpar.classList.remove('cf-perigo--confirma');
                btnLimpar.innerHTML = '<i data-lucide="trash-2"></i> Apagar todos os roteiros';
                if (window.lucide) lucide.createIcons();
            }, 5000);
            return;
        }
        await store.roteiros.substituir([]);
        toast('Todos os roteiros foram apagados.');
        renderConfiguracoes(container);
    });

    if (window.lucide) lucide.createIcons();
};

const ESTILOS = `
<style>
.cf-texto { margin: 0; font-size: var(--text-body); color: var(--text-secondary); line-height: var(--leading-body); max-width: 68ch; }
.cf-texto strong { color: var(--text-primary); }

.cf-passos { margin: 0; padding-left: var(--space-5); display: flex; flex-direction: column; gap: var(--space-2); max-width: 74ch; }
.cf-passos li { font-size: var(--text-sm); color: var(--text-secondary); line-height: var(--leading-body); }
.cf-passos code {
    font-family: var(--font-mono, monospace); font-size: 12px;
    padding: 2px 6px; border-radius: var(--radius-xs);
    background: var(--surface-3); color: var(--text-primary);
}
.cf-passos b { color: var(--text-primary); }

.cf-numeros { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: var(--space-4); }
.cf-numero { display: flex; flex-direction: column; gap: var(--space-1); }
.cf-numero__valor { font-size: 26px; font-weight: 600; letter-spacing: var(--tracking-tight); font-variant-numeric: tabular-nums; color: var(--text-primary); }
.cf-numero__rotulo { font-size: var(--text-xs); color: var(--text-tertiary); }

.cf-acoes { display: flex; align-items: center; gap: var(--space-3); flex-wrap: wrap; }
.cf-perigo:hover { background: var(--danger-muted); border-color: var(--danger); color: var(--danger); }
.cf-perigo--confirma { background: var(--danger-muted); border-color: var(--danger); color: var(--danger); }
</style>
`;
