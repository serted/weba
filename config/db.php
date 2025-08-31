
<?php
require_once __DIR__ . '/../vendor/autoload.php';

use Dotenv\Dotenv;

// Загружаем переменные окружения
$dotenv = Dotenv::createImmutable(__DIR__ . '/..');
$dotenv->safeLoad();

$socket = $_ENV['DB_SOCKET'] ?? null;
$host = $_ENV['DB_HOST'] ?? '127.0.0.1';
$port = $_ENV['DB_PORT'] ?? 3306;
$dbname = $_ENV['DB_NAME'] ?? 'webapp';
$username = $_ENV['DB_USER'] ?? 'webapp';
$password = $_ENV['DB_PASS'] ?? 'secret';

try {
    // Приоритет для сокета, если он существует
    if ($socket && file_exists($socket)) {
        $dsn = "mysql:unix_socket={$socket};dbname={$dbname};charset=utf8mb4";
        error_log("Подключение через сокет: {$socket}");
    } else {
        $dsn = "mysql:host={$host};port={$port};dbname={$dbname};charset=utf8mb4";
        error_log("Подключение через TCP: {$host}:{$port}");
    }

    $pdo = new PDO($dsn, $username, $password, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
        PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES utf8mb4"
    ]);
    
    return $pdo;
} catch (PDOException $e) {
    error_log("Ошибка подключения к БД: " . $e->getMessage());
    throw new Exception("Database connection failed: " . $e->getMessage());
}
