<?php

namespace App\Middleware;

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Psr\Http\Server\RequestHandlerInterface as RequestHandler;

class RateLimitMiddleware 
{
    private $maxRequests;
    private $timeWindow;
    private $storage = [];
    
    public function __construct($maxRequests = 60, $timeWindow = 60) 
    {
        $this->maxRequests = $maxRequests;
        $this->timeWindow = $timeWindow;
    }
    
    public function __invoke(Request $request, RequestHandler $handler): Response 
    {
        $clientIP = $this->getClientIP($request);
        $currentTime = time();
        
        // Очищаем старые записи
        $this->cleanupOldEntries($currentTime);
        
        // Проверяем лимит
        if (!isset($this->storage[$clientIP])) {
            $this->storage[$clientIP] = [];
        }
        
        $this->storage[$clientIP][] = $currentTime;
        
        $requestCount = count($this->storage[$clientIP]);
        
        if ($requestCount > $this->maxRequests) {
            $response = new \Slim\Psr7\Response();
            $response->getBody()->write(json_encode(['error' => 'Превышен лимит запросов']));
            return $response->withStatus(429)->withHeader('Content-Type', 'application/json');
        }
        
        return $handler->handle($request);
    }
    
    private function getClientIP(Request $request): string 
    {
        $headers = [
            'HTTP_CF_CONNECTING_IP',
            'HTTP_CLIENT_IP',
            'HTTP_X_FORWARDED_FOR',
            'HTTP_X_FORWARDED',
            'HTTP_FORWARDED_FOR',
            'HTTP_FORWARDED',
            'REMOTE_ADDR'
        ];
        
        foreach ($headers as $header) {
            if (!empty($_SERVER[$header])) {
                return $_SERVER[$header];
            }
        }
        
        return '127.0.0.1';
    }
    
    private function cleanupOldEntries($currentTime): void 
    {
        foreach ($this->storage as $ip => &$timestamps) {
            $timestamps = array_filter($timestamps, function($timestamp) use ($currentTime) {
                return ($currentTime - $timestamp) <= $this->timeWindow;
            });
            
            if (empty($timestamps)) {
                unset($this->storage[$ip]);
            }
        }
    }
}