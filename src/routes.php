
<?php

use Slim\Routing\RouteCollectorProxy;
use App\Controllers\AuthController;
use App\Controllers\UserController;
use App\Middleware\AuthMiddleware;
use App\Middleware\RoleMiddleware;

// Health check без middleware
$app->get('/api/health', function ($request, $response) {
    $data = [
        'status' => 'ok',
        'timestamp' => time(),
        'version' => '1.0.0',
        'environment' => $_ENV['APP_ENV'] ?? 'production'
    ];
    
    $response->getBody()->write(json_encode($data));
    return $response->withHeader('Content-Type', 'application/json');
});

// API группа с middleware
$app->group('/api', function (RouteCollectorProxy $group) {
    
    // Auth routes (без авторизации)
    $group->post('/register', [AuthController::class, 'register']);
    $group->post('/login', [AuthController::class, 'login']);
    $group->post('/logout', [AuthController::class, 'logout']);
    
    // Protected routes
    $group->group('', function (RouteCollectorProxy $protected) {
        $protected->get('/profile', [UserController::class, 'profile']);
        $protected->put('/profile', [UserController::class, 'updateProfile']);
        
        // Admin routes
        $protected->group('/admin', function (RouteCollectorProxy $admin) {
            $admin->get('/users', [UserController::class, 'listUsers']);
            $admin->post('/users', [UserController::class, 'createUser']);
            $admin->put('/users/{id}', [UserController::class, 'updateUser']);
            $admin->delete('/users/{id}', [UserController::class, 'deleteUser']);
        })->add(new RoleMiddleware(['admin', 'superadmin']));
        
    })->add(new AuthMiddleware());
});

// Fallback для SPA (все остальные маршруты)
$app->get('/{routes:.+}', function ($request, $response) {
    $file = __DIR__ . '/../public/index.html';
    if (file_exists($file)) {
        $response->getBody()->write(file_get_contents($file));
        return $response->withHeader('Content-Type', 'text/html');
    }
    return $response->withStatus(404);
});
