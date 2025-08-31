<?php
declare(strict_types=1);

require __DIR__ . '/../vendor/autoload.php';

use Slim\Factory\AppFactory;
use Dotenv\Dotenv;
use DI\Container;

// Загружаем переменные окружения
$dotenv = Dotenv::createImmutable(dirname(__DIR__));
$dotenv->safeLoad();

// Создаем контейнер
$container = new Container();

// Настройка PDO
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
} catch (\PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database connection failed: ' . $e->getMessage()]);
    exit;
}

// JWT конфигурация
$jwtConf = [
    'secret' => $_ENV['JWT_SECRET'] ?? 'change-me-in-production',
    'issuer' => $_ENV['JWT_ISSUER'] ?? 'webapp',
    'ttl'    => (int)($_ENV['JWT_TTL'] ?? 604800),
];

// Добавляем в контейнер
$container->set('pdo', $pdo);
$container->set('jwtConf', $jwtConf);
$container->set('env', $_ENV);

// Создаем приложение с контейнером
AppFactory::setContainer($container);
$app = AppFactory::create();

// Middleware
$app->addBodyParsingMiddleware();
$app->addRoutingMiddleware();

// Запуск сессий
session_name('WEBAPPSESSID');
if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start([
        'cookie_httponly' => true,
        'cookie_secure'   => isset($_SERVER['HTTPS']),
        'cookie_samesite' => 'Lax',
    ]);
}

// Подключаем middleware
require_once __DIR__ . '/../src/helpers/Csrf.php';
require_once __DIR__ . '/../src/Middleware/CsrfMiddleware.php';
require_once __DIR__ . '/../src/Middleware/RateLimitMiddleware.php';
require_once __DIR__ . '/../src/Middleware/RoleMiddleware.php';
require_once __DIR__ . '/../src/Middleware/AuthMiddleware.php';

// Добавляем middleware к приложению
$app->add(new \App\Middleware\CsrfMiddleware());
$app->add(new \App\Middleware\RateLimitMiddleware());

// Error handling
$errorMiddleware = $app->addErrorMiddleware(
    ($_ENV['APP_DEBUG'] ?? 'false') === 'true',
    true,
    true
);

// Подключаем маршруты
require __DIR__ . '/../src/routes.php';

// Запускаем приложение
$app->run();