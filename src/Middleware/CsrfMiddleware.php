<?php

namespace App\Middleware;

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Psr\Http\Server\RequestHandlerInterface as RequestHandler;

class CsrfMiddleware 
{
    private $secret;

    public function __construct($secret) 
    {
        $this->secret = $secret;
    }

    public function __invoke(Request $request, RequestHandler $handler): Response 
    {
        $method = $request->getMethod();

        if (in_array($method, ['POST', 'PUT', 'DELETE', 'PATCH'])) {
            $csrfToken = $request->getHeaderLine('X-CSRF-Token');

            if (!$this->validateToken($csrfToken)) {
                $response = new \Slim\Psr7\Response();
                $response->getBody()->write(json_encode(['error' => 'Недействительный CSRF токен']));
                return $response->withStatus(403)->withHeader('Content-Type', 'application/json');
            }
        }

        return $handler->handle($request);
    }

    private function validateToken($token): bool 
    {
        if (empty($token)) {
            return false;
        }

        $expectedToken = hash_hmac('sha256', session_id(), $this->secret);
        return hash_equals($expectedToken, $token);
    }

    public function generateToken(): string 
    {
        return hash_hmac('sha256', session_id(), $this->secret);
    }
}