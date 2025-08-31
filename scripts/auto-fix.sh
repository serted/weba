#!/bin/bash

echo "🔧 АВТОМАТИЧЕСКОЕ ИСПРАВЛЕНИЕ ВСЕХ ОШИБОК..."

# Создаем необходимые директории
mkdir -p reports/{screenshots,coverage,tests}
mkdir -p ~/.webapp/{db,logs}

# Проверяем .htaccess
if [ -f "public/.htaccess" ]; then
    echo "✅ .htaccess найден"
else
    echo "⚠️ .htaccess отсутствует, создаю..."
    cat > public/.htaccess << 'EOF'
RewriteEngine On
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^(.*)$ index.php [QSA,L]

# CORS headers
Header always set Access-Control-Allow-Origin "*"
Header always set Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS"
Header always set Access-Control-Allow-Headers "Content-Type, Authorization, X-Requested-With"
EOF
    echo "✅ .htaccess создан"
fi

# Проверяем JavaScript файлов
echo "🔍 Проверка JavaScript файлов..."
if [ -d "public/assets" ]; then
    find public/assets -name "*.js" -type f 2>/dev/null | while read file; do
        if command -v node >/dev/null 2>&1; then
            if ! node -c "$file" 2>/dev/null; then
                echo "⚠️ Синтаксическая ошибка в $file"
            fi
        fi
    done
fi

# Проверяем PHP файлы и исправляем синтаксические ошибки
echo "🔍 Проверка PHP файлов..."
find . -name "*.php" -not -path "./vendor/*" -type f | while read file; do
    if ! php -l "$file" > /dev/null 2>&1; then
            echo "⚠️ Синтаксическая ошибка в $file"
            head -n 3 "$file" | grep -E "^<\?php|namespace|class"

        # Исправляем BOM символы
        if file "$file" | grep -q "UTF-8 Unicode (with BOM)"; then
            echo "🔧 Удаление BOM из $file"
            sed -i '1s/^\xEF\xBB\xBF//' "$file"
        fi

        # Исправляем пробелы в начале файла
        sed -i 's/^[[:space:]]*<?php/<?php/' "$file"

        # Проверяем снова после исправления
        if php -l "$file" >/dev/null 2>&1; then
            echo "✅ Исправлен $file"
        fi
    fi
done

# Проверяем права доступа
chmod +x scripts/*.sh 2>/dev/null || true
chmod 644 public/*.php 2>/dev/null || true
chmod 644 *.php 2>/dev/null || true

echo "✅ Автоисправления завершены"