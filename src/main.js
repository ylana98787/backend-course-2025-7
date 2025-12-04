require('dotenv').config();
const express = require('express');
const { Command } = require('commander');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const morgan = require('morgan');
const multer = require('multer');

// Import database module
const db = require('./database/db');

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error.message);
  console.error('Stack:', error.stack);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise);
  console.error('Reason:', reason);
});

// CLI Configuration
const program = new Command();

program
  .name('backend-course-2025-7')
  .description('Лабораторна робота №7: Docker та бази даних')
  .version('1.0.0');

program
  .option('-h, --host <host>', 'server host', '0.0.0.0')
  .option('-p, --port <port>', 'server port', '3000')
  .option('-c, --cache <path>', 'cache directory path', './cache');

program.parse(process.argv);
const options = program.opts();

// Initialize Express app
const app = express();

// Middleware
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(options.cache, 'photos');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${file.originalname}`;
    cb(null, uniqueName);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// In-memory cache for fallback
let inventoryCache = [];
let nextId = 1;

// Helper functions
function ensureCacheDirectory(cachePath) {
  try {
    if (!fs.existsSync(cachePath)) {
      fs.mkdirSync(cachePath, { recursive: true });
      console.log(`✅ Created cache directory: ${cachePath}`);
      
      const photosDir = path.join(cachePath, 'photos');
      if (!fs.existsSync(photosDir)) {
        fs.mkdirSync(photosDir, { recursive: true });
        console.log(`✅ Created photos directory: ${photosDir}`);
      }
    }
    return true;
  } catch (error) {
    console.error(`❌ Error creating cache directory: ${error.message}`);
    return false;
  }
}

function loadInventoryCache() {
  const cacheFile = path.join(options.cache, 'inventory.json');
  if (fs.existsSync(cacheFile)) {
    try {
      const data = fs.readFileSync(cacheFile, 'utf8');
      inventoryCache = JSON.parse(data);
      nextId = Math.max(...inventoryCache.map(item => item.id), 0) + 1;
      console.log(`✅ Loaded ${inventoryCache.length} items from cache`);
    } catch (error) {
      console.log('❌ Error loading cache, starting with empty inventory');
    }
  }
}

function saveInventoryCache() {
  const cacheFile = path.join(options.cache, 'inventory.json');
  try {
    fs.writeFileSync(cacheFile, JSON.stringify(inventoryCache, null, 2));
  } catch (error) {
    console.error('❌ Error saving cache:', error.message);
  }
}

// Routes

// Home page
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="uk">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Лабораторна робота №7 - Docker + PostgreSQL</title>
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                min-height: 100vh;
                color: #333;
            }
            .container { 
                max-width: 1200px; 
                margin: 0 auto; 
                padding: 20px; 
            }
            .header {
                background: white;
                border-radius: 10px;
                padding: 40px;
                margin-bottom: 30px;
                text-align: center;
                box-shadow: 0 10px 30px rgba(0,0,0,0.1);
            }
            .header h1 {
                color: #2c3e50;
                margin-bottom: 10px;
                font-size: 2.5em;
            }
            .header p {
                color: #7f8c8d;
                font-size: 1.2em;
            }
            .status-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                gap: 20px;
                margin: 30px 0;
            }
            .status-card {
                background: white;
                padding: 25px;
                border-radius: 10px;
                box-shadow: 0 5px 15px rgba(0,0,0,0.1);
                text-align: center;
            }
            .status-card h3 {
                color: #2c3e50;
                margin-bottom: 15px;
                font-size: 1.3em;
            }
            .nav-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 15px;
                margin: 30px 0;
            }
            .nav-card {
                background: white;
                padding: 25px;
                border-radius: 10px;
                box-shadow: 0 5px 15px rgba(0,0,0,0.1);
                text-align: center;
                text-decoration: none;
                color: #3498db;
                transition: transform 0.3s, box-shadow 0.3s;
            }
            .nav-card:hover {
                transform: translateY(-5px);
                box-shadow: 0 15px 30px rgba(0,0,0,0.2);
                color: #2980b9;
            }
            .nav-card h3 {
                margin-bottom: 10px;
                font-size: 1.2em;
            }
            .info {
                background: white;
                padding: 20px;
                border-radius: 10px;
                margin-top: 20px;
                box-shadow: 0 5px 15px rgba(0,0,0,0.1);
            }
            .status-badge {
                display: inline-block;
                padding: 5px 15px;
                border-radius: 20px;
                font-size: 0.9em;
                font-weight: bold;
                margin-top: 10px;
            }
            .status-online { background: #d4edda; color: #155724; }
            .status-offline { background: #f8d7da; color: #721c24; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🚀 Лабораторна робота №7</h1>
                <p>Docker + Express.js + PostgreSQL - Веб сервіс інвентаризації</p>
            </div>

            <div class="status-grid">
                <div class="status-card">
                    <h3>🌐 Сервер</h3>
                    <p>Статус: <span class="status-badge status-online">Online</span></p>
                    <p>Порт: ${options.port}</p>
                    <p>Хост: ${options.host}</p>
                </div>
                
                <div class="status-card">
                    <h3>🗄️ База даних</h3>
                    <p>PostgreSQL 15</p>
                    <p>База: ${process.env.DB_NAME}</p>
                    <p>Користувач: ${process.env.DB_USER}</p>
                </div>
                
                <div class="status-card">
                    <h3>🐳 Docker</h3>
                    <p>Контейнери: 2</p>
                    <p>Порти: 3000, 5432</p>
                    <p>Hot Reload: ✅</p>
                </div>
            </div>

            <div class="nav-grid">
                <a href="/docs" class="nav-card">
                    <h3>📚 Документація</h3>
                    <p>API документація Swagger</p>
                </a>
                
                <a href="/RegisterForm.html" class="nav-card">
                    <h3>📝 Реєстрація</h3>
                    <p>Додати новий пристрій</p>
                </a>
                
                <a href="/SearchForm.html" class="nav-card">
                    <h3>🔍 Пошук</h3>
                    <p>Знайти пристрій за ID</p>
                </a>
                
                <a href="/health" class="nav-card">
                    <h3>🩺 Health Check</h3>
                    <p>Перевірити стан системи</p>
                </a>
                
                <a href="/inventory" class="nav-card">
                    <h3>📦 Інвентар</h3>
                    <p>Переглянути всі пристрої</p>
                </a>
                
                <a href="/test-db" class="nav-card">
                    <h3>🧪 Тест БД</h3>
                    <p>Перевірити базу даних</p>
                </a>
            </div>

            <div class="info">
                <h3>📊 Інформація про систему</h3>
                <p><strong>Час запуску:</strong> ${new Date().toLocaleString()}</p>
                <p><strong>Середовище:</strong> ${process.env.NODE_ENV || 'development'}</p>
                <p><strong>Директорія кешу:</strong> ${path.resolve(options.cache)}</p>
                <p><strong>База даних:</strong> ${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}</p>
                <p><strong>Відлагодження:</strong> <a href="chrome://inspect" target="_blank">chrome://inspect</a> (порт 9229)</p>
            </div>
        </div>
    </body>
    </html>
  `);
});

// Health check endpoint
app.get('/health', async (req, res) => {
  const dbStatus = await db.checkDbConnection();
  res.json({
    status: 'ok',
    service: 'Backend Course 2025-7',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    database: dbStatus ? 'connected' : 'disconnected',
    server: {
      host: options.host,
      port: options.port,
      cache: options.cache
    },
    docker: {
      containers: 2,
      ports: [3000, 5432, 9229]
    }
  });
});

// Test database endpoint
app.get('/test-db', async (req, res) => {
  try {
    const dbInfo = await db.getDatabaseInfo();
    
    if (dbInfo.error) {
      throw new Error(dbInfo.error);
    }
    
    const productsCount = await db.query('SELECT COUNT(*) FROM products');
    
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Database Test</title>
        <style>
          body { font-family: Arial; padding: 20px; }
          .success { background: #d4edda; padding: 20px; border-radius: 5px; margin: 20px 0; }
          .error { background: #f8d7da; padding: 20px; border-radius: 5px; margin: 20px 0; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
          th { background: #f2f2f2; }
        </style>
      </head>
      <body>
        <h1>🧪 Тест бази даних</h1>
        
        <div class="success">
          <h3>✅ Підключення до PostgreSQL успішне!</h3>
          <p><strong>Версія:</strong> ${dbInfo.version}</p>
          <p><strong>База даних:</strong> ${dbInfo.database}</p>
          <p><strong>Таблиці:</strong> ${dbInfo.tables.join(', ')}</p>
          <p><strong>Кількість продуктів:</strong> ${productsCount.rows[0].count}</p>
        </div>
        
        <h2>📊 Дані з таблиці products:</h2>
        ${await getProductsTable()}
        
        <br>
        <a href="/">← На головну</a>
      </body>
      </html>
    `);
  } catch (error) {
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Database Test - Error</title>
        <style>
          body { font-family: Arial; padding: 20px; }
          .error { background: #f8d7da; padding: 20px; border-radius: 5px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <h1>🧪 Тест бази даних</h1>
        
        <div class="error">
          <h3>❌ Помилка підключення до бази даних</h3>
          <p><strong>Помилка:</strong> ${error.message}</p>
          <p><strong>Конфігурація:</strong></p>
          <ul>
            <li>Host: ${process.env.DB_HOST}</li>
            <li>Port: ${process.env.DB_PORT}</li>
            <li>Database: ${process.env.DB_NAME}</li>
            <li>User: ${process.env.DB_USER}</li>
          </ul>
        </div>
        
        <a href="/">← На головну</a>
      </body>
      </html>
    `);
  }
});

async function getProductsTable() {
  try {
    const result = await db.query('SELECT * FROM products ORDER BY id LIMIT 10');
    
    if (result.rows.length === 0) {
      return '<p>Таблиця products порожня</p>';
    }
    
    let table = '<table><tr><th>ID</th><th>Назва</th><th>Опис</th><th>Ціна</th><th>Кількість</th></tr>';
    
    result.rows.forEach(row => {
      table += `
        <tr>
          <td>${row.id}</td>
          <td>${row.name}</td>
          <td>${row.description || '-'}</td>
          <td>$${row.price}</td>
          <td>${row.stock_quantity}</td>
        </tr>
      `;
    });
    
    table += '</table>';
    return table;
  } catch (error) {
    return `<p>Помилка отримання даних: ${error.message}</p>`;
  }
}

// API Documentation
app.get('/docs', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="uk">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>API Documentation - Backend Course 2025-7</title>
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                background: #f5f5f5;
                color: #333;
                line-height: 1.6;
            }
            .container { 
                max-width: 1200px; 
                margin: 0 auto; 
                padding: 20px; 
            }
            .header {
                background: white;
                border-radius: 10px;
                padding: 40px;
                margin-bottom: 30px;
                text-align: center;
                box-shadow: 0 5px 15px rgba(0,0,0,0.1);
            }
            .header h1 {
                color: #2c3e50;
                margin-bottom: 10px;
                font-size: 2.5em;
            }
            .endpoints-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
                gap: 20px;
                margin-bottom: 30px;
            }
            .endpoint-card {
                background: white;
                border-radius: 10px;
                padding: 25px;
                box-shadow: 0 5px 15px rgba(0,0,0,0.1);
                transition: transform 0.3s;
                border-left: 5px solid;
            }
            .endpoint-card:hover {
                transform: translateY(-5px);
                box-shadow: 0 15px 30px rgba(0,0,0,0.2);
            }
            .endpoint-header {
                display: flex;
                align-items: center;
                margin-bottom: 15px;
            }
            .method {
                display: inline-block;
                padding: 6px 12px;
                border-radius: 4px;
                color: white;
                font-weight: bold;
                margin-right: 12px;
                font-size: 0.9em;
                min-width: 70px;
                text-align: center;
            }
            .get { background: #61affe; border-color: #61affe; }
            .post { background: #49cc90; border-color: #49cc90; }
            .put { background: #fca130; border-color: #fca130; }
            .delete { background: #f93e3e; border-color: #f93e3e; }
            .endpoint-url {
                font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
                font-size: 1.1em;
                color: #2c3e50;
                font-weight: 500;
            }
            .endpoint-card h3 {
                color: #2c3e50;
                margin-bottom: 12px;
                font-size: 1.3em;
            }
            .endpoint-details {
                margin-bottom: 15px;
            }
            .detail-item {
                margin-bottom: 8px;
                display: flex;
                align-items: flex-start;
            }
            .detail-label {
                font-weight: 600;
                color: #555;
                min-width: 120px;
            }
            .param {
                background: #e0e0e0;
                padding: 2px 6px;
                border-radius: 3px;
                font-family: monospace;
                font-size: 0.9em;
                margin: 0 2px;
            }
            .try-button {
                background: #3498db;
                color: white;
                padding: 10px 20px;
                border: none;
                border-radius: 5px;
                cursor: pointer;
                font-size: 0.9em;
                text-decoration: none;
                display: inline-block;
                transition: background 0.3s;
            }
            .try-button:hover {
                background: #2980b9;
            }
            .navigation {
                text-align: center;
                margin-top: 30px;
            }
            .nav-button {
                display: inline-block;
                background: white;
                color: #3498db;
                padding: 12px 25px;
                border-radius: 25px;
                text-decoration: none;
                font-weight: 600;
                transition: all 0.3s;
                margin: 0 10px;
                box-shadow: 0 5px 15px rgba(0,0,0,0.1);
            }
            .nav-button:hover {
                background: #3498db;
                color: white;
                transform: translateY(-2px);
                box-shadow: 0 10px 20px rgba(0,0,0,0.2);
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>📚 API Documentation</h1>
                <p>Повна документація REST API для сервісу інвентаризації</p>
            </div>

            <div class="endpoints-grid">
                <div class="endpoint-card" style="border-left-color: #61affe;">
                    <div class="endpoint-header">
                        <span class="method get">GET</span>
                        <span class="endpoint-url">/health</span>
                    </div>
                    <h3>Перевірка стану сервера</h3>
                    <div class="endpoint-details">
                        <div class="detail-item">
                            <span class="detail-label">Відповідь:</span>
                            <span>200 OK зі статусом БД</span>
                        </div>
                    </div>
                    <a href="/health" class="try-button">Виконати запит</a>
                </div>

                <div class="endpoint-card" style="border-left-color: #61affe;">
                    <div class="endpoint-header">
                        <span class="method get">GET</span>
                        <span class="endpoint-url">/inventory</span>
                    </div>
                    <h3>Отримання списку пристроїв</h3>
                    <div class="endpoint-details">
                        <div class="detail-item">
                            <span class="detail-label">Відповідь:</span>
                            <span>200 OK (JSON масив)</span>
                        </div>
                    </div>
                    <a href="/inventory" class="try-button">Виконати запит</a>
                </div>

                <div class="endpoint-card" style="border-left-color: #49cc90;">
                    <div class="endpoint-header">
                        <span class="method post">POST</span>
                        <span class="endpoint-url">/register</span>
                    </div>
                    <h3>Реєстрація пристрою</h3>
                    <div class="endpoint-details">
                        <div class="detail-item">
                            <span class="detail-label">Content-Type:</span>
                            <span>multipart/form-data</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Обов'язкові:</span>
                            <span><span class="param">name</span></span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Відповідь:</span>
                            <span>201 Created або 400 Bad Request</span>
                        </div>
                    </div>
                    <a href="/RegisterForm.html" class="try-button">Спробувати форму</a>
                </div>

                <div class="endpoint-card" style="border-left-color: #49cc90;">
                    <div class="endpoint-header">
                        <span class="method post">POST</span>
                        <span class="endpoint-url">/search</span>
                    </div>
                    <h3>Пошук пристрою</h3>
                    <div class="endpoint-details">
                        <div class="detail-item">
                            <span class="detail-label">Content-Type:</span>
                            <span>application/x-www-form-urlencoded</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Обов'язкові:</span>
                            <span><span class="param">id</span></span>
                        </div>
                    </div>
                    <a href="/SearchForm.html" class="try-button">Спробувати форму</a>
                </div>

                <div class="endpoint-card" style="border-left-color: #61affe;">
                    <div class="endpoint-header">
                        <span class="method get">GET</span>
                        <span class="endpoint-url">/products</span>
                    </div>
                    <h3>Отримання продуктів (RAW)</h3>
                    <div class="endpoint-details">
                        <div class="detail-item">
                            <span class="detail-label">Відповідь:</span>
                            <span>200 OK (RAW дані з БД)</span>
                        </div>
                    </div>
                    <a href="/products" class="try-button">Виконати запит</a>
                </div>

                <div class="endpoint-card" style="border-left-color: #61affe;">
                    <div class="endpoint-header">
                        <span class="method get">GET</span>
                        <span class="endpoint-url">/test-db</span>
                    </div>
                    <h3>Тест бази даних</h3>
                    <div class="endpoint-details">
                        <div class="detail-item">
                            <span class="detail-label">Відповідь:</span>
                            <span>HTML сторінка зі статусом БД</span>
                        </div>
                    </div>
                    <a href="/test-db" class="try-button">Виконати запит</a>
                </div>
            </div>

            <div class="navigation">
                <a href="/" class="nav-button">🏠 На головну</a>
                <a href="/RegisterForm.html" class="nav-button">📝 Форма реєстрації</a>
                <a href="/SearchForm.html" class="nav-button">🔍 Форма пошуку</a>
            </div>
        </div>
    </body>
    </html>
  `);
});

// API Endpoints

// Get all inventory items (from database)
app.get('/inventory', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT id, name, description, price, stock_quantity, 
             photo_filename, created_at, updated_at
      FROM products 
      ORDER BY id
    `);
    
    const itemsWithUrls = result.rows.map(item => ({
      ...item,
      photo_url: item.photo_filename ? `/photos/${item.photo_filename}` : null
    }));
    
    res.json({
      success: true,
      count: result.rows.length,
      data: itemsWithUrls
    });
  } catch (error) {
    console.error('Error getting inventory:', error);
    // Fallback to cache
    res.json({
      success: true,
      count: inventoryCache.length,
      data: inventoryCache,
      message: 'Using cached data (database unavailable)'
    });
  }
});

// Get all products (raw)
app.get('/products', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM products ORDER BY id');
    res.json(result.rows);
  } catch (error) {
    console.error('Error getting products:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Register new device (with file upload)
app.post('/register', upload.single('photo'), async (req, res) => {
  try {
    const { name, description, price = 0, stock_quantity = 0 } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: "Name is required" });
    }
    
    let photoFilename = null;
    if (req.file) {
      photoFilename = req.file.filename;
    }
    
    // Try to save to database
    try {
      const result = await db.query(`
        INSERT INTO products (name, description, price, stock_quantity, photo_filename)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `, [name, description || '', parseFloat(price), parseInt(stock_quantity), photoFilename]);
      
      res.status(201).json({
        success: true,
        message: 'Device registered successfully',
        data: result.rows[0]
      });
    } catch (dbError) {
      console.error('Database error, using cache:', dbError);
      
      // Fallback to cache
      const newItem = {
        id: nextId++,
        name,
        description: description || '',
        price: parseFloat(price),
        stock_quantity: parseInt(stock_quantity),
        photo_filename: photoFilename,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      inventoryCache.push(newItem);
      saveInventoryCache();
      
      res.status(201).json({
        success: true,
        message: 'Device registered to cache (database unavailable)',
        data: newItem
      });
    }
  } catch (error) {
    console.error('Error registering device:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Search device by ID
app.post('/search', async (req, res) => {
  try {
    const { id, has_photo } = req.body;
    const itemId = parseInt(id);
    
    if (!itemId) {
      return res.status(400).json({ error: 'ID is required' });
    }
    
    // Try database first
    try {
      const result = await db.query(`
        SELECT id, name, description, price, stock_quantity, photo_filename
        FROM products 
        WHERE id = $1
      `, [itemId]);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Device not found' });
      }
      
      let item = result.rows[0];
      
      if (has_photo === 'true' && item.photo_filename) {
        item.description = `${item.description} [Photo: /photos/${item.photo_filename}]`.trim();
      }
      
      item.photo_url = item.photo_filename ? `/photos/${item.photo_filename}` : null;
      
      res.json({
        success: true,
        data: item
      });
    } catch (dbError) {
      console.error('Database error, using cache:', dbError);
      
      // Fallback to cache
      const item = inventoryCache.find(item => item.id === itemId);
      
      if (!item) {
        return res.status(404).json({ error: 'Device not found' });
      }
      
      if (has_photo === 'true' && item.photo_filename) {
        item.description = `${item.description} [Photo: /photos/${item.photo_filename}]`.trim();
      }
      
      item.photo_url = item.photo_filename ? `/photos/${item.photo_filename}` : null;
      
      res.json({
        success: true,
        data: item,
        message: 'Data from cache (database unavailable)'
      });
    }
  } catch (error) {
    console.error('Error searching device:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Serve uploaded photos
app.use('/photos', express.static(path.join(options.cache, 'photos')));

// Static files
app.use('/RegisterForm.html', express.static('public/RegisterForm.html'));
app.use('/SearchForm.html', express.static('public/SearchForm.html'));

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Route not found',
    available_routes: [
      { method: 'GET', path: '/' },
      { method: 'GET', path: '/health' },
      { method: 'GET', path: '/docs' },
      { method: 'GET', path: '/inventory' },
      { method: 'POST', path: '/register' },
      { method: 'POST', path: '/search' }
    ]
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Application error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Start server function
async function startServer() {
  console.log('\n🚀 Запуск сервера Backend Course 2025-7...');
  console.log('📊 Параметри запуску:');
  console.log(`   Host: ${options.host}`);
  console.log(`   Port: ${options.port}`);
  console.log(`   Cache: ${options.cache}`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🗄️  Database: ${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`);
  
  // Ensure cache directory exists
  if (!ensureCacheDirectory(options.cache)) {
    console.log('⚠️  Продовжуємо без повної підтримки кешу');
  }
  
  // Load cache
  loadInventoryCache();
  
  // Test database connection
  console.log('🔄 Тестування підключення до бази даних...');
  const dbConnected = await db.checkDbConnection();
  
  if (dbConnected) {
    console.log('📝 Ініціалізація бази даних...');
    await db.initDatabase();
    
    // Get database info
    const dbInfo = await db.getDatabaseInfo();
    console.log('📊 Інформація про базу даних:');
    console.log(`   Версія: ${dbInfo.version}`);
    console.log(`   База даних: ${dbInfo.database}`);
    console.log(`   Таблиці: ${dbInfo.tables ? dbInfo.tables.join(', ') : 'немає'}`);
  } else {
    console.warn('⚠️  База даних недоступна. Використовується режим кешу.');
    console.warn('    Функціональність буде обмежена.');
  }
  
  // Start the server
  const server = app.listen(options.port, options.host, () => {
    console.log(`\n✅ Express сервер запущено успішно!`);
    console.log(`🌐 Головна сторінка: http://localhost:${options.port}`);
    console.log(`🩺 Health check: http://localhost:${options.port}/health`);
    console.log(`📚 Документація: http://localhost:${options.port}/docs`);
    console.log(`🗄️  Тест БД: http://localhost:${options.port}/test-db`);
    console.log(`📝 Форма реєстрації: http://localhost:${options.port}/RegisterForm.html`);
    console.log(`🔍 Форма пошуку: http://localhost:${options.port}/SearchForm.html`);
    console.log(`📦 Інвентар API: http://localhost:${options.port}/inventory`);
    console.log(`\n🐳 Docker відлагодження:`);
    console.log('   Відкрийте Chrome та перейдіть за адресою: chrome://inspect');
    console.log('   Натисніть "Configure" та додайте: localhost:9229');
    console.log(`\n⏰ Час запуску: ${new Date().toLocaleString()}`);
    console.log('🛑 Для зупинки сервера натисніть Ctrl+C\n');
  });
  
  // Handle server errors
  server.on('error', (error) => {
    console.error('❌ Помилка сервера:', error.message);
    if (error.code === 'EADDRINUSE') {
      console.error(`   Порт ${options.port} вже використовується!`);
      console.error('   Спробуйте: docker-compose down та docker-compose up --build');
    }
    process.exit(1);
  });
  
  // Graceful shutdown
  const shutdown = () => {
    console.log('\n🛑 Отримано сигнал завершення. Зупинка сервера...');
    server.close(async () => {
      console.log('✅ HTTP сервер зупинено');
      
      try {
        await db.pool.end();
        console.log('✅ Підключення до бази даних закрито');
      } catch (err) {
        console.error('❌ Помилка закриття підключення до БД:', err.message);
      }
      
      console.log('👋 Сервер зупинено. До побачення!');
      process.exit(0);
    });
    
    // Force shutdown after 5 seconds
    setTimeout(() => {
      console.error('❌ Примусова зупинка через таймаут');
      process.exit(1);
    }, 5000);
  };
  
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

// Start the server
startServer().catch(error => {
  console.error('❌ Критична помилка при запуску сервера:', error);
  console.error(error.stack);
  process.exit(1);
});