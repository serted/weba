
<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

try {
    require_once __DIR__ . '/../vendor/autoload.php';
    
    use Dotenv\Dotenv;
    
    // Загружаем переменные окружения
    $dotenv = Dotenv::createImmutable(__DIR__ . '/..');
    $dotenv->safeLoad();
    
    // Проверяем подключение к базе данных
    $pdo = require __DIR__ . '/../config/db.php';
    
    // Простой тест подключения
    $stmt = $pdo->query('SELECT 1 as test');
    $result = $stmt->fetch();
    
    if ($result && $result['test'] == 1) {
        http_response_code(200);
        echo json_encode([
            'status' => 'ok',
            'database' => 'connected',
            'timestamp' => date('Y-m-d H:i:s')
        ]);
    } else {
        throw new Exception('Database test query failed');
    }
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'status' => 'error',
        'message' => $e->getMessage(),
        'timestamp' => date('Y-m-d H:i:s')
    ]);
}
