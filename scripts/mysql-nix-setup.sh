
#!/bin/bash

echo "🔧 Настройка MySQL в Nix окружении..."

# Создаем директорию для MySQL данных
mkdir -p ~/.mysql/data
mkdir -p ~/.mysql/logs
mkdir -p ~/.mysql/run

# Инициализируем MySQL, если еще не инициализирован
if [ ! -d ~/.mysql/data/mysql ]; then
    echo "🗄️ Инициализация MySQL..."
    mysqld --initialize-insecure --user=$(whoami) --datadir=~/.mysql/data
fi

# Создаем конфигурационный файл
cat > ~/.mysql/my.cnf << EOF
[mysqld]
datadir=~/.mysql/data
socket=~/.mysql/run/mysql.sock
pid-file=~/.mysql/run/mysql.pid
log-error=~/.mysql/logs/error.log
port=3306
bind-address=127.0.0.1
skip-networking=false
EOF

# Запускаем MySQL сервер
echo "🚀 Запуск MySQL сервера..."
mysqld --defaults-file=~/.mysql/my.cnf --user=$(whoami) &
MYSQL_PID=$!

# Ждем запуска MySQL
sleep 10

# Создаем базу данных и пользователя
echo "🗄️ Создание базы данных и пользователя..."
mysql --socket=~/.mysql/run/mysql.sock -e "CREATE DATABASE IF NOT EXISTS webapp CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql --socket=~/.mysql/run/mysql.sock -e "CREATE USER IF NOT EXISTS 'webapp'@'localhost' IDENTIFIED BY 'secret';"
mysql --socket=~/.mysql/run/mysql.sock -e "GRANT ALL PRIVILEGES ON webapp.* TO 'webapp'@'localhost';"
mysql --socket=~/.mysql/run/mysql.sock -e "FLUSH PRIVILEGES;"

echo "✅ MySQL настроен и запущен! PID: $MYSQL_PID"
echo "Сокет: ~/.mysql/run/mysql.sock"

# Сохраняем PID для остановки позже
echo $MYSQL_PID > ~/.mysql/run/mysql.pid
