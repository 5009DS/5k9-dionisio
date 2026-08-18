/* ═══════════════════════════════════════════════════════════════════════════
   TEMA — claro/escuro.

   Idêntico ao do 5K9 Gestor. Como o Dionísio nasceu inteiro sobre os tokens,
   trocar de tema é trocar UM atributo no <html> — o resto é consequência.

   A chave do localStorage é a MESMA dos outros sistemas ('5k9_theme'): quem
   usa mais de um no mesmo navegador espera que a escolha valha para a casa
   toda, não para cada porta.

   Nota para quem for mexer na impressão: o tema NÃO afeta o PDF. A folha de
   impressão força papel branco e tinta preta, por motivo explicado em
   pages/impressao.css.
   ═══════════════════════════════════════════════════════════════════════════ */

export const theme = {
    get: () => localStorage.getItem('5k9_theme') || 'dark',
    set: (valor) => {
        localStorage.setItem('5k9_theme', valor);
        theme.aplicar();
    },
    alternar: () => theme.set(theme.get() === 'dark' ? 'light' : 'dark'),
    aplicar: () => document.documentElement.setAttribute('data-theme', theme.get()),
    init: () => theme.aplicar(),
};
