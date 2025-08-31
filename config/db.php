<?php

require_once __DIR__ . '/../vendor/autoload.php';

use Dotenv\Dotenv;

$dotenv = Dotenv::createImmutable(__DIR__ . '/..');
$dotenv->safeLoad();

// Проверяем, есть ли SQLite путь
if (!empty($_ENV['DB_SQLITE_PATH'])) {
    $dsn = "sqlite:" . $_ENV['DB_SQLITE_PATH'];

    try {
        $pdo = new PDO($dsn, null, null, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false
        ]);

        // Включаем поддержку внешних ключей в SQLite
        $pdo->exec('PRAGMA foreign_keys = ON');

        return $pdo;
    } catch (\PDOException $e) {
        throw new \PDOException("SQLite connection failed: " . $e->getMessage());
    }
}

// Fallback на MySQL
$host = $_ENV['DB_HOST'] ?? '127.0.0.1';
$port = $_ENV['DB_PORT'] ?? '3306';
$dbname = $_ENV['DB_NAME'] ?? 'webapp';
$username = $_ENV['DB_USER'] ?? 'webapp';
$password = $_ENV['DB_PASS'] ?? 'secret';

// Сначала пытаемся подключиться к базе данных
$dsn = sprintf("mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4", $host, $port, $dbname);

try {
    $pdo = new PDO($dsn, $username, $password, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false
    ]);

    return $pdo;
} catch (\PDOException $e) {
    // Если база данных не существует, пытаемся её создать
    try {
        $rootDsn = sprintf("mysql:host=%s;port=%s;charset=utf8mb4", $host, $port);
        $rootPdo = new PDO($rootDsn, 'root', '', [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION
        ]);
        
        // Создаем базу данных если её нет
        $rootPdo->exec("CREATE DATABASE IF NOT EXISTS `{$dbname}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
        
        // Создаем пользователя если его нет и даём права
        $rootPdo->exec("CREATE USER IF NOT EXISTS '{$username}'@'%' IDENTIFIED BY '{$password}'");
        $rootPdo->exec("GRANT ALL PRIVILEGES ON `{$dbname}`.* TO '{$username}'@'%'");
        $rootPdo->exec("FLUSH PRIVILEGES");
        
        if (php_sapi_name() === 'cli') {
            echo "✅ База данных '{$dbname}' и пользователь '{$username}' созданы успешно\n";
        }
        
        // Теперь подключаемся к созданной базе данных
        $pdo = new PDO($dsn, $username, $password, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false
        ]);

        return $pdo;
        
    } catch (\PDOException $createError) {
        if (php_sapi_name() === 'cli') {
            echo "❌ Не удалось создать базу данных/пользователя: " . $createError->getMessage() . "\n";
            echo "Подключение к: mysql://{$username}@{$host}:{$port}/{$dbname}\n";
            echo "Исходная ошибка: " . $e->getMessage() . "\n";
        }
        throw $e;
    }
}