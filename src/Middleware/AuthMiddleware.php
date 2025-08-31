
<?php
namespace App\Middleware;

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Psr\Http\Server\RequestHandlerInterface as RequestHandler;
use Firebase\JWT\JWT;
use Firebase\JWT\Key;

class AuthMiddleware
{
    public function __invoke(Request $request, RequestHandler $handler): Response
    {
        $authHeader = $request->getHeader('Authorization');
        
        if (empty($authHeader)) {
            $response = new \Slim\Psr7\Response();
            $error = ['error' => 'Токен авторизации не предоставлен'];
            $response->getBody()->write(json_encode($error));
            return $response->withStatus(401)->withHeader('Content-Type', 'application/json');
        }
        
        $token = str_replace('Bearer ', '', $authHeader[0]);
        
        try {
            $decoded = JWT::decode($token, new Key($_ENV['JWT_SECRET'], 'HS256'));
            $user = [
                'id' => $decoded->user_id,
                'email' => $decoded->email
            ];
            
            $request = $request->withAttribute('user', $user);
            return $handler->handle($request);
            
        } catch (\Exception $e) {
            $response = new \Slim\Psr7\Response();
            $error = ['error' => 'Недействительный токен'];
            $response->getBody()->write(json_encode($error));
            return $response->withStatus(401)->withHeader('Content-Type', 'application/json');
        }
    }
}
<?php

namespace App\Middleware;

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Psr\Http\Server\MiddlewareInterface;
use Psr\Http\Server\RequestHandlerInterface as RequestHandler;
use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use Firebase\JWT\ExpiredException;

class AuthMiddleware implements MiddlewareInterface
{
    private $pdo;
    private $jwtConf;

    public function __construct()
    {
        global $app;
        $container = $app->getContainer();
        $this->pdo = $container->get('pdo');
        $this->jwtConf = $container->get('jwtConf');
    }

    public function process(Request $request, RequestHandler $handler): Response
    {
        $token = $this->extractToken($request);
        
        if (!$token) {
            return $this->unauthorizedResponse();
        }
        
        try {
            $decoded = JWT::decode($token, new Key($this->jwtConf['secret'], 'HS256'));
            
            // Проверяем сессию в БД
            $stmt = $this->pdo->prepare("SELECT * FROM sessions WHERE token = ? AND expires_at > NOW()");
            $stmt->execute([$token]);
            $session = $stmt->fetch();
            
            if (!$session) {
                return $this->unauthorizedResponse('Сессия истекла');
            }
            
            // Добавляем информацию о пользователе в запрос
            $request = $request->withAttribute('user_id', $decoded->user_id);
            $request = $request->withAttribute('user_email', $decoded->email);
            $request = $request->withAttribute('session', $session);
            
            return $handler->handle($request);
            
        } catch (ExpiredException $e) {
            return $this->unauthorizedResponse('Токен истек');
        } catch (\Exception $e) {
            return $this->unauthorizedResponse('Недействительный токен');
        }
    }

    private function extractToken(Request $request): ?string
    {
        $header = $request->getHeaderLine('Authorization');
        if (preg_match('/Bearer\s+(.*)$/i', $header, $matches)) {
            return $matches[1];
        }
        return null;
    }

    private function unauthorizedResponse(string $message = 'Требуется авторизация'): Response
    {
        $response = new \Slim\Psr7\Response();
        $response->getBody()->write(json_encode([
            'success' => false,
            'message' => $message
        ]));
        
        return $response
            ->withHeader('Content-Type', 'application/json')
            ->withStatus(401);
    }
}
