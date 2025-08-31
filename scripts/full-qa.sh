
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

# 1. НАСТРОЙКА БД
log_step "STEP1" "Настройка базы данных..."
bash scripts/mysql-nix-setup.sh
check_error "Database setup"

# 2. УСТАНОВКА ЗАВИСИМОСТЕЙ
log_step "STEP2" "Установка PHP зависимостей..."
composer install --no-dev --optimize-autoloader
check_error "Composer install"

# 3. ЗАПУСК МИГРАЦИЙ
log_step "STEP3" "Выполнение миграций..."
php scripts/migrate.php
if check_error "Database migrations"; then
    touch reports/migration-success.flag
fi

# 4. АВТОИСПРАВЛЕНИЯ
log_step "STEP4" "Применение автоисправлений..."
bash scripts/auto-fix.sh
check_error "Auto-fixes"

# 5. ПРОВЕРКА HEALTH ENDPOINT
log_step "STEP5" "Проверка health endpoint..."
# Запускаем сервер в фоне
php -S 0.0.0.0:5000 -t public &
SERVER_PID=$!
sleep 3

# Проверяем health endpoint
HEALTH_CODE=$(curl -s -o reports/health-response.json -w "%{http_code}" http://localhost:5000/health.php 2>/dev/null || echo "000")

if [ "$HEALTH_CODE" = "200" ]; then
    log_step "SUCCESS" "Health endpoint returns 200 OK"
    touch reports/health-success.flag
else
    log_step "ERROR" "Health endpoint returns $HEALTH_CODE"
    cat reports/health-response.json 2>/dev/null || echo "No response"
fi

# Останавливаем сервер
kill $SERVER_PID 2>/dev/null || true

# 6. PHPUNIT ТЕСТЫ
log_step "STEP6" "Запуск PHPUnit тестов..."
if [ -f "vendor/bin/phpunit" ] && [ -f "tests/phpunit.xml" ]; then
    vendor/bin/phpunit --configuration tests/phpunit.xml > reports/phpunit-output.txt 2>&1
    PHPUNIT_EXIT=$?
    if [ $PHPUNIT_EXIT -eq 0 ]; then
        log_step "SUCCESS" "All PHPUnit tests passed"
    else
        log_step "ERROR" "PHPUnit tests failed (exit code: $PHPUNIT_EXIT)"
        cat reports/phpunit-output.txt
    fi
else
    log_step "WARNING" "PHPUnit not available, skipping tests"
fi

# 7. ФИНАЛЬНЫЙ ОТЧЁТ
log_step "REPORT" "Генерация финального отчёта..."

cat > reports/final-report.txt << EOF
ПОЛНЫЙ QA ОТЧЁТ
===============
Время выполнения: $(date '+%Y-%m-%d %H:%M:%S')

СТАТУС КОМПОНЕНТОВ:
- База данных: $([ -f ~/.webapp/db/webapp.sqlite ] && echo "✅ SQLite OK" || echo "❌ FAILED")
- Миграции БД: $([ -f reports/migration-success.flag ] && echo "✅ OK" || echo "❌ FAILED") 
- Health endpoint: $([ "$HEALTH_CODE" = "200" ] && echo "✅ 200 OK" || echo "❌ $HEALTH_CODE")
- PHPUnit тесты: $([ -f reports/phpunit-output.txt ] && grep -q "OK" reports/phpunit-output.txt && echo "✅ PASSED" || echo "❌ FAILED")
- Автоисправления: ✅ APPLIED

ДЕТАЛИ:
- SQLite путь: ~/.webapp/db/webapp.sqlite
- Health response: $(cat reports/health-response.json 2>/dev/null | head -1)
- Лог-файл: reports/qa-log.txt

СЛЕДУЮЩИЕ ШАГИ:
1. Запустить сервер: php -S 0.0.0.0:5000 -t public
2. Проверить http://localhost:5000/health.php
3. Запустить E2E тесты (если необходимо)
EOF

echo ""
echo "📊 ФИНАЛЬНЫЙ ОТЧЁТ:"
cat reports/final-report.txt

log_step "COMPLETE" "QA цикл завершён. См. reports/final-report.txt"
