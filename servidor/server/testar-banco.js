const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./database.db');

console.log('🔍 Verificando respostas no banco...\n');

const sql = `
SELECT 
  r.id,
  r.processo_id as processo,
  r.departamento_id as dept,
  r.pergunta_id as pergunta,
  r.resposta,
  p.nome_empresa as empresa,
  d.nome as departamento,
  r.criado_em
FROM respostas_questionario r
JOIN processos p ON p.id = r.processo_id
JOIN departamentos d ON d.id = r.departamento_id
ORDER BY r.criado_em DESC
LIMIT 20
`;

db.all(sql, [], (err, rows) => {
  if (err) {
    console.error('❌ Erro ao consultar:', err.message);
    db.close();
    return;
  }
  
  if (rows.length === 0) {
    console.log('⚠️  NENHUMA RESPOSTA ENCONTRADA NO BANCO!');
    console.log('📝 Preencha um questionário primeiro.\n');
  } else {
    console.log(`✅ ${rows.length} respostas encontradas:\n`);
    console.table(rows);
  }
  
  db.close();
  console.log('\n✅ Teste concluído!');
});