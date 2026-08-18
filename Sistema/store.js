/* ═══════════════════════════════════════════════════════════════════════════
   STORE — camada de dados do 5K9 Dionísio.

   Mesmo desenho do 5K9 Gestor: escolhe o adaptador (Supabase ou localStorage)
   uma vez, no boot, e expõe a mesma API para as coleções. As páginas nunca
   importam adaptador nenhum — pedem `store.roteiros.listar()` e pronto.

   Só existe UMA coleção, `roteiros`, e ela guarda o registro inteiro (cenas e
   tomadas embutidas, ver lib/roteiro.js). A fábrica de coleção continua aqui
   porque a segunda coleção é questão de tempo, e porque ela é o lugar onde
   cache e invalidação já estão resolvidos.

   ── O que difere do Gestor: gravação adiada ──────────────────────────────
   Lá cada lançamento é um formulário que a pessoa preenche e envia. Aqui a
   pessoa DIGITA — e gravar a cada tecla, contra um banco pela rede, seria
   uma requisição por letra. Por isso existe `salvarAdiado`, que junta as
   alterações e grava depois que a digitação para. Quem chama nunca precisa
   se lembrar disso: o editor usa o adiado, todo o resto usa o direto.
   ═══════════════════════════════════════════════════════════════════════════ */

import { CONFIGURADO } from './lib/supabase-config.js';
import { local } from './db/local.js';
import { remoto } from './db/remoto.js';

const db = CONFIGURADO ? remoto : local;

/* ── Cache de leitura ────────────────────────────────────────────────────
   30s, como no Gestor. Curto de propósito: existe para não repetir a mesma
   consulta dentro de uma navegação, não para guardar estado. Toda escrita
   derruba a coleção afetada, então o que VOCÊ acabou de salvar aparece na
   hora — o atraso só pode existir para mudança feita por outra pessoa. */
const TTL = 30_000;
const cache = new Map();

const comCache = async (chave, buscar) => {
    const guardado = cache.get(chave);
    if (guardado && Date.now() - guardado.em < TTL) return guardado.dados;
    // Guarda a PROMESSA, não o resultado: duas telas pedindo o mesmo
    // compartilham a ida em vez de fazerem duas.
    const promessa = buscar();
    cache.set(chave, { dados: promessa, em: Date.now() });
    try { return await promessa; }
    catch (e) { cache.delete(chave); throw e; }
};

const COLECOES = ['roteiros', 'clientes'];

/* ── Gravação adiada ─────────────────────────────────────────────────────
   Uma espera por registro: editar dois roteiros em duas abas não pode fazer
   um cancelar o outro. `pendentes` guarda o timer e a última versão de cada
   um, e `descarregar()` força a gravação de tudo que estiver esperando.

   900ms é a folga entre duas teclas de quem está pensando, não de quem está
   digitando. Abaixo disso, uma pausa para escolher a palavra já dispara
   gravação; muito acima, o intervalo em que o trabalho existe só na memória
   fica grande demais para um fechamento de aba distraído. */
const ESPERA = 900;
const pendentes = new Map();

const colecao = (nome) => ({
    listar: () => comCache(nome, () => db.listar(nome)),

    obter: async (id) => (await comCache(nome, () => db.listar(nome)))
        .find(l => l.id === id) || null,

    salvar: async (registro) => {
        const linha = await db.salvar(nome, registro);
        cache.delete(nome);
        return linha;
    },

    excluir: async (id) => {
        pendentes.delete(id);        // não ressuscite o que acabou de morrer
        await db.excluir(nome, id);
        cache.delete(nome);
    },

    substituir: async (linhas) => {
        await db.substituir(nome, linhas);
        cache.delete(nome);
    },

    /**
     * Agenda a gravação deste registro. Chamadas seguidas para o mesmo id
     * substituem a anterior — grava uma vez, com a versão mais nova.
     * @param {function} [aoGravar] avisado quando a gravação termina
     */
    salvarAdiado: (registro, aoGravar) => {
        const anterior = pendentes.get(registro.id);
        if (anterior) clearTimeout(anterior.timer);

        const gravar = async () => {
            pendentes.delete(registro.id);
            const atual = registro;
            try {
                const linha = await db.salvar(nome, atual);
                cache.delete(nome);
                aoGravar?.(null, linha);
            } catch (e) {
                console.error('[store] gravação adiada falhou:', e);
                aoGravar?.(e);
            }
        };

        pendentes.set(registro.id, { timer: setTimeout(gravar, ESPERA), gravar });
    },
});

/** Grava agora tudo que está esperando. Devolve quando terminar. */
export const descarregar = async () => {
    const espera = [...pendentes.values()];
    espera.forEach(p => clearTimeout(p.timer));
    pendentes.clear();
    await Promise.all(espera.map(p => p.gravar()));
};

/** Há trabalho ainda não gravado? Usado pelo aviso de saída. */
export const temPendencia = () => pendentes.size > 0;

// ── Sessão ──────────────────────────────────────────────────────────────
// Em modo local não existe login: `usuario` fica null e o app trata isso
// como acesso aberto. Em modo remoto, null significa "precisa entrar".
let usuario = null;
const ouvintes = [];

export const store = {
    modo: db.modo,
    exigeLogin: CONFIGURADO,

    iniciarSessao: async () => {
        usuario = await db.sessao();
        if (db.aoMudarSessao) {
            await db.aoMudarSessao(async () => {
                usuario = await db.sessao();
                cache.clear();
                ouvintes.forEach(fn => fn(usuario));
            });
        }
        return usuario;
    },
    aoMudarSessao: (fn) => ouvintes.push(fn),
    usuario: () => usuario,

    entrar: async (email, senha) => {
        const r = await db.entrar(email, senha);
        if (!r.error) usuario = await db.sessao();
        return r;
    },
    sair: async () => {
        // Descarrega ANTES de derrubar a sessão: em modo remoto, gravar
        // depois do logout bate num banco que já recusa a escrita, e o
        // último parágrafo escrito evaporaria sem aviso.
        await descarregar();
        usuario = null;
        cache.clear();
        if (db.sair) await db.sair();
    },

    // ── Coleções ────────────────────────────────────────────────────────
    roteiros: colecao('roteiros'),
    clientes: colecao('clientes'),

    limparCache: () => cache.clear(),

    /** Exportação/importação de segurança (ver pages/configuracoes.js). */
    exportar: async () => {
        await descarregar();     // não exporte uma versão mais velha que a tela
        const [roteiros, clientes] = await Promise.all([store.roteiros.listar(), store.clientes.listar()]);
        return { sistema: 'dionisio', versao: 2, exportado_em: new Date().toISOString(), roteiros, clientes };
    },
    importar: async (pacote) => {
        for (const c of COLECOES) {
            if (Array.isArray(pacote[c])) await store[c].substituir(pacote[c]);
        }
        cache.clear();
    },
};

/* Rede de segurança do fechamento de aba. `descarregar()` é assíncrono e o
   navegador não espera por promessa aqui — mas em modo local a gravação é
   síncrona por dentro (localStorage), então ela COMPLETA. Em modo remoto a
   requisição pode não chegar, e é por isso que o aviso abaixo existe: ele
   dá à pessoa a chance de voltar e esperar o "Salvo". */
window.addEventListener('beforeunload', (e) => {
    if (!temPendencia()) return;
    descarregar();
    if (CONFIGURADO) {
        e.preventDefault();
        e.returnValue = '';
    }
});
