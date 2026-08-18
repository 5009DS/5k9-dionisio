import { textoPuro } from './formato.js';

/* ═══════════════════════════════════════════════════════════════════════════
   DURAÇÃO ESTIMADA — o cálculo do sistema.

   Equivalente ao lib/calculo.js do 5K9 Gestor: é aqui que mora a única conta
   que o Dionísio faz, e ela mora sozinha justamente para poder ser lida,
   discutida e corrigida sem abrir a interface.

   ── A pergunta ───────────────────────────────────────────────────────────
   "Esse roteiro cabe em 30 segundos?" Quem escreve Reel descobre a resposta
   na edição, quando já é tarde: o texto foi gravado, o take existe, e cortar
   significa perder fala escrita com cuidado. A estimativa não substitui o
   corte fino — ela avisa antes de gravar.

   ── Como a conta funciona ────────────────────────────────────────────────
   Por TOMADA, o maior entre dois números:

     · o tempo de FALA — palavras faladas ÷ 2,16 por segundo (≈130 por
       minuto, ritmo de locução em português; noticiário corre mais, leitura
       publicitária corre menos);
     · o PISO VISUAL de 3 segundos — um plano existe mesmo sem ninguém
       falando, e uma tomada muda não dura zero.

   O maior, e não a soma, porque a imagem corre AO MESMO TEMPO que a fala.
   Somar faria todo roteiro com diálogo estourar o alvo por construção.

   ── O que NÃO conta como fala ────────────────────────────────────────────
   A coluna de áudio mistura três coisas: marcação de trilha e efeito, nome
   de quem fala, e a fala em si. Só a última vira tempo. Sem essa separação,
   "BG: trilha de suspense" viraria quatro palavras faladas e um roteiro de
   marcação densa pareceria mais longo do que é.

   ── O que a conta não sabe ───────────────────────────────────────────────
   Pausa dramática, silêncio proposital, plano contemplativo de 15 segundos.
   Isso é decisão de direção e não está escrito em lugar nenhum do texto —
   por isso a estimativa é sempre um PISO, e o rótulo na tela diz "estimada".
   ═══════════════════════════════════════════════════════════════════════════ */

/** Palavras faladas por segundo (≈130 por minuto). */
const PALAVRAS_POR_SEGUNDO = 2.16;

/** Piso visual de cada tomada, em segundos. */
const PISO_TOMADA = 3;

/* Prefixos de marcação técnica: a linha inteira é ignorada na contagem.
   Comparados sem acento e sem caixa, porque "Folley", "FOLLEY" e "folley"
   aparecem todos no material real. */
const MARCACOES = ['bg:', 'bg ', 'trilha:', 'folley:', 'foley:', 'sfx:',
                   'loc.', 'loc:', 'off:', 'vo:', 'som:', 'ef.', 'efeito:'];

const semAcento = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * Conta as palavras que alguém realmente vai FALAR num trecho de áudio.
 * Cada linha é classificada por conta própria: a mesma célula costuma ter
 * marcação, nome de personagem e fala, uma embaixo da outra.
 */
export const palavrasFaladas = (textoAudio) => {
    if (!textoAudio) return 0;

    return textoPuro(textoAudio).split('\n').reduce((total, linha) => {
        const l = linha.trim();
        if (!l) return total;

        // 1. Marcação técnica — trilha, efeito, locução de fundo.
        const chave = semAcento(l);
        if (MARCACOES.some(m => chave.startsWith(m))) return total;

        // 2. Rubrica entre parênteses — "(sussurrando)", "(voz sonolenta)".
        if (l.startsWith('(') && l.endsWith(')')) return total;

        /* 3. Nome de quem fala. Convenção de roteiro: linha curta em caixa
              alta, sozinha, acima da fala. O limite de quatro palavras deixa
              passar "LOCUTOR EM OFF" e ainda barra uma frase inteira gritada
              em caixa alta, que É fala e precisa contar. */
        const palavras = l.split(/\s+/).filter(Boolean);
        if (l === l.toUpperCase() && l.length > 2 && palavras.length <= 4
            && !/[.?!,]$/.test(l)) return total;

        return total + palavras.length;
    }, 0);
};

/** Segundos estimados de UMA tomada. */
export const duracaoTomada = (tomada) =>
    Math.max(palavrasFaladas(tomada?.audio) / PALAVRAS_POR_SEGUNDO, PISO_TOMADA);

/**
 * Segundos estimados do roteiro inteiro.
 *
 * NÃO é gravado no registro. Duração é consequência do texto, e guardar
 * consequência é criar um segundo lugar onde a verdade pode divergir — o
 * roteiro editado em outra aba deixaria o número salvo mentindo. A conta é
 * barata; refazê-la a cada tecla custa menos que reconciliar dois valores.
 */
export const duracaoEstimada = (roteiro) =>
    Math.round((roteiro?.cenas || []).reduce((total, cena) =>
        total + (cena.tomadas || []).reduce((t, tomada) => t + duracaoTomada(tomada), 0), 0));

/** Quantas tomadas o roteiro tem, somando todas as cenas. */
export const contarTomadas = (roteiro) =>
    (roteiro?.cenas || []).reduce((t, c) => t + (c.tomadas || []).length, 0);

/**
 * Como a duração estimada se comporta diante do alvo.
 *   'vazio'   — não há o que medir ainda
 *   'dentro'  — cabe, com folga de mais de 10%
 *   'no-osso' — cabe, mas encostado no limite (últimos 10%)
 *   'estoura' — passou do alvo
 *
 * A faixa "no osso" existe porque o corte real sempre acrescenta alguns
 * quadros: respiração, entrada de trilha, um plano que precisa assentar. Um
 * roteiro que bate exatamente 30,0s em 30s não cabe de verdade em 30s.
 */
export const situacao = (estimada, alvo) => {
    if (!estimada) return 'vazio';
    if (!alvo)     return 'dentro';
    if (estimada > alvo) return 'estoura';
    return estimada >= alvo * 0.9 ? 'no-osso' : 'dentro';
};
