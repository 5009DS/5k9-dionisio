/* ═══════════════════════════════════════════════════════════════════════════
   CONEXÃO COM O BANCO

   O Dionísio mora no MESMO projeto Supabase do 5K9 Forms — o mesmo que já
   hospeda o 5K9 Chronos. Não é o desenho original (a primeira versão deste
   arquivo previa um projeto próprio); mudou porque o plano gratuito do
   Supabase limita quantos projetos a organização pode ter, e criar um quarto
   projeto para guardar algumas centenas de roteiros custaria uma assinatura
   mensal. O raciocínio completo — por que o Forms e não o Gestor, o que essa
   escolha custa em troca — está no topo de db/schema.sql.

   Como consequência direta: URL e chave aqui são IDÊNTICAS às de
   lib/chronos.js (CHRONOS_URL/CHRONOS_ANON). Não é coincidência nem erro de
   copiar — são o mesmo projeto, vistos de dois arquivos diferentes. O que os
   diferencia é a TABELA: as deste sistema são prefixadas `dn_`
   (`dn_roteiros`, `dn_clientes`), justamente para não colidir com as
   `vz_` do Chronos ou as sem prefixo do Forms — ver db/remoto.js, que faz
   essa tradução, e a explicação do prefixo em db/schema.sql.

   Enquanto os dois campos abaixo estiverem vazios, o sistema roda em MODO
   LOCAL: tudo é gravado no localStorage deste navegador e mais ninguém do
   time enxerga. Serve para escrever sem depender de banco — e é assim que o
   sistema nasce.

   Para ligar no Supabase de verdade:
     1. rode db/schema.sql no SQL Editor do projeto do Forms (não crie um
        projeto novo — é ele mesmo, o schema já vem prefixado para conviver
        com as tabelas que já estão lá);
     2. confirme que a pessoa já tem usuário em Authentication → Users
        (se ela já usa o Forms ou o Chronos, já tem);
     3. cole aqui a mesma URL e a mesma chave `anon` que estão em
        lib/chronos.js.

   A chave `anon` é pública por natureza — vai no bundle e qualquer pessoa a
   lê no DevTools. Quem protege os roteiros é o RLS (ver db/schema.sql), que
   exige sessão autenticada para TUDO. Não existe tela pública aqui: roteiro
   não aprovado é rascunho, e rascunho não se publica por acidente.

   ATENÇÃO ao colar a URL: só o endereço do projeto, sem caminho. O painel do
   Supabase mostra a URL da API REST (…/rest/v1/) em alguns lugares, mas a
   biblioteca monta esse trecho sozinha — e monta também o de autenticação
   (/auth/v1). Com o caminho já colado aqui, o login tentaria bater em
   /rest/v1/auth/v1/token e falharia sem dizer por quê.
   ═══════════════════════════════════════════════════════════════════════════ */

export const SUPABASE_URL  = '';
export const SUPABASE_ANON = '';

/** Há banco configurado? Se não, o store cai no adaptador local. */
export const CONFIGURADO = !!(SUPABASE_URL && SUPABASE_ANON);
