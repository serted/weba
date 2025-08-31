
#!/bin/bash

echo "🔧 Настройка MySQL в Nix окружении..."

# Останавливаем все процессы MySQL
pkill -f mysqld || true
sleep 2

# Создаем директории
mkdir -p ~/.mysql/data
mkdir -p ~/.mysql/logs  
mkdir -p ~/.mysql/run
mkdir -p ~/.mysql/tmp

# Устанавливаем права доступа
chmod 755 ~/.mysql
chmod 755 ~/.mysql/data
chmod 755 ~/.mysql/logs
chmod 755 ~/.mysql/run
chmod 755 ~/.mysql/tmp

# Создаем конфигурационный файл
cat > ~/.mysql/my.cnf << EOF
[mysqld]
datadir=$HOME/.mysql/data
socket=$HOME/.mysql/run/mysql.sock
pid-file=$HOME/.mysql/run/mysql.pid
log-error=$HOME/.mysql/logs/error.log
port=3306
bind-address=127.0.0.1
skip-networking=false
tmpdir=$HOME/.mysql/tmp
secure-file-priv=""
default-authentication-plugin=mysql_native_password

[client]
socket=$HOME/.mysql/run/mysql.sock
EOF

# Инициализируем MySQL, если еще не инициализирован
if [ ! -d ~/.mysql/data/mysql ]; then
    echo "🗄️ Инициализация MySQL..."
    mysqld --defaults-file=~/.mysql/my.cnf --initialize-insecure --user=$(whoami) --datadir=$HOME/.mysql/data
fi

# Запускаем MySQL сервер в фоне
echo "🚀 Запуск MySQL сервера..."
mysqld --defaults-file=~/.mysql/my.cnf --user=$(whoami) &
MYSQL_PID=$!

# Сохраняем PID
echo $MYSQL_PID > ~/.mysql/run/mysql.pid

# Ждем запуска MySQL (увеличиваем время ожидания)
echo "⏳ Ожидание запуска MySQL..."
for i in {1..30}; do
    if mysql --socket=$HOME/.mysql/run/mysql.sock -e "SELECT 1;" &>/dev/null; then
        echo "✅ MySQL запущен успешно!"
        break
    fi
    echo "Попытка $i/30..."
    sleep 2
done

# Проверяем, что MySQL запущен
if ! mysql --socket=$HOME/.mysql/run/mysql.sock -e "SELECT 1;" &>/dev/null; then
    echo "❌ Ошибка: MySQL не запустился"
    cat ~/.mysql/logs/error.log
    exit 1
fi

# Создаем базу данных и пользователя
echo "🗄️ Создание базы данных и пользователя..."
mysql --socket=$HOME/.mysql/run/mysql.sock << EOF
CREATE DATABASE IF NOT EXISTS webapp CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'webapp'@'localhost' IDENTIFIED BY 'secret';
GRANT ALL PRIVILEGES ON webapp.* TO 'webapp'@'localhost';
FLUSH PRIVILEGES;
EOF

echo "✅ MySQL настроен и запущен! PID: $MYSQL_PID"
echo "✅ Сокет: $HOME/.mysql/run/mysql.sock"
echo "✅ База данных 'webapp' создана"
echo "✅ Пользователь 'webapp' создан с паролем 'secret'"
