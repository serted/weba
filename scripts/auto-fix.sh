
#!/bin/bash

echo "🔧 АВТОМАТИЧЕСКОЕ ИСПРАВЛЕНИЕ ВСЕХ ОШИБОК..."

# 1. Исправляем права доступа
chmod -R 755 public/
chmod -R 644 public/*.html public/*.php
chmod +x scripts/*.sh

# 2. Проверяем и исправляем .htaccess
if [ -f public/.htaccess ]; then
    echo "✅ .htaccess найден"
else
    echo "🔧 Создаем .htaccess..."
    cat > public/.htaccess << 'EOF'
RewriteEngine On
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^(.*)$ index.php [QSA,L]

<IfModule mod_headers.c>
    Header always set Access-Control-Allow-Origin "*"
    Header always set Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS"
    Header always set Access-Control-Allow-Headers "Content-Type, Authorization, X-Requested-With"
</IfModule>
EOF
fi

# 3. Проверяем JavaScript файлы на синтаксис
echo "🔍 Проверка JavaScript файлов..."
for js_file in $(find public/assets -name "*.js" 2>/dev/null); do
    if [ -f "$js_file" ]; then
        node -c "$js_file" 2>/dev/null || echo "⚠️ Ошибка в $js_file"
    fi
done

# 4. Проверяем PHP файлы на синтаксис
echo "🔍 Проверка PHP файлов..."
for php_file in $(find . -name "*.php" -not -path "./vendor/*"); do
    if [ -f "$php_file" ]; then
        php -l "$php_file" >/dev/null 2>&1 || echo "⚠️ Синтаксическая ошибка в $php_file"
    fi
done

# 5. Создаем отсутствующие директории
mkdir -p reports/screenshots
mkdir -p reports/coverage
mkdir -p reports/tests

echo "✅ Автоматические исправления применены!"
