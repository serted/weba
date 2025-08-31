
#!/bin/bash

echo "🔧 АВТОМАТИЧЕСКОЕ ИСПРАВЛЕНИЕ ВСЕХ ОШИБОК..."

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
EOF
fi

# Проверяем JavaScript файлы
echo "🔍 Проверка JavaScript файлов..."
find public/assets -name "*.js" -type f 2>/dev/null | while read file; do
    if ! node -c "$file" 2>/dev/null; then
        echo "⚠️ Синтаксическая ошибка в $file"
    fi
done

# Проверяем PHP файлы и исправляем синтаксические ошибки
echo "🔍 Проверка PHP файлов..."
find . -name "*.php" -not -path "./vendor/*" -type f | while read file; do
    if ! php -l "$file" >/dev/null 2>&1; then
        echo "⚠️ Синтаксическая ошибка в $file"
        
        # Исправляем BOM символы
        if file "$file" | grep -q "UTF-8 Unicode (with BOM)"; then
            echo "🔧 Удаление BOM из $file"
            sed -i '1s/^\xEF\xBB\xBF//' "$file"
        fi
        
        # Исправляем пробелы в начале файла
        sed -i 's/^[[:space:]]*<?php/<?php/' "$file"
        
        # Исправляем unexpected use
        if grep -q "^use " "$file" && ! grep -q "<?php" "$file"; then
            echo "🔧 Добавление <?php тега в $file"
            sed -i '1i<?php' "$file"
        fi
    fi
done

echo "✅ Автоматические исправления применены!"
