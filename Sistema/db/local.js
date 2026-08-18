/* ═══════════════════════════════════════════════════════════════════════════
   ADAPTADOR LOCAL — localStorage.

   Usado enquanto lib/supabase-config.js estiver vazio. Mesma interface do
   adaptador remoto (listar/salvar/excluir/substituir), então o store não sabe
   qual dos dois está em uso e as páginas nunca precisam perguntar.

   Limite conhecido e assumido: os roteiros vivem NESTE navegador. Não são do
   time, não sobrevivem a uma limpeza de cache e não têm histórico. Por isso a
   topnav mostra o aviso de modo local, e Configurações oferece exportar em
   JSON — é a única cópia de segurança que existe aqui.

   ── Sobre o tamanho ──────────────────────────────────────────────────────
   Diferente do Gestor, aqui cada registro é TEXTO LONGO: um roteiro de
   YouTube com trinta tomadas passa fácil de 30kB. O localStorage costuma
   parar em torno de 5MB por origem, e quando estoura ele não avisa — lança
   QuotaExceededError no meio de uma digitação e a gravação simplesmente não
   acontece. Por isso o erro é convertido numa mensagem que diz o que fazer,
   em vez de subir cru até o console.
   ═══════════════════════════════════════════════════════════════════════════ */

const CHAVE = (colecao) => `5k9_dionisio_${colecao}`;

const ler = (colecao) => {
    try { return JSON.parse(localStorage.getItem(CHAVE(colecao))) || []; }
    catch { return []; }
};

const gravar = (colecao, linhas) => {
    try {
        localStorage.setItem(CHAVE(colecao), JSON.stringify(linhas));
    } catch (e) {
        // Nome do erro varia entre navegadores; o código 22 é o denominador
        // comum. Firefox usa 1014 com outro nome.
        const cheio = e?.name === 'QuotaExceededError' || e?.code === 22 || e?.code === 1014;
        throw cheio
            ? new Error('O armazenamento deste navegador encheu. Exporte os roteiros em Configurações e apague os que já foram gravados.')
            : e;
    }
};

export const local = {
    modo: 'local',

    // Sem banco não há sessão. O app trata `null` como "modo aberto" e pula
    // a tela de login inteira (ver app.js).
    sessao: async () => null,

    listar: async (colecao) => ler(colecao),

    /**
     * Insere ou atualiza pelo id. Devolve a linha gravada.
     *
     * `criado_em` só é carimbado na inserção: reescrever a data a cada edição
     * faria toda a base parecer criada hoje. `atualizado_em` é o oposto —
     * carimbado sempre, porque é por ele que a lista de roteiros ordena.
     */
    salvar: async (colecao, registro) => {
        const linhas = ler(colecao);
        const id = registro.id || crypto.randomUUID();
        const i = linhas.findIndex(l => l.id === id);
        const linha = {
            ...(i > -1 ? linhas[i] : { criado_em: new Date().toISOString() }),
            ...registro,
            id,
            atualizado_em: new Date().toISOString(),
        };
        if (i > -1) linhas[i] = linha; else linhas.unshift(linha);
        gravar(colecao, linhas);
        return linha;
    },

    excluir: async (colecao, id) => {
        gravar(colecao, ler(colecao).filter(l => l.id !== id));
    },

    /** Troca a coleção inteira de uma vez — usado pela importação de JSON. */
    substituir: async (colecao, linhas) => {
        gravar(colecao, linhas);
        return linhas;
    },
};
