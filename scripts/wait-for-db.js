// scripts/wait-for-db.js
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

async function waitForDatabase() {
  console.log('⏳ Очікування готовності бази даних...');
  
  let attempts = 30; // 30 спроб по 2 секунди = 60 секунд
  const host = process.env.DB_HOST || 'localhost';
  const port = process.env.DB_PORT || 5432;
  const user = process.env.DB_USER || 'postgres';
  const password = process.env.DB_PASSWORD || 'postgrespassword';
  const database = process.env.DB_NAME || 'course_db';
  
  for (let i = 1; i <= attempts; i++) {
    try {
      // Використовуємо pg_isready для перевірки доступності PostgreSQL
      const { stdout, stderr } = await execAsync(
        `pg_isready -h ${host} -p ${port} -U ${user} -d ${database}`
      );
      
      if (stdout.includes('accepting connections')) {
        console.log(`✅ База даних готова після ${i} спроб!`);
        return true;
      }
    } catch (error) {
      // Ігноруємо помилки поки чекаємо
      if (i % 5 === 0) {
        console.log(`⏳ Чекаємо на БД... спроба ${i}/${attempts}`);
      }
      
      if (i === attempts) {
        console.error(`❌ База даних не готова після ${attempts} спроб`);
        console.error(`   Host: ${host}`);
        console.error(`   Port: ${port}`);
        console.error(`   User: ${user}`);
        console.error(`   Database: ${database}`);
        return false;
      }
      
      // Чекаємо 2 секунди перед наступною спробою
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  return false;
}

// Якщо скрипт запущено напряму
if (require.main === module) {
  waitForDatabase()
    .then(success => {
      if (success) {
        process.exit(0);
      } else {
        process.exit(1);
      }
    })
    .catch(err => {
      console.error('❌ Помилка при очікуванні БД:', err);
      process.exit(1);
    });
}

module.exports = waitForDatabase;