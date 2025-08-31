
<?php
require_once __DIR__ . '/../vendor/autoload.php';

use Dotenv\Dotenv;

// Загружаем переменные окружения
$dotenv = Dotenv::createImmutable(__DIR__ . '/..');
$dotenv->safeLoad();

echo "🗄️ Запуск миграций базы данных...\n";

try {
    $pdo = require __DIR__ . '/../config/db.php';
    
    // Определяем тип базы данных
    $driver = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME);
    echo "📋 Используется: $driver\n";
    
    // Создаем таблицу миграций
    if ($driver === 'sqlite') {
        $pdo->exec("CREATE TABLE IF NOT EXISTS migrations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            migration VARCHAR(255) NOT NULL UNIQUE,
            executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )");
    } else {
        $pdo->exec("CREATE TABLE IF NOT EXISTS migrations (
            id INT AUTO_INCREMENT PRIMARY KEY,
            migration VARCHAR(255) NOT NULL UNIQUE,
            executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB");
    }
    
    $migrationsDir = __DIR__ . '/../migrations';
    $files = glob($migrationsDir . '/*.sql');
    sort($files);
    
    foreach ($files as $file) {
        $migrationName = basename($file, '.sql');
        
        // Проверяем, выполнена ли миграция
        $stmt = $pdo->prepare("SELECT COUNT(*) FROM migrations WHERE migration = ?");
        $stmt->execute([$migrationName]);
        
        if ($stmt->fetchColumn() > 0) {
            echo "⏭️ Пропуск $migrationName (уже выполнена)\n";
            continue;
        }
        
        echo "▶️ Выполнение миграции: $migrationName\n";
        
        $sql = file_get_contents($file);
        
        // Адаптируем SQL для SQLite
        if ($driver === 'sqlite') {
            // Основные замены для совместимости
            $sql = str_replace('ENGINE=InnoDB', '', $sql);
            $sql = str_replace('DEFAULT CHARSET=utf8mb4', '', $sql);
            $sql = str_replace('COLLATE=utf8mb4_unicode_ci', '', $sql);
            $sql = str_replace('CHARSET=utf8mb4', '', $sql);
            
            // Замены для типов данных
            $sql = str_replace('INT AUTO_INCREMENT PRIMARY KEY', 'INTEGER PRIMARY KEY AUTOINCREMENT', $sql);
            $sql = str_replace('TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP', 'DATETIME DEFAULT CURRENT_TIMESTAMP', $sql);
            $sql = str_replace('TIMESTAMP DEFAULT CURRENT_TIMESTAMP', 'DATETIME DEFAULT CURRENT_TIMESTAMP', $sql);
            $sql = str_replace('TIMESTAMP NOT NULL', 'DATETIME NOT NULL', $sql);
            $sql = str_replace('BOOLEAN DEFAULT FALSE', 'INTEGER DEFAULT 0', $sql);
            $sql = str_replace('BOOLEAN DEFAULT TRUE', 'INTEGER DEFAULT 1', $sql);
            
            // Замены для INSERT
            $sql = str_replace('INSERT IGNORE INTO', 'INSERT OR IGNORE INTO', $sql);
            
            // Удаляем индексы из CREATE TABLE и создаем их отдельно
            $statements = [];
            $indexes = [];
            $lines = explode("\n", $sql);
            $currentStatement = '';
            $inCreateTable = false;
            $tableName = '';
            
            foreach ($lines as $line) {
                $trimmedLine = trim($line);
                
                // Начало CREATE TABLE
                if (preg_match('/CREATE TABLE IF NOT EXISTS (\w+)/i', $trimmedLine, $matches)) {
                    if ($currentStatement) {
                        $statements[] = trim($currentStatement);
                    }
                    $currentStatement = $line . "\n";
                    $inCreateTable = true;
                    $tableName = $matches[1];
                    continue;
                }
                
                // Внутри CREATE TABLE - обрабатываем индексы
                if ($inCreateTable) {
                    if (preg_match('/INDEX\s+(\w+)\s*\(([^)]+)\)/', $trimmedLine, $matches)) {
                        // Создаем отдельный индекс для выполнения ПОСЛЕ CREATE TABLE
                        $indexName = $matches[1];
                        $columns = $matches[2];
                        $indexes[] = "CREATE INDEX IF NOT EXISTS $indexName ON $tableName($columns);";
                        continue;
                    } elseif (strpos($trimmedLine, ') ENGINE=') !== false) {
                        // Конец CREATE TABLE с ENGINE (MySQL)
                        $currentStatement .= ");\n";
                        $statements[] = trim($currentStatement);
                        $currentStatement = '';
                        $inCreateTable = false;
                        continue;
                    } elseif ($trimmedLine === ');') {
                        // Конец CREATE TABLE без ENGINE
                        $currentStatement .= $line . "\n";
                        $statements[] = trim($currentStatement);
                        $currentStatement = '';
                        $inCreateTable = false;
                        continue;
                    }
                }
                
                $currentStatement .= $line . "\n";
            }
            
            // Добавляем последний statement если есть
            if ($currentStatement) {
                $statements[] = trim($currentStatement);
            }
            
            // Чистим SQL от лишних запятых перед закрывающей скобкой
            for ($i = 0; $i < count($statements); $i++) {
                $statements[$i] = preg_replace('/,\s*\n\s*\)/', "\n)", $statements[$i]);
            }
            
            // Добавляем индексы в конец
            $statements = array_merge($statements, $indexes);
            
            // Выполняем каждый statement отдельно
            foreach ($statements as $statement) {
                $statement = trim($statement);
                if (!empty($statement) && !preg_match('/^\s*--/', $statement)) {
                    try {
                        $pdo->exec($statement);
                        echo "  ✓ Выполнен: " . substr($statement, 0, 50) . "...\n";
                    } catch (\PDOException $e) {
                        echo "⚠️ Ошибка выполнения statement: " . $e->getMessage() . "\n";
                        echo "Statement: $statement\n";
                        throw $e;
                    }
                }
            }
        } else {
            // Для MySQL выполняем как есть
            $pdo->exec($sql);
        }
        
        // Записываем миграцию как выполненную
        $stmt = $pdo->prepare("INSERT INTO migrations (migration) VALUES (?)");
        $stmt->execute([$migrationName]);
        
        echo "✅ Миграция $migrationName выполнена успешно\n";
    }
    
    echo "🎉 Все миграции выполнены успешно!\n";
    
} catch (Exception $e) {
    echo "❌ Ошибка миграции: " . $e->getMessage() . "\n";
    echo "Трассировка:\n";
    echo $e->getTraceAsString() . "\n";
    exit(1);
}
