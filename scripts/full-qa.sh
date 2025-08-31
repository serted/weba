
#!/bin/bash

set -e

echo "🚀 Запуск полного QA процесса WebApp..."
echo "=============================================="

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Функция для логирования
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

error() {
    echo -e "${RED}[ERROR] $1${NC}"
}

success() {
    echo -e "${GREEN}[SUCCESS] $1${NC}"
}

warning() {
    echo -e "${YELLOW}[WARNING] $1${NC}"
}

# Создаем директории для отчетов
mkdir -p reports/screenshots
mkdir -p reports/tests
mkdir -p reports/coverage

# Счетчики ошибок
ERRORS_FOUND=0
FIXES_APPLIED=0

log "🔧 Этап 1: Проверка окружения и зависимостей"

# Проверяем наличие .env
if [ ! -f .env ]; then
    warning "Файл .env не найден, копируем из .env.example"
    cp .env.example .env
    ((FIXES_APPLIED++))
fi

# Устанавливаем PHP зависимости
log "📦 Установка PHP зависимостей..."
composer install --no-dev --optimize-autoloader

# Устанавливаем Node.js зависимости для тестов
log "📦 Установка Node.js зависимостей..."
npm install

log "🗄️ Этап 2: Настройка базы данных и миграции"

# Запускаем миграции
log "Выполняем миграции..."
php scripts/migrate.php || {
    error "Ошибка при выполнении миграций"
    ((ERRORS_FOUND++))
}

log "🌐 Этап 3: Запуск сервера и проверка health check"

# Запускаем PHP сервер в фоне
log "Запуск PHP сервера на порту 5000..."
php -S 0.0.0.0:5000 -t public > server.log 2>&1 &
SERVER_PID=$!

# Ждем запуска сервера
sleep 3

# Проверяем health endpoint
log "Проверка health endpoint..."
if curl -f http://localhost:5000/api/health > /dev/null 2>&1; then
    success "Health endpoint работает"
else
    error "Health endpoint недоступен"
    ((ERRORS_FOUND++))
fi

log "🧪 Этап 4: PHPUnit тесты"

# Запускаем PHPUnit тесты
log "Запуск PHPUnit тестов..."
if vendor/bin/phpunit --configuration tests/phpunit.xml --log-junit reports/tests/phpunit-results.xml; then
    success "PHPUnit тесты прошли успешно"
else
    error "PHPUnit тесты провалились"
    ((ERRORS_FOUND++))
fi

log "🔍 Этап 5: Cypress E2E тесты"

# Запускаем Cypress тесты
log "Запуск Cypress E2E тестов..."
if npx cypress run --reporter junit --reporter-options mochaFile=reports/tests/cypress-results.xml; then
    success "Cypress тесты прошли успешно"
else
    error "Cypress тесты провалились"
    ((ERRORS_FOUND++))
fi

log "📸 Этап 6: Визуальное тестирование"

# Создаем скриншоты для визуального сравнения
node scripts/visual-regression.js || {
    error "Ошибка при создании скриншотов"
    ((ERRORS_FOUND++))
}

log "🔧 Этап 7: Автоматические исправления"

# Проверяем и исправляем .htaccess
if [ -f public/.htaccess ]; then
    success ".htaccess файл найден"
else
    warning "Создаем .htaccess файл"
    cat > public/.htaccess << 'EOF'
RewriteEngine On
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^(.*)$ index.php [QSA,L]
EOF
    ((FIXES_APPLIED++))
fi

# Останавливаем сервер
kill $SERVER_PID 2>/dev/null || true

log "📊 Этап 8: Генерация отчета"

# Создаем итоговый отчет
cat > reports/qa-report.txt << EOF
=== QA Отчет WebApp ===
Дата: $(date)

Найдено ошибок: $ERRORS_FOUND
Применено исправлений: $FIXES_APPLIED

Статус компонентов:
- База данных: $([ $ERRORS_FOUND -eq 0 ] && echo "✓ OK" || echo "✗ Ошибки")
- Health endpoint: $([ $ERRORS_FOUND -eq 0 ] && echo "✓ OK" || echo "✗ Ошибки")
- PHPUnit тесты: $([ -f reports/tests/phpunit-results.xml ] && echo "✓ Выполнены" || echo "✗ Ошибки")
- Cypress E2E: $([ -f reports/tests/cypress-results.xml ] && echo "✓ Выполнены" || echo "✗ Ошибки")
- Визуальные тесты: $([ -d reports/screenshots ] && echo "✓ Выполнены" || echo "✗ Ошибки")

EOF

if [ $ERRORS_FOUND -eq 0 ]; then
    success "🎉 Все проверки прошли успешно!"
    echo "Отчет сохранен в reports/qa-report.txt"
    exit 0
else
    error "❌ Обнаружены ошибки. Проверьте логи."
    echo "Отчет сохранен в reports/qa-report.txt"
    exit 1
fi
