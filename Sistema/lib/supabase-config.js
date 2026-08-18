/* ═══════════════════════════════════════════════════════════════════════════
   CONEXÃO COM O BANCO

   O Dionísio mora num projeto Supabase PRÓPRIO, separado do 5K9 Forms e do
   5K9 Gestor. Não é preciosismo: roteiro é texto longo editado o dia inteiro,
   e o padrão de escrita dele não tem nada a ver com o de um formulário
   respondido uma vez ou com o fechamento financeiro do mês.

   Enquanto os dois campos abaixo estiverem vazios, o sistema roda em MODO
   LOCAL: tudo é gravado no localStorage deste navegador e mais ninguém do
   time enxerga. Serve para escrever sem depender de banco — e é assim que o
   sistema nasce.

   Para ligar no Supabase de verdade:
     1. crie um projeto novo em supabase.com;
     2. rode db/schema.sql no SQL Editor dele;
     3. crie seu usuário em Authentication → Users → Add user;
     4. cole aqui a URL e a chave `anon` (Settings → API).

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
