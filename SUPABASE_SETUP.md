# Supabase do socifauc

1. Abra o projeto `qozlxgophtixgyjxyjhz` no Supabase.
2. Abra `SQL Editor`.
3. Cole e execute todo o conteúdo de `supabase-schema.sql`.
4. Em `Authentication > Providers`, habilite Email ou o provedor que será usado pelos usuários.
5. Crie um usuário de teste. O feed público poderá ser lido sem login; publicar, comentar, curtir, repostar, gorjetas e carteira exigem autenticação pelas políticas RLS.
6. Abra `index.html` por um servidor local. O arquivo `supabase-config.js` já contém a URL e a anon key pública do projeto.

A `service_role key` não deve ser colocada no frontend.
