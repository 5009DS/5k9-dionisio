import { store, descarregar } from './store.js';
import { theme } from './theme.js';
import { navegar, caminhoAtual, interceptarLinks } from './lib/rotas.js';

import { renderRoteiros } from './pages/roteiros.js';
import { renderEditor } from './pages/editor.js';
import { renderCadastros } from './pages/cadastros.js';
import { renderConfiguracoes } from './pages/configuracoes.js';
import { renderLogin } from './pages/login.js';

/* ═══════════════════════════════════════════════════════════════════════════
   5K9 DIONÍSIO — roteador.

   Mesma estrutura do 5K9 Gestor: SPA sobre a History API, sem build, módulos
   ES servidos direto. Duas diferenças que valem nota:

     · Existe uma rota com PARÂMETRO (/roteiro/:id). O resolvedor do Gestor é
       um mapa direto de caminho para função, porque lá toda tela é fixa; aqui
       o mapa ganhou uma exceção — só uma, e explícita, em vez de um
       roteador com sintaxe de padrões que seria maior que o sistema.

     · Trocar de rota DESCARREGA o que estiver por gravar. O editor grava com
       atraso (ver store.js), e sair de um roteiro sem esperar o relógio
       deixaria o último parágrafo apenas na memória.
   ═══════════════════════════════════════════════════════════════════════════ */

const app = document.getElementById('app');

theme.init();

const resolver = (caminho) => {
    const fixas = {
        '/':              () => renderRoteiros(app),
        '/cadastros':     () => renderCadastros(app),
        '/configuracoes': () => renderConfiguracoes(app),
        '/login':         () => renderLogin(app),
    };
    if (fixas[caminho]) return fixas[caminho];

    const roteiro = caminho.match(/^\/roteiro\/([^/]+)$/);
    if (roteiro) return () => renderEditor(app, decodeURIComponent(roteiro[1]));

    return null;
};

let caminhoCorrente = null;

const roteador = async () => {
    const caminho = caminhoAtual();

    /* Em modo local não há sessão a exigir; a tela de login nem é oferecida.
       Em modo remoto, sem usuário só existe /login — e a troca usa
       `substituir` para o login não virar parada no histórico, senão o botão
       "voltar" joga a pessoa de volta nele depois de entrar. */
    if (store.exigeLogin) {
        if (!store.usuario() && caminho !== '/login') return navegar('/login', { substituir: true });
        if (store.usuario() && caminho === '/login')  return navegar('/', { substituir: true });
    } else if (caminho === '/login') {
        return navegar('/', { substituir: true });
    }

    if (caminho === caminhoCorrente) return;

    // Sai do editor gravando. Antes de qualquer coisa: se o desenho da tela
    // nova falhar, o texto já está seguro.
    await descarregar();

    app.innerHTML = '';
    const render = resolver(caminho);
    if (render) {
        try {
            await render();
        } catch (e) {
            console.error('[app] falha ao desenhar a página:', e);
            app.innerHTML = erroHTML(e);
        }
    } else {
        app.innerHTML = naoEncontrado();
    }
    requestAnimationFrame(() => { if (window.lucide) lucide.createIcons(); });
    caminhoCorrente = caminho;
};

// Uma falha ao carregar não pode deixar a tela em branco sem explicação.
const erroHTML = (e) => `
    <div class="app-aviso">
        <h2>Algo quebrou ao montar esta tela</h2>
        <p>${String(e?.message || e)}</p>
        <a href="/" class="ds-btn ds-btn--ghost ds-btn--sm">Voltar aos roteiros</a>
    </div>`;

const naoEncontrado = () => `
    <div class="app-aviso">
        <h2>Página não encontrada</h2>
        <p>O endereço não corresponde a nenhuma tela do Dionísio. Se você chegou
           aqui por um link de roteiro, ele pode ter sido excluído.</p>
        <a href="/" class="ds-btn ds-btn--ghost ds-btn--sm">Ir para os roteiros</a>
    </div>`;

window.addEventListener('popstate', roteador);
interceptarLinks();

/* A sessão precisa estar resolvida ANTES do primeiro desenho: a topnav lê
   store.usuario() de forma síncrona para montar o avatar e o menu. */
store.iniciarSessao().then(() => {
    roteador();
    // Login/logout em outra aba, ou token expirado: reavalia a rota atual
    // em vez de deixar a tela desatualizada.
    store.aoMudarSessao(() => { caminhoCorrente = null; roteador(); });
});

export { roteador };
