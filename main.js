const { Command } = require('commander');
const express = require('express');
const fs = require('fs');
const path = require('path');

const program = new Command();

program
  .name('backend-course-2025-6')
  .description('CLI for backend course 2025-6')
  .version('1.0.0');

program
  .requiredOption('-h, --host <host>', 'адреса сервера (обовʼязковий)')
  .requiredOption('-p, --port <port>', 'порт сервера (обовʼязковий)')
  .requiredOption('-c, --cache <path>', 'шлях до директорії кешу (обовʼязковий)');

program.parse(process.argv);

const options = program.opts();

// Ініціалізація Express додатку
const app = express();

// Модель даних для інвентаря
let inventory = [];
let nextId = 1;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Функція для збереження даних
function saveInventory() {
  const dataPath = path.join(options.cache, 'inventory.json');
  fs.writeFileSync(dataPath, JSON.stringify(inventory, null, 2));
}

// Функція для завантаження даних
function loadInventory() {
  const dataPath = path.join(options.cache, 'inventory.json');
  if (fs.existsSync(dataPath)) {
    try {
      inventory = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
      nextId = Math.max(...inventory.map(item => item.id), 0) + 1;
      console.log(`✅ Завантажено ${inventory.length} записів інвентаря`);
    } catch (error) {
      console.log('❌ Помилка завантаження інвентаря, створюємо новий');
    }
  }
}

// Функція для створення директорії кешу
function ensureCacheDirectory(cachePath) {
  try {
    if (!fs.existsSync(cachePath)) {
      fs.mkdirSync(cachePath, { recursive: true });
      console.log(`✅ Створено директорію кешу: ${cachePath}`);
    }
    
    const photosDir = path.join(cachePath, 'photos');
    if (!fs.existsSync(photosDir)) {
      fs.mkdirSync(photosDir, { recursive: true });
      console.log(`✅ Створено директорію для фото: ${photosDir}`);
    }
    
    return true;
  } catch (error) {
    console.error(`❌ Помилка при створенні директорії кешу: ${error.message}`);
    return false;
  }
}

// Функція для парсингу multipart/form-data
function parseMultipartFormData(body, boundary) {
  const parts = body.split(`--${boundary}`);
  const result = {};
  
  for (const part of parts) {
    if (part.includes('Content-Disposition: form-data')) {
      const match = part.match(/name="([^"]+)"(?:\s*;\s*filename="([^"]+)")?/);
      if (match) {
        const name = match[1];
        const filename = match[2];
        
        const dataStart = part.indexOf('\r\n\r\n') + 4;
        const dataEnd = part.lastIndexOf('\r\n');
        
        if (dataStart < dataEnd) {
          const data = part.substring(dataStart, dataEnd);
          
          if (filename) {
            result[name] = {
              filename: filename,
              data: Buffer.from(data, 'binary'),
              mimetype: part.match(/Content-Type: ([^\r\n]+)/)?.[1] || 'application/octet-stream'
            };
          } else {
            result[name] = data;
          }
        }
      }
    }
  }
  
  return result;
}

// Функція для отримання тіла запиту
function getRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = [];
    req.on('data', chunk => {
      body.push(chunk);
    });
    req.on('end', () => {
      resolve(Buffer.concat(body));
    });
    req.on('error', reject);
  });
}

// HTML форми
const registerFormHTML = `
<!DOCTYPE html>
<html lang="uk">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Реєстрація пристрою</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; }
        .form-group { margin-bottom: 15px; }
        label { display: block; margin-bottom: 5px; font-weight: bold; }
        input, textarea { width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; }
        button { background: #007bff; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; }
        button:hover { background: #0056b3; }
        .nav { margin: 20px 0; }
        .nav a { color: #007bff; text-decoration: none; margin-right: 15px; }
        .nav a:hover { text-decoration: underline; }
    </style>
</head>
<body>
    <div class="nav">
        <a href="/">🏠 Головна</a>
        <a href="/docs">📚 Документація</a>
        <a href="/SearchForm.html">🔍 Пошук</a>
    </div>
    
    <h1>📝 Реєстрація нового пристрою</h1>
    <form action="/register" method="POST" enctype="multipart/form-data">
        <div class="form-group">
            <label for="inventory_name">Назва пристрою *</label>
            <input type="text" id="inventory_name" name="inventory_name" required>
        </div>
        <div class="form-group">
            <label for="description">Опис пристрою</label>
            <textarea id="description" name="description" rows="4"></textarea>
        </div>
        <div class="form-group">
            <label for="photo">Фото пристрою</label>
            <input type="file" id="photo" name="photo" accept="image/*">
        </div>
        <button type="submit">Зареєструвати</button>
    </form>
</body>
</html>
`;

const searchFormHTML = `
<!DOCTYPE html>
<html lang="uk">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Пошук пристрою</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; }
        .form-group { margin-bottom: 15px; }
        label { display: block; margin-bottom: 5px; font-weight: bold; }
        input { width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; }
        button { background: #28a745; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; }
        button:hover { background: #218838; }
        .checkbox { display: flex; align-items: center; gap: 8px; }
        .checkbox input { width: auto; }
        .nav { margin: 20px 0; }
        .nav a { color: #007bff; text-decoration: none; margin-right: 15px; }
        .nav a:hover { text-decoration: underline; }
    </style>
</head>
<body>
    <div class="nav">
        <a href="/">🏠 Головна</a>
        <a href="/docs">📚 Документація</a>
        <a href="/RegisterForm.html">📝 Реєстрація</a>
    </div>
    
    <h1>🔍 Пошук пристрою</h1>
    <form action="/search" method="POST">
        <div class="form-group">
            <label for="id">ID пристрою</label>
            <input type="number" id="id" name="id" required min="1">
        </div>
        <div class="form-group checkbox">
            <input type="checkbox" id="has_photo" name="has_photo" value="true">
            <label for="has_photo">Додати посилання на фото до опису</label>
        </div>
        <button type="submit">Шукати</button>
    </form>
</body>
</html>
`;

// Swagger документація з клікабельними посиланнями
const swaggerHTML = `
<!DOCTYPE html>
<html lang="uk">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Backend Course 2025-6 - API Documentation</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }
        .header {
            background: white;
            border-radius: 10px;
            padding: 30px;
            margin-bottom: 20px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            text-align: center;
        }
        .header h1 {
            color: #2c3e50;
            margin-bottom: 10px;
            font-size: 2.5em;
        }
        .header p {
            color: #7f8c8d;
            font-size: 1.1em;
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
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            transition: transform 0.3s ease, box-shadow 0.3s ease;
            border-left: 5px solid;
        }
        .endpoint-card:hover {
            transform: translateY(-5px);
            box-shadow: 0 8px 15px rgba(0,0,0,0.2);
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
            transition: background 0.3s ease;
        }
        .try-button:hover {
            background: #2980b9;
            text-decoration: none;
            color: white;
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
            transition: all 0.3s ease;
            margin: 0 10px;
        }
        .nav-button:hover {
            background: #3498db;
            color: white;
            text-decoration: none;
            transform: translateY(-2px);
        }
        .response {
            background: #f8f9fa;
            border: 1px solid #e9ecef;
            border-radius: 5px;
            padding: 10px;
            margin-top: 10px;
            font-family: monospace;
            font-size: 0.9em;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 Backend Course 2025-6 API Documentation</h1>
            <p>Повна документація REST API для сервісу інвентаризації пристроїв</p>
        </div>

        <div class="endpoints-grid">
            <!-- POST /register -->
            <div class="endpoint-card" style="border-left-color: #49cc90;">
                <div class="endpoint-header">
                    <span class="method post">POST</span>
                    <span class="endpoint-url">/register</span>
                </div>
                <h3>Реєстрація нового пристрою</h3>
                <div class="endpoint-details">
                    <div class="detail-item">
                        <span class="detail-label">Content-Type:</span>
                        <span>multipart/form-data</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Обов'язкові:</span>
                        <span><span class="param">inventory_name</span></span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Опціональні:</span>
                        <span><span class="param">description</span>, <span class="param">photo</span></span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Відповідь:</span>
                        <span>201 Created (успіх) або 400 Bad Request (помилка)</span>
                    </div>
                </div>
                <a href="/RegisterForm.html" class="try-button">Спробувати форму</a>
            </div>

            <!-- GET /inventory -->
            <div class="endpoint-card" style="border-left-color: #61affe;">
                <div class="endpoint-header">
                    <span class="method get">GET</span>
                    <span class="endpoint-url">/inventory</span>
                </div>
                <h3>Отримання списку всіх пристроїв</h3>
                <div class="endpoint-details">
                    <div class="detail-item">
                        <span class="detail-label">Відповідь:</span>
                        <span>200 OK (JSON масив)</span>
                    </div>
                </div>
                <a href="/inventory" class="try-button">Виконати запит</a>
            </div>

            <!-- GET /inventory/:id -->
            <div class="endpoint-card" style="border-left-color: #61affe;">
                <div class="endpoint-header">
                    <span class="method get">GET</span>
                    <span class="endpoint-url">/inventory/<span class="param">:id</span></span>
                </div>
                <h3>Отримання інформації про пристрій</h3>
                <div class="endpoint-details">
                    <div class="detail-item">
                        <span class="detail-label">Параметри:</span>
                        <span><span class="param">id</span> - ідентифікатор пристрою</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Відповідь:</span>
                        <span>200 OK або 404 Not Found</span>
                    </div>
                </div>
                <div class="response">Приклад: /inventory/1</div>
            </div>

            <!-- PUT /inventory/:id -->
            <div class="endpoint-card" style="border-left-color: #fca130;">
                <div class="endpoint-header">
                    <span class="method put">PUT</span>
                    <span class="endpoint-url">/inventory/<span class="param">:id</span></span>
                </div>
                <h3>Оновлення інформації про пристрій</h3>
                <div class="endpoint-details">
                    <div class="detail-item">
                        <span class="detail-label">Content-Type:</span>
                        <span>application/json</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Поля:</span>
                        <span><span class="param">inventory_name</span>, <span class="param">description</span></span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Відповідь:</span>
                        <span>200 OK або 404 Not Found</span>
                    </div>
                </div>
            </div>

            <!-- DELETE /inventory/:id -->
            <div class="endpoint-card" style="border-left-color: #f93e3e;">
                <div class="endpoint-header">
                    <span class="method delete">DELETE</span>
                    <span class="endpoint-url">/inventory/<span class="param">:id</span></span>
                </div>
                <h3>Видалення пристрою</h3>
                <div class="endpoint-details">
                    <div class="detail-item">
                        <span class="detail-label">Відповідь:</span>
                        <span>200 OK або 404 Not Found</span>
                    </div>
                </div>
            </div>

            <!-- GET /inventory/:id/photo -->
            <div class="endpoint-card" style="border-left-color: #61affe;">
                <div class="endpoint-header">
                    <span class="method get">GET</span>
                    <span class="endpoint-url">/inventory/<span class="param">:id</span>/photo</span>
                </div>
                <h3>Отримання фото пристрою</h3>
                <div class="endpoint-details">
                    <div class="detail-item">
                        <span class="detail-label">Content-Type:</span>
                        <span>image/jpeg</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Відповідь:</span>
                        <span>200 OK або 404 Not Found</span>
                    </div>
                </div>
            </div>

            <!-- PUT /inventory/:id/photo -->
            <div class="endpoint-card" style="border-left-color: #fca130;">
                <div class="endpoint-header">
                    <span class="method put">PUT</span>
                    <span class="endpoint-url">/inventory/<span class="param">:id</span>/photo</span>
                </div>
                <h3>Оновлення фото пристрою</h3>
                <div class="endpoint-details">
                    <div class="detail-item">
                        <span class="detail-label">Content-Type:</span>
                        <span>multipart/form-data</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Відповідь:</span>
                        <span>200 OK або 404 Not Found</span>
                    </div>
                </div>
            </div>

            <!-- POST /search -->
            <div class="endpoint-card" style="border-left-color: #49cc90;">
                <div class="endpoint-header">
                    <span class="method post">POST</span>
                    <span class="endpoint-url">/search</span>
                </div>
                <h3>Пошук пристрою за ID</h3>
                <div class="endpoint-details">
                    <div class="detail-item">
                        <span class="detail-label">Content-Type:</span>
                        <span>application/x-www-form-urlencoded</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Обов'язкові:</span>
                        <span><span class="param">id</span></span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Опціональні:</span>
                        <span><span class="param">has_photo</span></span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Відповідь:</span>
                        <span>200 OK або 404 Not Found</span>
                    </div>
                </div>
                <a href="/SearchForm.html" class="try-button">Спробувати форму</a>
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
`;

// Маршрути Express

/**
 * GET /
 * Головна сторінка сервера
 */
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="uk">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Backend Course 2025-6</title>
        <style>
            body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; background: #f5f5f5; }
            .header { background: white; padding: 30px; border-radius: 10px; text-align: center; margin-bottom: 20px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
            .card { background: white; padding: 20px; border-radius: 10px; margin-bottom: 15px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
            .nav { display: flex; gap: 10px; flex-wrap: wrap; margin: 20px 0; }
            .nav a { background: #007bff; color: white; padding: 10px 20px; border-radius: 5px; text-decoration: none; transition: background 0.3s; }
            .nav a:hover { background: #0056b3; }
            .info-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 20px 0; }
            .info-item { background: #e9ecef; padding: 15px; border-radius: 5px; text-align: center; }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>🚀 Веб сервер Backend Course 2025-6</h1>
            <p>Сервіс інвентаризації пристроїв з повною документацією та веб формами</p>
        </div>

        <div class="info-grid">
            <div class="info-item">
                <strong>Host:</strong><br>${options.host}
            </div>
            <div class="info-item">
                <strong>Port:</strong><br>${options.port}
            </div>
            <div class="info-item">
                <strong>Cache directory:</strong><br>${options.cache}
            </div>
            <div class="info-item">
                <strong>Час запуску:</strong><br>${new Date().toLocaleString()}
            </div>
        </div>

        <div class="nav">
            <a href="/docs">📖 Документація API</a>
            <a href="/RegisterForm.html">📝 Реєстрація пристрою</a>
            <a href="/SearchForm.html">🔍 Пошук пристрою</a>
            <a href="/inventory">📦 Перегляд інвентаря</a>
        </div>

        <div class="card">
            <h2>🌐 Веб форми:</h2>
            <ul>
                <li><a href="/RegisterForm.html">📝 Форма реєстрації пристрою</a> - додавання нового пристрою до системи</li>
                <li><a href="/SearchForm.html">🔍 Форма пошуку пристрою</a> - пошук пристрою за ID з опцією фото</li>
            </ul>
        </div>

        <div class="card">
            <h2>📚 Документація:</h2>
            <ul>
                <li><a href="/docs">📖 API Documentation (Swagger)</a> - повна документація всіх ендпоінтів</li>
            </ul>
        </div>

        <div class="card">
            <h2>🔧 Основні API ендпоінти:</h2>
            <ul>
                <li><code>GET /inventory</code> - отримання списку всіх пристроїв</li>
                <li><code>POST /register</code> - реєстрація нового пристрою</li>
                <li><code>GET /inventory/:id</code> - отримання інформації про конкретний пристрій</li>
                <li><code>PUT /inventory/:id</code> - оновлення інформації про пристрій</li>
                <li><code>DELETE /inventory/:id</code> - видалення пристрою</li>
                <li><code>GET /inventory/:id/photo</code> - отримання фото пристрою</li>
                <li><code>PUT /inventory/:id/photo</code> - оновлення фото пристрою</li>
                <li><code>POST /search</code> - пошук пристрою за ID</li>
            </ul>
        </div>
    </body>
    </html>
  `);
});

/**
 * GET /docs
 * Swagger документація API
 */
app.get('/docs', (req, res) => {
  res.send(swaggerHTML);
});

/**
 * GET /RegisterForm.html
 * Веб форма для реєстрації пристрою
 */
app.get('/RegisterForm.html', (req, res) => {
  res.send(registerFormHTML);
});

/**
 * GET /SearchForm.html
 * Веб форма для пошуку пристрою
 */
app.get('/SearchForm.html', (req, res) => {
  res.send(searchFormHTML);
});

/**
 * POST /register
 * Реєстрація нового пристрою
 */
app.post('/register', async (req, res) => {
  try {
    const contentType = req.headers['content-type'];
    
    if (!contentType || !contentType.includes('multipart/form-data')) {
      return res.status(400).json({ error: 'Очікується multipart/form-data' });
    }

    const boundary = contentType.split('boundary=')[1];
    const body = await getRequestBody(req);
    const formData = parseMultipartFormData(body.toString('binary'), boundary);

    if (!formData.inventory_name) {
      return res.status(400).json({ error: "Поле 'inventory_name' є обов'язковим" });
    }

    const newItem = {
      id: nextId++,
      inventory_name: formData.inventory_name,
      description: formData.description || '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    if (formData.photo && formData.photo.data) {
      const photoExtension = path.extname(formData.photo.filename) || '.jpg';
      const photoFilename = `${newItem.id}${photoExtension}`;
      const photoPath = path.join(options.cache, 'photos', photoFilename);
      
      fs.writeFileSync(photoPath, formData.photo.data);
      newItem.photo_filename = photoFilename;
    }

    inventory.push(newItem);
    saveInventory();

    res.status(201).json({
      message: 'Пристрій успішно зареєстровано',
      item: newItem
    });
  } catch (error) {
    console.error('Помилка реєстрації:', error);
    res.status(500).json({ error: 'Внутрішня помилка сервера' });
  }
});

/**
 * GET /inventory
 * Отримання списку всіх пристроїв
 */
app.get('/inventory', (req, res) => {
  const itemsWithUrls = inventory.map(item => ({
    ...item,
    photo_url: item.photo_filename ? `/inventory/${item.id}/photo` : null
  }));
  res.json(itemsWithUrls);
});

/**
 * GET /inventory/:id
 * Отримання інформації про конкретний пристрій
 */
app.get('/inventory/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const item = inventory.find(item => item.id === id);

  if (!item) {
    return res.status(404).json({ error: 'Пристрій з таким ID не знайдено' });
  }

  const itemWithUrl = {
    ...item,
    photo_url: item.photo_filename ? `/inventory/${item.id}/photo` : null
  };

  res.json(itemWithUrl);
});

/**
 * PUT /inventory/:id
 * Оновлення інформації про пристрій
 */
app.put('/inventory/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const itemIndex = inventory.findIndex(item => item.id === id);

  if (itemIndex === -1) {
    return res.status(404).json({ error: 'Пристрій з таким ID не знайдено' });
  }

  const { inventory_name, description } = req.body;

  if (inventory_name !== undefined) {
    inventory[itemIndex].inventory_name = inventory_name;
  }
  if (description !== undefined) {
    inventory[itemIndex].description = description;
  }
  
  inventory[itemIndex].updated_at = new Date().toISOString();
  saveInventory();

  res.json({
    message: 'Інформацію успішно оновлено',
    item: inventory[itemIndex]
  });
});

/**
 * DELETE /inventory/:id
 * Видалення пристрою
 */
app.delete('/inventory/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const itemIndex = inventory.findIndex(item => item.id === id);

  if (itemIndex === -1) {
    return res.status(404).json({ error: 'Пристрій з таким ID не знайдено' });
  }

  const item = inventory[itemIndex];
  if (item.photo_filename) {
    const photoPath = path.join(options.cache, 'photos', item.photo_filename);
    if (fs.existsSync(photoPath)) {
      fs.unlinkSync(photoPath);
    }
  }

  inventory.splice(itemIndex, 1);
  saveInventory();

  res.json({ message: 'Пристрій успішно видалено' });
});

/**
 * GET /inventory/:id/photo
 * Отримання фото пристрою
 */
app.get('/inventory/:id/photo', (req, res) => {
  const id = parseInt(req.params.id);
  const item = inventory.find(item => item.id === id);

  if (!item) {
    return res.status(404).json({ error: 'Пристрій з таким ID не знайдено' });
  }

  if (!item.photo_filename) {
    return res.status(404).json({ error: 'Фото для цього пристрою не знайдено' });
  }

  const photoPath = path.join(options.cache, 'photos', item.photo_filename);
  
  if (!fs.existsSync(photoPath)) {
    return res.status(404).json({ error: 'Файл фото не знайдено' });
  }

  res.sendFile(photoPath);
});

/**
 * PUT /inventory/:id/photo
 * Оновлення фото пристрою
 */
app.put('/inventory/:id/photo', async (req, res) => {
  try {
    const contentType = req.headers['content-type'];
    
    if (!contentType || !contentType.includes('multipart/form-data')) {
      return res.status(400).json({ error: 'Очікується multipart/form-data' });
    }

    const id = parseInt(req.params.id);
    const itemIndex = inventory.findIndex(item => item.id === id);

    if (itemIndex === -1) {
      return res.status(404).json({ error: 'Пристрій з таким ID не знайдено' });
    }

    const boundary = contentType.split('boundary=')[1];
    const body = await getRequestBody(req);
    const formData = parseMultipartFormData(body.toString('binary'), boundary);

    if (!formData.photo || !formData.photo.data) {
      return res.status(400).json({ error: 'Фото не надано' });
    }

    const oldPhotoFilename = inventory[itemIndex].photo_filename;
    if (oldPhotoFilename) {
      const oldPhotoPath = path.join(options.cache, 'photos', oldPhotoFilename);
      if (fs.existsSync(oldPhotoPath)) {
        fs.unlinkSync(oldPhotoPath);
      }
    }

    const photoExtension = path.extname(formData.photo.filename) || '.jpg';
    const photoFilename = `${id}${photoExtension}`;
    const photoPath = path.join(options.cache, 'photos', photoFilename);
    
    fs.writeFileSync(photoPath, formData.photo.data);
    inventory[itemIndex].photo_filename = photoFilename;
    inventory[itemIndex].updated_at = new Date().toISOString();
    saveInventory();

    res.json({
      message: 'Фото успішно оновлено',
      photo_url: `/inventory/${id}/photo`
    });
  } catch (error) {
    console.error('Помилка оновлення фото:', error);
    res.status(500).json({ error: 'Внутрішня помилка сервера' });
  }
});

/**
 * POST /search
 * Пошук пристрою за ID
 */
app.post('/search', (req, res) => {
  const { id, has_photo } = req.body;
  const itemId = parseInt(id);

  if (!itemId) {
    return res.status(400).json({ error: 'ID є обов\'язковим полем' });
  }

  const item = inventory.find(item => item.id === itemId);

  if (!item) {
    return res.status(404).json({ error: 'Пристрій з таким ID не знайдено' });
  }

  let result = { ...item };
  
  if (has_photo === 'true' && item.photo_filename) {
    result.description = `${result.description} [Фото: /inventory/${itemId}/photo]`.trim();
  }

  result.photo_url = item.photo_filename ? `/inventory/${itemId}/photo` : null;
  
  res.json(result);
});

// Обробка незнайдених маршрутів - ВИПРАВЛЕНА ВЕРСІЯ
app.use((req, res) => {
  res.status(404).json({ error: 'Маршрут не знайдено' });
});

// Головна функція запуску
function startServer() {
  console.log('🔧 Запуск сервера з Express.js...');
  console.log(`📊 Параметри:`);
  console.log(`   Host: ${options.host}`);
  console.log(`   Port: ${options.port}`);
  console.log(`   Cache: ${options.cache}`);

  if (!ensureCacheDirectory(options.cache)) {
    process.exit(1);
  }

  loadInventory();

  app.listen(options.port, options.host, () => {
    console.log('✅ Express сервер запущено успішно!');
    console.log(`🌐 Сервер доступний за адресою: http://${options.host}:${options.port}`);
    console.log(`📁 Директорія кешу: ${path.resolve(options.cache)}`);
    console.log('📚 Документація доступна за адресою: http://localhost:3000/docs');
    console.log('🌐 Веб форми доступні за адресою: http://localhost:3000/RegisterForm.html');
    console.log('⏰ Сервер запущено:', new Date().toLocaleString());
    console.log('🛑 Для зупинки сервера натисніть Ctrl+C');
  });

  process.on('SIGINT', () => {
    console.log('\n🛑 Зупинка сервера...');
    console.log('✅ Express сервер зупинено');
    process.exit(0);
  });
}

// Запускаємо сервер
startServer();


// '5' == 5 => true
// '5' === 5 => false