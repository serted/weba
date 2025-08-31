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

// Подключение к базе данных
try {
    $pdo = require __DIR__ . '/../config/db.php';
} catch (\PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database connection failed: ' . $e->getMessage()]);
    exit;
}

// JWT конфигурация
$jwtConf = [
    'secret' => $_ENV['JWT_SECRET'] ?? 'change-me-in-production',
    'issuer' => $_ENV['APP_URL'] ?? 'webapp',
    'ttl'    => (int)($_ENV['JWT_EXPIRE'] ?? 3600),
];

// Добавляем в контейнер
$container->set('pdo', $pdo);
$container->set('jwtConf', $jwtConf);
$container->set('env', $_ENV);

// Создаем приложение с контейнером
AppFactory::setContainer($container);
$app = AppFactory::create();

// Добавляем middleware
$app->addRoutingMiddleware();
$app->addBodyParsingMiddleware();

// Error middleware
$errorMiddleware = $app->addErrorMiddleware(
    $_ENV['APP_DEBUG'] === 'true',
    true,
    true
);

// Настройка CORS
$app->options('/{routes:.+}', function ($request, $response) {
    return $response;
});

$app->add(function ($request, $handler) {
    $response = $handler->handle($request);
    return $response
        ->withHeader('Access-Control-Allow-Origin', '*')
        ->withHeader('Access-Control-Allow-Headers', 'X-Requested-With, Content-Type, Accept, Origin, Authorization')
        ->withHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
});

// Загружаем маршруты
$routes = require __DIR__ . '/../src/routes.php';
$routes($app);

// Запускаем приложение
$app->run();e
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