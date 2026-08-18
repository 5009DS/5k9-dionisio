/* ═══════════════════════════════════════════════════════════════════════════
   O ROTEIRO — forma do registro, criação e normalização.

   Um roteiro tem duas metades que o sistema inteiro reflete:

     · a NARRATIVA — conceito, tom, personagens e os três atos. É o que se
       decide antes de gravar.
     · o SCRIPT TÉCNICO — cenas, cada uma com tomadas de vídeo e áudio. É o
       que vai para o set.

   As duas moram no MESMO registro, e não em dois. Elas são o mesmo trabalho
   em dois níveis de detalhe: separar em duas coleções obrigaria a manter um
   vínculo entre elas, e um vínculo é uma coisa que pode quebrar. Aqui, ou o
   roteiro existe inteiro ou não existe.

   ── Formato dos campos ───────────────────────────────────────────────────
   Texto dos atos e do conceito: TEXTO PURO (vem de <textarea>).
   Vídeo e áudio das tomadas: HTML SIMPLES (vem de contenteditable, pode ter
   <br>). Toda leitura que precise do texto passa por textoPuro() —
   ver lib/formato.js.
   ═══════════════════════════════════════════════════════════════════════════ */

import { paraSegundos } from './formato.js';

/** Formatos de peça, com o alvo de duração que cada um costuma ter. */
export const FORMATOS = [
    { valor: 'reel',        rotulo: 'Reel / Shorts / TikTok', alvo: 30,   vertical: true },
    { valor: 'youtube',     rotulo: 'Vídeo YouTube',          alvo: 180,  vertical: false },
    { valor: 'comercial',   rotulo: 'Comercial / Ad',         alvo: 30,   vertical: false },
    { valor: 'documentario',rotulo: 'Documentário',           alvo: 600,  vertical: false },
    { valor: 'livre',       rotulo: 'Livre',                  alvo: 60,   vertical: false },
];

export const rotuloFormato = (valor) =>
    FORMATOS.find(f => f.valor === valor)?.rotulo || 'Livre';

export const alvoDoFormato = (valor) =>
    FORMATOS.find(f => f.valor === valor)?.alvo || 60;

/* Ids legíveis, não uuid, para cena e tomada: eles aparecem em atributos do
   DOM e em arquivos exportados que às vezes são lidos à mão. O sufixo
   aleatório evita colisão quando duas tomadas nascem no mesmo milissegundo
   (duplicar em sequência rápida fazia exatamente isso). */
const id = (prefixo) =>
    `${prefixo}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export const novaTomada = (valores = {}) => ({
    id: id('tom'),
    indice: '',            // preenchido por reindexar()
    video: '',
    audio: '',
    ...valores,
});

export const novaCena = (valores = {}) => ({
    id: id('cena'),
    titulo: 'INT. LOCAÇÃO - DIA',
    tomadas: [novaTomada()],
    ...valores,
});

/**
 * Garante que toda cena e toda tomada tenham id próprio.
 *
 * EXISTE POR UM DEFEITO REAL, e vale registrar qual: os modelos de
 * seed/modelos.js descrevem cenas e tomadas SEM id — de propósito, porque um
 * id fixo no modelo seria copiado para todos os roteiros criados a partir
 * dele. Só que nada preenchia esse id na hora da cópia, e o roteiro nascia
 * com uma porção de `undefined`.
 *
 * A consequência não era um erro visível, que é o que a torna grave: como
 * `undefined === undefined`, TODA busca por id encontrava a primeira tomada
 * da cena. Excluir a tomada 1-4 apagava a 1-1; arrastar para reordenar não
 * reencontrava nada e esvaziava o roteiro inteiro.
 *
 * Idempotente: id que já existe não é tocado.
 */
export const garantirIds = (roteiro) => {
    (roteiro.cenas || []).forEach(cena => {
        if (!cena.id) cena.id = id('cena');
        (cena.tomadas || []).forEach(tomada => {
            if (!tomada.id) tomada.id = id('tom');
        });
    });
    return roteiro;
};

export const novoRoteiro = (valores = {}) => reindexar(garantirIds({
    id: crypto.randomUUID(),
    titulo: 'Roteiro sem título',
    formato: 'reel',
    duracao_alvo: 30,
    // Quem esta peça é para. Nulo é "sem cliente" — um roteiro de teste, um
    // formato institucional do próprio estúdio — e não um erro a corrigir.
    cliente_id: null,
    conceito: '',
    tom: '',
    personagens: [],
    atos: { apresentacao: '', confronto: '', resolucao: '' },
    cenas: [novaCena()],
    ...valores,
}));

/**
 * Renumera as tomadas: "2-3" é a terceira tomada da segunda cena.
 *
 * Chamado depois de toda operação que muda a ORDEM ou a QUANTIDADE — criar,
 * duplicar, excluir, arrastar. O índice é derivado da posição, nunca
 * guardado como verdade própria: um número gravado que não acompanha a
 * reordenação vira uma etiqueta mentindo sobre onde a tomada está.
 */
export const reindexar = (roteiro) => {
    (roteiro.cenas || []).forEach((cena, c) => {
        (cena.tomadas || []).forEach((tomada, t) => {
            tomada.indice = `${c + 1}-${t + 1}`;
        });
    });
    return roteiro;
};

/** Localiza uma tomada pelos ids, sem quem chama precisar percorrer nada. */
export const acharTomada = (roteiro, cenaId, tomadaId) => {
    const cena = (roteiro.cenas || []).find(c => c.id === cenaId);
    if (!cena) return {};
    return { cena, tomada: (cena.tomadas || []).find(t => t.id === tomadaId) };
};

/* ═══════════════════════════════════════════════════════════════════════════
   NORMALIZAÇÃO — o que entra pela importação.

   Dois formatos precisam ser aceitos:

     · o do sistema, exportado por Configurações;
     · o do AutoScript ORIGINAL, em inglês (title, acts.setup, scenes[].shots)
       — a ferramenta de onde este sistema nasceu, cujos arquivos ainda estão
       nas máquinas do time.

   Rejeitar o formato antigo faria cada roteiro escrito antes da migração ter
   que ser copiado à mão, campo por campo. O custo de aceitá-lo é esta função;
   o de não aceitar seria pago por pessoa, por roteiro, para sempre.

   A normalização também é a rede contra arquivo torto: campo faltando vira
   padrão, tipo errado vira o tipo certo. Um roteiro sem `cenas` que chegasse
   cru derrubaria o editor no primeiro `.map`.
   ═══════════════════════════════════════════════════════════════════════════ */

const ATOS_ANTIGOS = { setup: 'apresentacao', confront: 'confronto', resolve: 'resolucao' };

const FORMATO_ANTIGO = {
    Reel: 'reel', YouTube: 'youtube', Comercial: 'comercial',
    Documentario: 'documentario', Custom: 'livre',
};

export const normalizar = (cru) => {
    if (!cru || typeof cru !== 'object') return null;

    const legado = 'scenes' in cru || 'acts' in cru;

    const atos = { apresentacao: '', confronto: '', resolucao: '' };
    const atosCrus = cru.atos || cru.acts || {};
    Object.entries(atosCrus).forEach(([chave, valor]) => {
        const destino = ATOS_ANTIGOS[chave] || chave;
        if (destino in atos) atos[destino] = String(valor || '');
    });

    const cenasCruas = Array.isArray(cru.cenas) ? cru.cenas
                     : Array.isArray(cru.scenes) ? cru.scenes : [];

    const cenas = cenasCruas.map(c => ({
        id: c.id || id('cena'),
        titulo: String(c.titulo || c.title || 'CENA SEM TÍTULO').toUpperCase(),
        tomadas: (Array.isArray(c.tomadas) ? c.tomadas
                : Array.isArray(c.shots) ? c.shots : []).map(t => ({
            id: t.id || id('tom'),
            indice: String(t.indice || t.index || ''),
            video: String(t.video || ''),
            audio: String(t.audio || ''),
        })),
    })).filter(c => c.tomadas.length);

    const formatoCru = cru.formato || cru.format || 'reel';
    const formato = FORMATOS.some(f => f.valor === formatoCru)
        ? formatoCru
        : (FORMATO_ANTIGO[formatoCru] || 'livre');

    /* O AutoScript guardava a duração alvo em `targetDuration`, sempre em
       segundos. Passa por paraSegundos() mesmo assim: alguns arquivos
       gravados à mão trazem "30s" em texto. */
    const alvo = paraSegundos(cru.duracao_alvo ?? cru.targetDuration ?? alvoDoFormato(formato));

    return reindexar({
        id: cru.id || crypto.randomUUID(),
        titulo: String(cru.titulo || cru.title || 'Roteiro sem título').slice(0, 160),
        formato,
        duracao_alvo: alvo || alvoDoFormato(formato),
        // Só sobrevive num arquivo exportado por ESTE sistema — o AutoScript
        // legado não tem esse conceito, e um cliente importado de outro
        // navegador é um id que talvez não exista aqui. Não valida contra a
        // lista local: o roteiro abre igual, e um cliente órfão é só um
        // seletor voltando a "sem cliente" na primeira edição.
        cliente_id: cru.cliente_id || null,
        conceito: String(cru.conceito || cru.concept || ''),
        tom: String(cru.tom || cru.tone || ''),
        personagens: (Array.isArray(cru.personagens) ? cru.personagens
                    : Array.isArray(cru.characters) ? cru.characters : [])
            .map(p => String(p).toUpperCase()).filter(Boolean),
        atos,
        cenas: cenas.length ? cenas : [novaCena()],
        criado_em: cru.criado_em || new Date().toISOString(),
        atualizado_em: cru.atualizado_em || new Date().toISOString(),
        // Marca de origem: aparece uma vez na lista, para a pessoa saber que
        // aquele roteiro veio de fora e conferir se chegou inteiro.
        ...(legado ? { importado_de: 'autoscript' } : {}),
    });
};
