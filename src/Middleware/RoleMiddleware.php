<?php
namespace App\middleware;

use Psr\Http\Message\ServerRequestInterface as Request;
use Psr\Http\Message\ResponseInterface as Response;
use Firebase\JWT\JWT;
use Firebase\JWT\Key;

final class RoleMiddleware
{
    public function __construct(private array $jwtConf, private array $roles = []) {}

    public function __invoke(Request $request, $handler): Response
    {
        $token = $_COOKIE['TOKEN'] ?? '';
        if (!$token) return $this->deny();

        try {
            $claims = JWT::decode($token, new Key($this->jwtConf['secret'], 'HS256'));
        } catch (\Throwable $e) {
            return $this->deny();
        }

        $role = $claims->role ?? 'user';
        if ($this->roles && !in_array($role, $this->roles, true)) {
            return $this->deny(403);
        }

        return $handler->handle($request->withAttribute('auth', [
            'id' => (int)($claims->sub ?? 0),
            'email' => (string)($claims->email ?? ''),
            'role' => (string)$role,
        ]));
    }

    private function deny(int $code = 401): Response
    {
        $res = new \Slim\Psr7\Response($code);
        $res->getBody()->write(json_encode(['error'=>$code===401 ? 'Unauthorized' : 'Forbidden']));
        return $res->withHeader('Content-Type','application/json');
    }
}
