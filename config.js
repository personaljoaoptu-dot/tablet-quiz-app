/**
 * Configuração do Banco de Dados na Nuvem (Supabase)
 * 
 * Para ativar:
 * 1. Crie uma conta gratuita em https://supabase.com
 * 2. Crie um novo projeto (ex: GardenGold)
 * 3. Cole abaixo o 'Project URL' e o 'anon public key' encontrados em Settings -> API
 */

window.SUPABASE_CONFIG = {
  url: "https://SEU-PROJETO.supabase.co",
  anonKey: "SUA-CHAVE-ANONIMA-AQUI",
  adminPin: "1234" // Senha para abrir o painel de relatórios no tablet
};
