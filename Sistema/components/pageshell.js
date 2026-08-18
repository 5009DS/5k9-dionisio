import { renderTopnav } from './topnav.js';

/* ═══════════════════════════════════════════════════════════════════════════
   PAGE SHELL — esqueleto comum de todas as telas.
   Topnav + container + herói (título display, subtítulo, ações). Cada página
   preenche só o miolo.

     const { content } = renderShell(container, {
         path: '/entradas',
         title: 'Entradas',
         subtitle: 'De onde vem o dinheiro',
         actions: `<button class="ds-btn ds-btn--primary">Nova entrada</button>`,
     });
   ═══════════════════════════════════════════════════════════════════════════ */

export const renderShell = (container, { path, title, subtitle = '', actions = '' }) => {
    injectStyles();

    container.innerHTML = `
        <div class="sh-page animate-fade-in">
            <div class="sh-scroll">
                <div class="sh-wrap">
                    <div id="topnav-container"></div>

                    <header class="sh-hero">
                        <div class="sh-hero__text">
                            <h1 class="ds-display">${title}</h1>
                            ${subtitle ? `<p class="sh-hero__sub">${subtitle}</p>` : ''}
                        </div>
                        ${actions ? `<div class="sh-hero__actions">${actions}</div>` : ''}
                    </header>

                    <div id="sh-content" class="sh-content"></div>
                </div>
            </div>
        </div>
    `;

    renderTopnav(document.getElementById('topnav-container'), path);
    return { content: document.getElementById('sh-content') };
};

// ─────────────────────────────────────────────────────────────────────────
function injectStyles() {
    if (document.getElementById('pageshell-styles')) return;
    const style = document.createElement('style');
    style.id = 'pageshell-styles';
    style.textContent = `
        /* Vão único da grade bento: todo card-para-card usa este valor. */
        .sh-page { --bento-gap: var(--space-4); }

        /* #app é display:flex — sem flex:1 a página encolhe até o conteúdo
           em vez de ocupar a viewport. */
        .sh-page {
            flex: 1; min-width: 0;
            height: 100vh; overflow: hidden;
            background-color: var(--surface-base);
            font-family: var(--font-sans);
            color: var(--text-primary);
        }
        .sh-scroll { height: 100vh; overflow-y: auto; padding: var(--space-6) var(--space-8) var(--space-12); }
        .sh-wrap {
            max-width: 1320px; margin: 0 auto;
            display: flex; flex-direction: column; gap: var(--bento-gap);
        }

        /* Herói: o único ponto com respiro maior que --bento-gap. */
        .sh-hero {
            display: flex; align-items: flex-end; justify-content: space-between;
            gap: var(--space-8); flex-wrap: wrap;
            padding: var(--space-6) 0;
        }
        .sh-hero__sub { font-size: var(--text-body); color: var(--text-secondary); margin: var(--space-3) 0 0; }
        .sh-hero__actions { display: flex; align-items: center; gap: var(--space-3); flex-wrap: wrap; }

        .sh-content { display: flex; flex-direction: column; gap: var(--bento-gap); }

        .animate-fade-in { animation: sh-fade var(--dur-base) var(--ease-out); }
        @keyframes sh-fade { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }

        @media (max-width: 860px) {
            .sh-scroll { padding: var(--space-4) var(--space-5) var(--space-10); }
            .sh-hero { align-items: flex-start; padding: var(--space-5) 0; }
            .sh-hero__actions { width: 100%; }
        }
        @media (prefers-reduced-motion: reduce) { .animate-fade-in { animation: none; } }
    `;
    document.head.appendChild(style);
}
