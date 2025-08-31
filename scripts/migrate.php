
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
            $sql = str_replace('AUTO_INCREMENT', '', $sql);
            $sql = str_replace('ENGINE=InnoDB', '', $sql);
            $sql = str_replace('CHARSET=utf8mb4', '', $sql);
            $sql = str_replace('COLLATE=utf8mb4_unicode_ci', '', $sql);
            $sql = str_replace('TIMESTAMP DEFAULT CURRENT_TIMESTAMP', 'DATETIME DEFAULT CURRENT_TIMESTAMP', $sql);
            $sql = str_replace('INT AUTO_INCREMENT PRIMARY KEY', 'INTEGER PRIMARY KEY AUTOINCREMENT', $sql);
        }
        
        $pdo->exec($sql);
        
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
