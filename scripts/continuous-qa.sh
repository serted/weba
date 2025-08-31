
#!/bin/bash

echo "🔄 НЕПРЕРЫВНЫЙ QA МОНИТОРИНГ..."

while true; do
    echo "🔍 Проверка состояния системы..."
    
    # Проверяем MySQL
    if ! pgrep mysqld > /dev/null; then
        echo "⚠️ MySQL не запущен, перезапуск..."
        bash scripts/mysql-nix-setup.sh
    fi
    
    # Проверяем health endpoint
    HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5000/health.php 2>/dev/null || echo "000")
    
    if [ "$HEALTH" != "200" ]; then
        echo "⚠️ Health endpoint недоступен ($HEALTH), перезапуск сервера..."
        pkill -f "php -S"
        php -S 0.0.0.0:5000 -t public &
        sleep 5
    else
        echo "✅ Система работает нормально"
    fi
    
    # Проверяем логи на ошибки
    if [ -f ~/.mysql/logs/error.log ]; then
        ERROR_COUNT=$(grep -c "ERROR" ~/.mysql/logs/error.log 2>/dev/null || echo "0")
        if [ "$ERROR_COUNT" -gt 0 ]; then
            echo "⚠️ Найдено $ERROR_COUNT ошибок MySQL в логах"
            tail -5 ~/.mysql/logs/error.log
        fi
    fi
    
    sleep 30
done
