<?php
declare(strict_types=1);

require __DIR__ . '/../vendor/autoload.php';

use Slim\Factory\AppFactory;
use Dotenv\Dotenv;

$dotenv = Dotenv::createImmutable(dirname(__DIR__));
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

$jwtConf = [
  'secret' => $_ENV['JWT_SECRET'] ?? 'change-me',
  'issuer' => $_ENV['JWT_ISSUER'] ?? 'webapp',
  'ttl'    => (int)($_ENV['JWT_TTL'] ?? 604800),
];

$app = AppFactory::create();
$app->addBodyParsingMiddleware();

session_name('WEBAPPSESSID');
if (session_status() !== PHP_SESSION_ACTIVE) {
  session_start([
    'cookie_httponly' => true,
    'cookie_secure'   => isset($_SERVER['HTTPS']),
    'cookie_samesite' => 'Lax',
  ]);
}

// share in container-like registry
$app->getContainer()?->set('pdo', $pdo);
$app->getContainer()?->set('jwtConf', $jwtConf);
$app->getContainer()?->set('env', $_ENV);

// middlewares
require_once __DIR__ . '/../src/helpers/Csrf.php';
require_once __DIR__ . '/../src/middleware/CsrfMiddleware.php';
require_once __DIR__ . '/../src/middleware/RateLimitMiddleware.php';
require_once __DIR__ . '/../src/middleware/RoleMiddleware.php';

$app->add(new \App\middleware\CsrfMiddleware($_ENV));
$app->add(new \App\middleware\RateLimitMiddleware($pdo, $_ENV));

require __DIR__ . '/../src/routes.php';
$app->run();
<?php
require_once __DIR__ . '/../vendor/autoload.php';

use Slim\Factory\AppFactory;
use Slim\Middleware\MethodOverrideMiddleware;
use Slim\Middleware\ContentLengthMiddleware;
use App\Middleware\CsrfMiddleware;
use App\Middleware\RateLimitMiddleware;
use Dotenv\Dotenv;

// Загружаем переменные окружения
$dotenv = Dotenv::createImmutable(__DIR__ . '/..');
$dotenv->load();

$app = AppFactory::create();

// Добавляем middleware
$app->addRoutingMiddleware();
$app->add(new MethodOverrideMiddleware());
$app->add(new ContentLengthMiddleware());
$app->add(new CsrfMiddleware());
$app->add(new RateLimitMiddleware());

// Error handling
$errorMiddleware = $app->addErrorMiddleware(
    $_ENV['APP_DEBUG'] === 'true',
    true,
    true
);

// API маршруты
$app->group('/api', function ($group) {
    // Health check
    $group->get('/health', function ($request, $response) {
        $data = [
            'status' => 'ok',
            'timestamp' => time(),
            'version' => '1.0.0'
        ];
        $response->getBody()->write(json_encode($data));
        return $response->withHeader('Content-Type', 'application/json');
    });
    
    // Auth routes
    $group->post('/register', '\App\Controllers\AuthController:register');
    $group->post('/login', '\App\Controllers\AuthController:login');
    $group->post('/logout', '\App\Controllers\AuthController:logout');
    
    // User routes (требуют авторизации)
    $group->get('/profile', '\App\Controllers\UserController:profile')
        ->add('\App\Middleware\AuthMiddleware');
    $group->put('/profile', '\App\Controllers\UserController:updateProfile')
        ->add('\App\Middleware\AuthMiddleware');
});

$app->run();
