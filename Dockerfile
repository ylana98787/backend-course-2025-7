# Використовуємо офіційний образ Node.js як базовий
FROM node:20-alpine

# Встановлюємо робочий каталог у контейнері
WORKDIR /usr/src/app

# Копіюємо package.json та package-lock.json (якщо є)
COPY package*.json ./

# Встановлюємо залежності
RUN npm install

# Копіюємо решту коду програми у робочий каталог
COPY . .

# Відкриваємо порт, на якому працює Express.js (зазвичай 3000)
EXPOSE 3000

# Команда для запуску додатка
CMD [ "npm", "start" ]