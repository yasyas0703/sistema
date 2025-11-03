
await db.runAsync(`
  CREATE UNIQUE INDEX IF NOT EXISTS idx_tags_nome ON tags(nome);
`);
console.log('✅ Índice único criado para tags.nome');
