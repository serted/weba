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

    public function __construct($pdo, $jwtConf)
    {
        $this->pdo = $pdo;
        $this->jwtConf = $jwtConf;
    }

    public function login(Request $request, Response $response): Response
    {
        $data = json_decode($request->getBody()->getContents(), true);

        if (!isset($data['email']) || !isset($data['password'])) {
            $response->getBody()->write(json_encode(['error' => 'Email и пароль обязательны']));
            return $response->withStatus(400)->withHeader('Content-Type', 'application/json');
        }

        // Поиск пользователя
        $stmt = $this->pdo->prepare("SELECT * FROM users WHERE email = ?");
        $stmt->execute([$data['email']]);
        $user = $stmt->fetch();

        if (!$user || !password_verify($data['password'], $user['password_hash'])) {
            $response->getBody()->write(json_encode(['error' => 'Неверные учетные данные']));
            return $response->withStatus(401)->withHeader('Content-Type', 'application/json');
        }

        // Создание JWT токена
        $payload = [
            'iss' => $this->jwtConf['issuer'],
            'iat' => time(),
            'exp' => time() + $this->jwtConf['ttl'],
            'user_id' => $user['id'],
            'email' => $user['email'],
            'role' => $user['role']
        ];

        $jwt = JWT::encode($payload, $this->jwtConf['secret'], 'HS256');

        $response->getBody()->write(json_encode([
            'message' => 'Успешный вход',
            'token' => $jwt,
            'user' => [
                'id' => $user['id'],
                'email' => $user['email'],
                'role' => $user['role']
            ]
        ]));

        return $response->withHeader('Content-Type', 'application/json');
    }

    public function register(Request $request, Response $response): Response
    {
        $data = json_decode($request->getBody()->getContents(), true);

        if (!isset($data['email']) || !isset($data['password'])) {
            $response->getBody()->write(json_encode(['error' => 'Email и пароль обязательны']));
            return $response->withStatus(400)->withHeader('Content-Type', 'application/json');
        }

        // Проверка на существующего пользователя
        $stmt = $this->pdo->prepare("SELECT id FROM users WHERE email = ?");
        $stmt->execute([$data['email']]);

        if ($stmt->fetch()) {
            $response->getBody()->write(json_encode(['error' => 'Пользователь уже существует']));
            return $response->withStatus(409)->withHeader('Content-Type', 'application/json');
        }

        // Создание пользователя
        $passwordHash = password_hash($data['password'], PASSWORD_DEFAULT);
        $stmt = $this->pdo->prepare("INSERT INTO users (email, password_hash) VALUES (?, ?)");

        if ($stmt->execute([$data['email'], $passwordHash])) {
            $userId = $this->pdo->lastInsertId();

            $response->getBody()->write(json_encode([
                'message' => 'Пользователь создан',
                'user_id' => $userId
            ]));

            return $response->withStatus(201)->withHeader('Content-Type', 'application/json');
        }

        $response->getBody()->write(json_encode(['error' => 'Ошибка создания пользователя']));
        return $response->withStatus(500)->withHeader('Content-Type', 'application/json');
    }
}