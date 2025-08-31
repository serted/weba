<?php

namespace App\Middleware;

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Psr\Http\Server\RequestHandlerInterface as RequestHandler;

class RoleMiddleware 
{
    private $allowedRoles;
    
    public function __construct(array $allowedRoles) 
    {
        $this->allowedRoles = $allowedRoles;
    }
    
    public function __invoke(Request $request, RequestHandler $handler): Response 
    {
        $user = $request->getAttribute('user');
        
        if (!$user || !isset($user['role'])) {
            $response = new \Slim\Psr7\Response();
            $response->getBody()->write(json_encode(['error' => 'Пользователь не аутентифицирован']));
            return $response->withStatus(401)->withHeader('Content-Type', 'application/json');
        }
        
        if (!in_array($user['role'], $this->allowedRoles)) {
            $response = new \Slim\Psr7\Response();
            $response->getBody()->write(json_encode(['error' => 'Недостаточно прав доступа']));
            return $response->withStatus(403)->withHeader('Content-Type', 'application/json');
        }
        
        return $handler->handle($request);
    }
}