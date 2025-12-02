const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const db = new sqlite3.Database('./database.sqlite', (err) => {
  if (err) {
    console.error('❌ Erro ao conectar ao banco:', err.message);
    return;
  }
  console.log('✅ Conectado ao banco de dados SQLite.');
});

const executarSchema = () => {
  try {
   const schemaPath = path.join(__dirname, 'database', 'schema.sql');
    
    if (!fs.existsSync(schemaPath)) {
      console.error('❌ Arquivo schema.sql não encontrado!');
      return;
    }

    const schema = fs.readFileSync(schemaPath, 'utf8');
    const comandos = schema.split(';').filter(cmd => cmd.trim());

    console.log('🗄️ Executando schema SQL...');

    let comandosExecutados = 0;
    let erros = 0;

    comandos.forEach((comando, index) => {
      if (comando.trim()) {
        db.run(comando, (err) => {
          if (err) {
            console.error(`❌ Erro no comando ${index + 1}:`, err.message);
            erros++;
          } else {
            comandosExecutados++;
            console.log(`✅ Comando ${index + 1} executado`);
          }

          if (comandosExecutados + erros === comandos.length - 1) {
            console.log(`\n🎉 Schema executado!`);
            console.log(`✅ Comandos executados: ${comandosExecutados}`);
            console.log(`❌ Erros: ${erros}`);
            
            db.close((err) => {
              if (err) {
                console.error('❌ Erro ao fechar banco:', err.message);
              } else {
                console.log('🔒 Conexão com banco fechada.');
              }
            });
          }
        });
      }
    });

  } catch (error) {
    console.error('❌ Erro ao executar schema:', error);
    db.close();
  }
};

executarSchema();