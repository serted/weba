
#!/bin/bash

echo "🔧 Настройка базы данных SQLite..."

# Создаем директории
mkdir -p ~/.webapp/db
mkdir -p ~/.webapp/logs
mkdir -p reports

# Устанавливаем права доступа
chmod 755 ~/.webapp
chmod 755 ~/.webapp/db
chmod 755 ~/.webapp/logs

# Создаем SQLite базу данных
DB_PATH="$HOME/.webapp/db/webapp.sqlite"

if [ ! -f "$DB_PATH" ]; then
    echo "🗄️ Создание SQLite базы данных..."
    sqlite3 "$DB_PATH" "SELECT 1;" 2>/dev/null || {
        echo "❌ Ошибка: SQLite не установлен"
        exit 1
    }
    echo "✅ SQLite база данных создана: $DB_PATH"
else
    echo "✅ SQLite база данных уже существует: $DB_PATH"
fi

echo "✅ SQLite база данных настроена!"
echo "✅ Путь к БД: $DB_PATH"

# Обновляем .env файл для использования SQLite
if [ -f .env ]; then
    sed -i 's/DB_HOST=.*/DB_HOST=/' .env
    sed -i 's/DB_PORT=.*/DB_PORT=/' .env
    sed -i 's/DB_NAME=.*/DB_NAME=webapp/' .env
    sed -i 's/DB_USER=.*/DB_USER=/' .env
    sed -i 's/DB_PASS=.*/DB_PASS=/' .env
    
    # Добавляем путь к SQLite если его нет
    if ! grep -q "DB_SQLITE_PATH" .env; then
        echo "DB_SQLITE_PATH=$DB_PATH" >> .env
    else
        sed -i "s|DB_SQLITE_PATH=.*|DB_SQLITE_PATH=$DB_PATH|" .env
    fi
    echo "✅ Конфигурация .env обновлена для SQLite"
fi

echo "✅ Настройка завершена успешно!"
