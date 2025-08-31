
<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET');
header('Access-Control-Allow-Headers: Content-Type');

require_once __DIR__ . '/../vendor/autoload.php';

try {
    // Загружаем переменные окружения
    $dotenv = Dotenv\Dotenv::createImmutable(__DIR__ . '/../');
    $dotenv->load();

    // Подключение к базе данных
    $socket = $_ENV['DB_SOCKET'] ?? null;
    
    if ($socket && file_exists($socket)) {
        $dsn = "mysql:unix_socket={$socket};dbname={$_ENV['DB_NAME']};charset=utf8mb4";
    } else {
        $dsn = "mysql:host={$_ENV['DB_HOST']};port={$_ENV['DB_PORT']};dbname={$_ENV['DB_NAME']};charset=utf8mb4";
    }
    
    $pdo = new PDO(
        $dsn,
        $_ENV['DB_USER'],
        $_ENV['DB_PASS'],
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]
    );

    // Проверяем подключение к БД
    $stmt = $pdo->query('SELECT 1');
    $dbStatus = $stmt ? 'connected' : 'failed';

    echo json_encode([
        'status' => 'ok',
        'timestamp' => date('Y-m-d H:i:s'),
        'database' => $dbStatus,
        'php_version' => PHP_VERSION,
        'memory_usage' => memory_get_usage(true),
        'server' => $_SERVER['SERVER_SOFTWARE'] ?? 'Unknown'
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'status' => 'error',
        'message' => $e->getMessage(),
        'timestamp' => date('Y-m-d H:i:s')
    ]);
}
?>
