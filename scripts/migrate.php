
<?php
require_once __DIR__ . '/../vendor/autoload.php';

use Dotenv\Dotenv;

// Загружаем переменные окружения
$dotenv = Dotenv::createImmutable(__DIR__ . '/..');
$dotenv->safeLoad();

$host = $_ENV['DB_HOST'] ?? '127.0.0.1';
$port = $_ENV['DB_PORT'] ?? 3306;
$dbname = $_ENV['DB_NAME'] ?? 'webapp';
$username = $_ENV['DB_USER'] ?? 'webapp';
$password = $_ENV['DB_PASS'] ?? '';

echo "🗄️  Запуск миграций базы данных...\n";
echo "Подключение к: mysql://$username@$host:$port/$dbname\n";

try {
    // Сначала пытаемся подключиться без указания базы данных
    $pdo = new PDO("mysql:host=$host;port=$port", $username, $password);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    // Создаем базу данных если она не существует
    $pdo->exec("CREATE DATABASE IF NOT EXISTS `$dbname` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
    echo "✅ База данных '$dbname' готова\n";
    
    // Переподключаемся к конкретной базе
    $pdo = new PDO("mysql:host=$host;port=$port;dbname=$dbname", $username, $password);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    echo "✅ Подключение к базе данных успешно!\n";
    
    // Создаем таблицу для отслеживания миграций
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS migrations (
            id INT AUTO_INCREMENT PRIMARY KEY,
            filename VARCHAR(255) NOT NULL UNIQUE,
            executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ");
    
    // Выполняем миграции в порядке
    $migrations = [
        '001_create_users.sql',
        '002_create_sessions.sql', 
        '003_create_logs.sql',
        '004_add_superadmin.sql'
    ];
    
    foreach ($migrations as $migration) {
        $migrationPath = __DIR__ . '/../migrations/' . $migration;
        
        // Проверяем, была ли уже выполнена эта миграция
        $stmt = $pdo->prepare("SELECT COUNT(*) FROM migrations WHERE filename = ?");
        $stmt->execute([$migration]);
        
        if ($stmt->fetchColumn() > 0) {
            echo "⏭️  Миграция $migration уже выполнена\n";
            continue;
        }
        
        if (file_exists($migrationPath)) {
            echo "🔄 Выполняется миграция: $migration\n";
            
            $sql = file_get_contents($migrationPath);
            
            // Разделяем SQL на отдельные запросы
            $statements = array_filter(
                array_map('trim', explode(';', $sql)),
                function($stmt) { return !empty($stmt); }
            );
            
            $pdo->beginTransaction();
            
            try {
                foreach ($statements as $statement) {
                    if (!empty($statement)) {
                        $pdo->exec($statement);
                    }
                }
                
                // Записываем факт выполнения миграции
                $stmt = $pdo->prepare("INSERT INTO migrations (filename) VALUES (?)");
                $stmt->execute([$migration]);
                
                $pdo->commit();
                echo "✅ Миграция $migration выполнена успешно!\n";
                
            } catch (\Exception $e) {
                $pdo->rollBack();
                throw $e;
            }
            
        } else {
            echo "⚠️  Файл миграции $migration не найден!\n";
        }
    }
    
    echo "🎉 Все миграции выполнены успешно!\n";
    
} catch (\Exception $e) {
    echo "❌ Ошибка миграции: " . $e->getMessage() . "\n";
    echo "Трассировка:\n" . $e->getTraceAsString() . "\n";
    exit(1);
}
