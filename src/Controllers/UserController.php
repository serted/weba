<?php

namespace App\Controllers;

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

class UserController 
{
    private $pdo;

    public function __construct($pdo) 
    {
        $this->pdo = $pdo;
    }

    public function getProfile(Request $request, Response $response): Response 
    {
        $user = $request->getAttribute('user');

        $response->getBody()->write(json_encode([
            'user' => [
                'id' => $user['user_id'],
                'email' => $user['email'],
                'role' => $user['role']
            ]
        ]));

        return $response->withHeader('Content-Type', 'application/json');
    }

    public function updateProfile(Request $request, Response $response): Response 
    {
        $user = $request->getAttribute('user');
        $data = json_decode($request->getBody()->getContents(), true);

        $updateFields = [];
        $values = [];

        if (isset($data['email'])) {
            $updateFields[] = 'email = ?';
            $values[] = $data['email'];
        }

        if (isset($data['password'])) {
            $updateFields[] = 'password_hash = ?';
            $values[] = password_hash($data['password'], PASSWORD_DEFAULT);
        }

        if (empty($updateFields)) {
            $response->getBody()->write(json_encode(['error' => 'Нет данных для обновления']));
            return $response->withStatus(400)->withHeader('Content-Type', 'application/json');
        }

        $values[] = $user['user_id'];

        $sql = "UPDATE users SET " . implode(', ', $updateFields) . " WHERE id = ?";
        $stmt = $this->pdo->prepare($sql);

        if ($stmt->execute($values)) {
            $response->getBody()->write(json_encode(['message' => 'Профиль обновлен']));
            return $response->withHeader('Content-Type', 'application/json');
        }

        $response->getBody()->write(json_encode(['error' => 'Ошибка обновления профиля']));
        return $response->withStatus(500)->withHeader('Content-Type', 'application/json');
    }
}