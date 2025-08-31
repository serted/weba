
<?php

namespace App\Controllers;

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Firebase\JWT\JWT;
use Firebase\JWT\Key;

class AuthController
{
    private $pdo;
    private $jwtConf;

    public function __construct()
    {
        // Инициализация через глобальные переменные (для совместимости с Slim)
        global $app;
        $container = $app->getContainer();
        $this->pdo = $container->get('pdo');
        $this->jwtConf = $container->get('jwtConf');
    }

    public function register(Request $request, Response $response): Response
    {
        try {
            $data = $request->getParsedBody();
            
            // Валидация
            if (empty($data['email']) || empty($data['password'])) {
                return $this->jsonResponse($response, [
                    'success' => false,
                    'message' => 'Email и пароль обязательны'
                ], 400);
            }
            
            if (!filter_var($data['email'], FILTER_VALIDATE_EMAIL)) {
                return $this->jsonResponse($response, [
                    'success' => false,
                    'message' => 'Некорректный email'
                ], 400);
            }
            
            if (strlen($data['password']) < 6) {
                return $this->jsonResponse($response, [
                    'success' => false,
                    'message' => 'Пароль должен быть не менее 6 символов'
                ], 400);
            }
            
            // Проверяем, существует ли пользователь
            $stmt = $this->pdo->prepare("SELECT id FROM users WHERE email = ?");
            $stmt->execute([$data['email']]);
            
            if ($stmt->fetch()) {
                return $this->jsonResponse($response, [
                    'success' => false,
                    'message' => 'Пользователь с таким email уже существует'
                ], 409);
            }
            
            // Создаем пользователя
            $hashedPassword = password_hash($data['password'], PASSWORD_DEFAULT);
            $stmt = $this->pdo->prepare(
                "INSERT INTO users (email, password, name, role, created_at) VALUES (?, ?, ?, ?, NOW())"
            );
            
            $stmt->execute([
                $data['email'],
                $hashedPassword,
                $data['name'] ?? '',
                'user'
            ]);
            
            $userId = $this->pdo->lastInsertId();
            
            // Создаем JWT токен
            $token = $this->generateToken($userId, $data['email']);
            
            return $this->jsonResponse($response, [
                'success' => true,
                'message' => 'Регистрация успешна',
                'token' => $token,
                'user' => [
                    'id' => $userId,
                    'email' => $data['email'],
                    'name' => $data['name'] ?? '',
                    'role' => 'user'
                ]
            ]);
            
        } catch (\Exception $e) {
            return $this->jsonResponse($response, [
                'success' => false,
                'message' => 'Ошибка регистрации: ' . $e->getMessage()
            ], 500);
        }
    }

    public function login(Request $request, Response $response): Response
    {
        try {
            $data = $request->getParsedBody();
            
            if (empty($data['email']) || empty($data['password'])) {
                return $this->jsonResponse($response, [
                    'success' => false,
                    'message' => 'Email и пароль обязательны'
                ], 400);
            }
            
            // Поиск пользователя
            $stmt = $this->pdo->prepare("SELECT * FROM users WHERE email = ?");
            $stmt->execute([$data['email']]);
            $user = $stmt->fetch();
            
            if (!$user || !password_verify($data['password'], $user['password'])) {
                return $this->jsonResponse($response, [
                    'success' => false,
                    'message' => 'Неверный email или пароль'
                ], 401);
            }
            
            // Обновляем last_login
            $stmt = $this->pdo->prepare("UPDATE users SET last_login = NOW() WHERE id = ?");
            $stmt->execute([$user['id']]);
            
            // Создаем JWT токен
            $token = $this->generateToken($user['id'], $user['email']);
            
            // Сохраняем сессию
            $this->createSession($user['id'], $token);
            
            return $this->jsonResponse($response, [
                'success' => true,
                'message' => 'Вход выполнен успешно',
                'token' => $token,
                'user' => [
                    'id' => $user['id'],
                    'email' => $user['email'],
                    'name' => $user['name'],
                    'role' => $user['role']
                ]
            ]);
            
        } catch (\Exception $e) {
            return $this->jsonResponse($response, [
                'success' => false,
                'message' => 'Ошибка входа: ' . $e->getMessage()
            ], 500);
        }
    }

    public function logout(Request $request, Response $response): Response
    {
        try {
            $token = $this->extractToken($request);
            
            if ($token) {
                // Удаляем сессию
                $stmt = $this->pdo->prepare("DELETE FROM sessions WHERE token = ?");
                $stmt->execute([$token]);
            }
            
            return $this->jsonResponse($response, [
                'success' => true,
                'message' => 'Выход выполнен успешно'
            ]);
            
        } catch (\Exception $e) {
            return $this->jsonResponse($response, [
                'success' => false,
                'message' => 'Ошибка выхода: ' . $e->getMessage()
            ], 500);
        }
    }

    private function generateToken(int $userId, string $email): string
    {
        $payload = [
            'iss' => $this->jwtConf['issuer'],
            'aud' => $this->jwtConf['issuer'],
            'iat' => time(),
            'exp' => time() + $this->jwtConf['ttl'],
            'user_id' => $userId,
            'email' => $email
        ];
        
        return JWT::encode($payload, $this->jwtConf['secret'], 'HS256');
    }

    private function createSession(int $userId, string $token): void
    {
        $stmt = $this->pdo->prepare(
            "INSERT INTO sessions (user_id, token, ip_address, user_agent, created_at, expires_at) 
             VALUES (?, ?, ?, ?, NOW(), DATE_ADD(NOW(), INTERVAL ? SECOND))"
        );
        
        $stmt->execute([
            $userId,
            $token,
            $_SERVER['REMOTE_ADDR'] ?? 'unknown',
            $_SERVER['HTTP_USER_AGENT'] ?? 'unknown',
            $this->jwtConf['ttl']
        ]);
    }

    private function extractToken(Request $request): ?string
    {
        $header = $request->getHeaderLine('Authorization');
        if (preg_match('/Bearer\s+(.*)$/i', $header, $matches)) {
            return $matches[1];
        }
        return null;
    }

    private function jsonResponse(Response $response, array $data, int $status = 200): Response
    {
        $response->getBody()->write(json_encode($data));
        return $response
            ->withHeader('Content-Type', 'application/json')
            ->withStatus($status);
    }
}
