
<?php

use Slim\App;
use Slim\Routing\RouteCollectorProxy;
use App\Controllers\AuthController;
use App\Controllers\UserController;
use App\Middleware\AuthMiddleware;
use App\Middleware\RoleMiddleware;

return function (App $app) {
    $container = $app->getContainer();
    
    // Получаем зависимости из контейнера
    $pdo = $container->get('pdo');
    $jwtConf = $container->get('jwtConf');
    
    // Создаем контроллеры
    $authController = new AuthController($pdo, $jwtConf);
    $userController = new UserController($pdo);
    
    // Создаем middleware
    $authMiddleware = new AuthMiddleware($jwtConf);
    $adminMiddleware = new RoleMiddleware(['admin', 'super-admin']);
    $superAdminMiddleware = new RoleMiddleware(['super-admin']);
    
    // Публичные маршруты
    $app->post('/api/auth/login', [$authController, 'login']);
    $app->post('/api/auth/register', [$authController, 'register']);
    
    // Маршруты, требующие аутентификации
    $app->group('/api', function (RouteCollectorProxy $group) use ($userController) {
        $group->get('/profile', [$userController, 'getProfile']);
        $group->put('/profile', [$userController, 'updateProfile']);
    })->add($authMiddleware);
    
    // Админские маршруты
    $app->group('/api/admin', function (RouteCollectorProxy $group) {
        $group->get('/users', function ($request, $response) {
            $response->getBody()->write(json_encode(['message' => 'Admin users list']));
            return $response->withHeader('Content-Type', 'application/json');
        });
    })->add($adminMiddleware)->add($authMiddleware);
    
    // Root endpoint
    $app->get('/', function ($request, $response) {
        $response->getBody()->write(json_encode([
            'message' => 'WebApp API',
            'version' => '1.0',
            'endpoints' => [
                'POST /api/auth/login',
                'POST /api/auth/register',
                'GET /api/profile',
                'PUT /api/profile'
            ]
        ]));
        return $response->withHeader('Content-Type', 'application/json');
    });
    
    // Health check
    $app->get('/health', function ($request, $response) {
        $response->getBody()->write(json_encode([
            'status' => 'ok',
            'timestamp' => date('Y-m-d H:i:s')
        ]));
        return $response->withHeader('Content-Type', 'application/json');
    });
};
