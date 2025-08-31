#!/bin/bash

echo "🚀 ПОЛНЫЙ DEVOPS-QA ЦИКЛ ЗАПУЩЕН..."
echo "=================================="

# Функция для логирования
log_step() {
    echo "📋 [$1] $2"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [$1] $2" >> reports/qa-log.txt
}

# Функция для проверки ошибок
check_error() {
    if [ $? -ne 0 ]; then
        log_step "ERROR" "$1 failed with exit code $?"
        return 1
    else
        log_step "SUCCESS" "$1 completed successfully"
        return 0
    fi
}

# Создаем директории отчетов
mkdir -p reports/{screenshots,coverage,tests}

# 1. НАСТРОЙКА MYSQL
log_step "STEP1" "Настройка MySQL..."
bash scripts/mysql-nix-setup.sh
check_error "MySQL setup"

# 2. УСТАНОВКА ЗАВИСИМОСТЕЙ
log_step "STEP2" "Установка PHP зависимостей..."
composer install --no-dev --optimize-autoloader
check_error "Composer install"

# 3. ЗАПУСК МИГРАЦИЙ
log_step "STEP3" "Выполнение миграций..."
php scripts/migrate.php
check_error "Database migrations"

# 4. АВТОИСПРАВЛЕНИЯ
log_step "STEP4" "Применение автоисправлений..."
bash scripts/auto-fix.sh
check_error "Auto-fixes"

# 5. ПРОВЕРКА HEALTH ENDPOINT
log_step "STEP5" "Проверка health endpoint..."
php -S 0.0.0.0:5000 -t public &
SERVER_PID=$!
sleep 3

HEALTH_RESPONSE=$(curl -s -w "%{http_code}" http://localhost:5000/health.php)
HEALTH_CODE="${HEALTH_RESPONSE: -3}"

if [ "$HEALTH_CODE" = "200" ]; then
    log_step "SUCCESS" "Health endpoint returns 200 OK"
    echo "$HEALTH_RESPONSE" | head -c -3 > reports/health-response.json
else
    log_step "ERROR" "Health endpoint returns $HEALTH_CODE"
    echo "$HEALTH_RESPONSE" > reports/health-error.txt
fi

# 6. UNIT ТЕСТЫ
log_step "STEP6" "Запуск PHPUnit тестов..."
if [ -f vendor/bin/phpunit ]; then
    vendor/bin/phpunit --configuration tests/phpunit.xml --coverage-html reports/coverage
    check_error "PHPUnit tests"
else
    log_step "WARNING" "PHPUnit не найден, установка..."
    composer require --dev phpunit/phpunit
    vendor/bin/phpunit --configuration tests/phpunit.xml --coverage-html reports/coverage
    check_error "PHPUnit tests (after install)"
fi

# 7. E2E ТЕСТЫ CYPRESS
log_step "STEP7" "Запуск Cypress E2E тестов..."
if command -v npx >/dev/null 2>&1; then
    npx cypress run --headless --browser chrome
    check_error "Cypress E2E tests"
else
    log_step "WARNING" "Node.js/npm не найден для Cypress тестов"
fi

# 8. ВИЗУАЛЬНАЯ РЕГРЕССИЯ
log_step "STEP8" "Проверка визуальной регрессии..."
node scripts/visual-regression.js
check_error "Visual regression tests"

# 9. СВОДНЫЙ ОТЧЕТ
log_step "REPORT" "Генерация финального отчета..."

cat > reports/final-report.txt << EOF
=== DEVOPS-QA ОТЧЕТ ===
Время выполнения: $(date '+%Y-%m-%d %H:%M:%S')

СТАТУС КОМПОНЕНТОВ:
- MySQL подключение: $([ "$HEALTH_CODE" = "200" ] && echo "✅ OK" || echo "❌ FAILED")
- Миграции БД: $([ -f reports/migration-success.flag ] && echo "✅ OK" || echo "❌ FAILED") 
- Health endpoint: $([ "$HEALTH_CODE" = "200" ] && echo "✅ 200 OK" || echo "❌ $HEALTH_CODE")
- PHPUnit тесты: $([ -f reports/phpunit-success.flag ] && echo "✅ PASSED" || echo "❌ FAILED")
- Cypress E2E: $([ -f reports/cypress-success.flag ] && echo "✅ PASSED" || echo "❌ FAILED")
- Visual regression: $([ -f reports/visual-success.flag ] && echo "✅ ≥98% match" || echo "❌ FAILED")

ДЕТАЛИ:
$(cat reports/qa-log.txt | tail -20)
EOF

echo "📊 Финальный отчет сохранен в reports/final-report.txt"
cat reports/final-report.txt

# Останавливаем сервер
kill $SERVER_PID 2>/dev/null

log_step "COMPLETE" "QA цикл завершен!"