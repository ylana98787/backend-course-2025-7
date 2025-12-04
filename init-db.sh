-- init-db.sql
-- Database initialization script for Backend Course 2025-7

-- Create products table if not exists
CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    stock_quantity INTEGER DEFAULT 0,
    photo_filename VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster search
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);

-- Insert sample data only if table is empty
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM products LIMIT 1) THEN
        INSERT INTO products (name, description, price, stock_quantity) VALUES
            ('Модуль Node.js', 'Високопродуктивний мережевий модуль', 120.50, 50),
            ('Ліцензія Express Pro', 'Ліцензія для комерційного використання Express.js', 999.00, 10),
            ('Docker Container', 'Контейнер для запуску додатків', 49.99, 100),
            ('PostgreSQL Database', 'Продвинута система управління базами даних', 299.99, 25),
            ('Nginx Web Server', 'Високопродуктивний веб сервер', 89.99, 75);
        
        RAISE NOTICE '✅ Sample data inserted into products table';
    ELSE
        RAISE NOTICE '📊 Products table already contains data';
    END IF;
END $$;