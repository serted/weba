<?php

require_once __DIR__ . '/../vendor/autoload.php';

use Dotenv\Dotenv;

$dotenv = Dotenv::createImmutable(__DIR__ . '/..');
$dotenv->safeLoad();

// Проверяем, есть ли SQLite путь
if (!empty($_ENV['DB_SQLITE_PATH'])) {
    echo "Подключение через SQLite: {$_ENV['DB_SQLITE_PATH']}\n";

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
$dsn = sprintf(
    "mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4",
    $_ENV['DB_HOST'] ?? '127.0.0.1',
    $_ENV['DB_PORT'] ?? '3306',
    $_ENV['DB_NAME'] ?? 'webapp'
);

try {
    $pdo = new PDO($dsn, $_ENV['DB_USER'] ?? 'webapp', $_ENV['DB_PASS'] ?? '', [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false
    ]);

    return $pdo;
} catch (\PDOException $e) {
    echo "Подключение к: mysql://{$_ENV['DB_USER']}@{$_ENV['DB_HOST']}:{$_ENV['DB_PORT']}/{$_ENV['DB_NAME']}\n";
    throw $e;
}