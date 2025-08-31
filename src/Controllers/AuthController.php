
<?php
namespace App\Controllers;

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Firebase\JWT\JWT;
use Firebase\JWT\Key;

class AuthController
{
    public function register(Request $request, Response $response): Response
    {
        $data = json_decode($request->getBody()->getContents(), true);
        
        // Валидация данных
        if (empty($data['email']) || empty($data['password'])) {
            $error = ['error' => 'Email и пароль обязательны'];
            $response->getBody()->write(json_encode($error));
            return $response->withStatus(400)->withHeader('Content-Type', 'application/json');
        }
        
        // Здесь должна быть логика регистрации
        $result = [
            'success' => true,
            'message' => 'Пользователь зарегистрирован успешно'
        ];
        
        $response->getBody()->write(json_encode($result));
        return $response->withHeader('Content-Type', 'application/json');
    }
    
    public function login(Request $request, Response $response): Response
    {
        $data = json_decode($request->getBody()->getContents(), true);
        
        // Валидация данных
        if (empty($data['email']) || empty($data['password'])) {
            $error = ['error' => 'Email и пароль обязательны'];
            $response->getBody()->write(json_encode($error));
            return $response->withStatus(400)->withHeader('Content-Type', 'application/json');
        }
        
        // Здесь должна быть логика аутентификации
        $token = JWT::encode([
            'user_id' => 1,
            'email' => $data['email'],
            'exp' => time() + (7 * 24 * 60 * 60) // 7 дней
        ], $_ENV['JWT_SECRET'], 'HS256');
        
        $result = [
            'success' => true,
            'token' => $token,
            'user' => [
                'id' => 1,
                'email' => $data['email'],
                'role' => 'user'
            ]
        ];
        
        $response->getBody()->write(json_encode($result));
        return $response->withHeader('Content-Type', 'application/json');
    }
    
    public function logout(Request $request, Response $response): Response
    {
        $result = ['success' => true, 'message' => 'Выход выполнен успешно'];
        $response->getBody()->write(json_encode($result));
        return $response->withHeader('Content-Type', 'application/json');
    }
}
