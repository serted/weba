
#!/bin/bash

echo "🔧 Настройка MySQL..."

# Проверяем, запущен ли MySQL
if ! pgrep mysql > /dev/null; then
    echo "🚀 Запуск MySQL сервера..."
    sudo service mysql start
    sleep 5
fi

# Проверяем подключение
if ! mysql -u webapp -psecret -e "SELECT 1;" webapp 2>/dev/null; then
    echo "🗄️ Создание базы данных и пользователя..."
    
    # Создаем базу данных
    sudo mysql -e "CREATE DATABASE IF NOT EXISTS webapp CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
    
    # Создаем пользователя
    sudo mysql -e "CREATE USER IF NOT EXISTS 'webapp'@'localhost' IDENTIFIED BY 'secret';"
    sudo mysql -e "GRANT ALL PRIVILEGES ON webapp.* TO 'webapp'@'localhost';"
    sudo mysql -e "FLUSH PRIVILEGES;"
    
    echo "✅ MySQL настроен успешно!"
else
    echo "✅ MySQL уже работает корректно!"
fi
