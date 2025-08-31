
#!/bin/bash

echo "🚀 Запуск тестов WebApp..."

# Устанавливаем зависимости
echo "📦 Установка зависимостей..."
composer install --no-dev

# Проверяем переменные окружения
if [ ! -f .env ]; then
    echo "⚠️  Файл .env не найден, копируем из .env.example"
    cp .env.example .env
fi

# Запускаем миграции
echo "🗄️  Выполняем миграции..."
php scripts/migrate.php

# Запускаем PHP Unit тесты
echo "🧪 Запуск PHPUnit тестов..."
vendor/bin/phpunit --configuration tests/phpunit.xml

if [ $? -eq 0 ]; then
    echo "✅ PHPUnit тесты прошли успешно!"
else
    echo "❌ PHPUnit тесты провалились!"
    exit 1
fi

# Запускаем сервер в фоне для E2E тестов
echo "🌐 Запуск PHP сервера для E2E тестов..."
php -S 0.0.0.0:5000 -t public &
SERVER_PID=$!

# Ждем запуска сервера
sleep 3

# Проверяем что сервер запустился
curl -f http://localhost:5000/api/health || {
    echo "❌ Сервер не запустился!"
    kill $SERVER_PID
    exit 1
}

# Запускаем Cypress тесты (если установлен)
if command -v npx &> /dev/null; then
    echo "🔍 Запуск Cypress E2E тестов..."
    npx cypress run
    
    if [ $? -eq 0 ]; then
        echo "✅ Cypress тесты прошли успешно!"
    else
        echo "❌ Cypress тесты провалились!"
        kill $SERVER_PID
        exit 1
    fi
else
    echo "⚠️  Cypress не установлен, пропускаем E2E тесты"
fi

# Останавливаем сервер
kill $SERVER_PID

echo "🎉 Все тесты завершены успешно!"
