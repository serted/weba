
<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

try {
    // Проверяем подключение к базе данных
    require_once __DIR__ . '/../vendor/autoload.php';
    
    use Dotenv\Dotenv;
    
    $dotenv = Dotenv::createImmutable(__DIR__ . '/..');
    $dotenv->safeLoad();
    
    $dsn = sprintf(
        "mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4",
        $_ENV['DB_HOST'] ?? '127.0.0.1',
        $_ENV['DB_PORT'] ?? '3306',
        $_ENV['DB_NAME'] ?? 'webapp'
    );
    
    $pdo = new PDO($dsn, $_ENV['DB_USER'] ?? 'webapp', $_ENV['DB_PASS'] ?? '', [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false
    ]);
    
    // Простой запрос для проверки БД
    $stmt = $pdo->query("SELECT 1 as test");
    $result = $stmt->fetch();
    
    $response = [
        'status' => 'ok',
        'timestamp' => time(),
        'version' => '1.0.0',
        'database' => 'connected',
        'environment' => $_ENV['APP_ENV'] ?? 'production',
        'php_version' => PHP_VERSION,
        'memory_usage' => memory_get_usage(true),
        'uptime' => time() - $_SERVER['REQUEST_TIME']
    ];
    
    http_response_code(200);
    echo json_encode($response, JSON_PRETTY_PRINT);
    
} catch (Exception $e) {
    $response = [
        'status' => 'error',
        'timestamp' => time(),
        'error' => $e->getMessage(),
        'php_version' => PHP_VERSION
    ];
    
    http_response_code(500);
    echo json_encode($response, JSON_PRETTY_PRINT);
}
?>
