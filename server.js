const express = require('express');
const { Pool } = require('pg');

const app = express();
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'course_db',
});

app.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.send(`
      <h1>✅ Лабораторна робота №7 працює!</h1>
      <p>Час сервера БД: ${result.rows[0].now}</p>
      <a href="/health">Health Check</a>
    `);
  } catch (err) {
    res.send(`
      <h1>⚠️ Сервер працює, але БД недоступна</h1>
      <p>Помилка: ${err.message}</p>
    `);
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'backend-course-2025-7' });
});

const PORT = 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Сервер працює на порту ${PORT}`);
});