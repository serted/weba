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
