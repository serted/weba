<?php

namespace App\Middleware;

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Psr\Http\Server\RequestHandlerInterface as RequestHandler;
use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use Firebase\JWT\ExpiredException;

class AuthMiddleware 
{
    private $jwtConf;

    public function __construct($jwtConf) 
    {
        $this->jwtConf = $jwtConf;
    }

    public function __invoke(Request $request, RequestHandler $handler): Response 
    {
        $authHeader = $request->getHeaderLine('Authorization');

        if (!$authHeader || !preg_match('/Bearer\s+(.*)$/i', $authHeader, $matches)) {
            $response = new \Slim\Psr7\Response();
            $response->getBody()->write(json_encode(['error' => 'Токен не предоставлен']));
            return $response->withStatus(401)->withHeader('Content-Type', 'application/json');
        }

        $jwt = $matches[1];

        try {
            $decoded = JWT::decode($jwt, new Key($this->jwtConf['secret'], 'HS256'));
            $request = $request->withAttribute('user', (array)$decoded);

            return $handler->handle($request);
        } catch (ExpiredException $e) {
            $response = new \Slim\Psr7\Response();
            $response->getBody()->write(json_encode(['error' => 'Токен истек']));
            return $response->withStatus(401)->withHeader('Content-Type', 'application/json');
        } catch (\Exception $e) {
            $response = new \Slim\Psr7\Response();
            $response->getBody()->write(json_encode(['error' => 'Недействительный токен']));
            return $response->withStatus(401)->withHeader('Content-Type', 'application/json');
        }
    }
}