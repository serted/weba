
<?php
require_once __DIR__ . '/../vendor/autoload.php';

use Dotenv\Dotenv;

// Загружаем переменные окружения
$dotenv = Dotenv::createImmutable(__DIR__ . '/..');
$dotenv->load();

$host = $_ENV['DB_HOST'] ?? '127.0.0.1';
$port = $_ENV['DB_PORT'] ?? 3306;
$dbname = $_ENV['DB_NAME'] ?? 'webapp';
$username = $_ENV['DB_USER'] ?? 'webapp';
$password = $_ENV['DB_PASS'] ?? 'secret';

try {
    $pdo = new PDO("mysql:host=$host;port=$port;dbname=$dbname", $username, $password);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    echo "Подключение к базе данных успешно!\n";
    
    // Выполняем миграции в порядке
    $migrations = [
        '001_create_users.sql',
        '002_create_sessions.sql', 
        '003_create_logs.sql',
        '004_add_superadmin.sql'
    ];
    
    foreach ($migrations as $migration) {
        $migrationPath = __DIR__ . '/../migrations/' . $migration;
        
        if (file_exists($migrationPath)) {
            echo "Выполняется миграция: $migration\n";
            $sql = file_get_contents($migrationPath);
            $pdo->exec($sql);
            echo "Миграция $migration выполнена успешно!\n";
        } else {
            echo "Файл миграции $migration не найден!\n";
        }
    }
    
    echo "Все миграции выполнены успешно!\n";
    
} catch (PDOException $e) {
    echo "Ошибка подключения к базе данных: " . $e->getMessage() . "\n";
    exit(1);
}
