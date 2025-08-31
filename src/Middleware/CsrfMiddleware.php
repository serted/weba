<?php
namespace App\middleware;

use App\helpers\Csrf;
use Psr\Http\Message\ServerRequestInterface as Request;
use Psr\Http\Message\ResponseInterface as Response;

final class CsrfMiddleware
{
    public function __construct(private array $env) {}

    public function __invoke(Request $request, $handler): Response
    {
        $method = strtoupper($request->getMethod());
        $path   = $request->getUri()->getPath();

        $cookieName   = $this->env['CSRF_COOKIE_NAME']   ?? 'CSRF-TOKEN';
        $cookieSigned = $this->env['CSRF_COOKIE_SIGNED'] ?? 'CSRF-TOKEN-SIGNED';
        $headerName   = $this->env['CSRF_HEADER']        ?? 'X-CSRF-Token';

        // Ensure tokens exist on safe methods
        if (in_array($method, ['GET','HEAD','OPTIONS'])) {
            $this->ensureTokens();
            return $handler->handle($request);
        }

        // Only protect API mutations
        if (in_array($method, ['POST','PUT','PATCH','DELETE']) && preg_match('#^/api/#', $path)) {
            $headerToken = $request->getHeaderLine($headerName);
            $signed      = $_COOKIE[$cookieSigned] ?? '';
            $parts       = explode('|', $signed);
            if (count($parts) !== 2) return $this->deny(419, 'Bad CSRF signature');
            [$exp, $sig] = $parts; $exp = (int)$exp;
            if (!$headerToken || !Csrf::verify($this->env, $headerToken, $exp, $sig)) {
                return $this->deny(419, 'CSRF verification failed');
            }
        }

        return $handler->handle($request);
    }

    private function ensureTokens(): void
    {
        $cookieName   = $this->env['CSRF_COOKIE_NAME']   ?? 'CSRF-TOKEN';
        $cookieSigned = $this->env['CSRF_COOKIE_SIGNED'] ?? 'CSRF-TOKEN-SIGNED';
        $needRotate = empty($_COOKIE[$cookieName]) || empty($_COOKIE[$cookieSigned]);
        if ($needRotate) {
            [$token, $exp, $sig] = Csrf::issue($this->env);
            setcookie($cookieName, $token, ['expires'=>$exp,'httponly'=>false,'secure'=>isset($_SERVER['HTTPS']),'samesite'=>'Lax','path'=>'/']);
            setcookie($cookieSigned, $exp.'|'.$sig, ['expires'=>$exp,'httponly'=>true,'secure'=>isset($_SERVER['HTTPS']),'samesite'=>'Lax','path'=>'/']);
        }
    }

    private function deny(int $code, string $message): Response
    {
        $response = new \Slim\Psr7\Response($code);
        $response->getBody()->write(json_encode(['error' => $message]));
        return $response->withHeader('Content-Type', 'application/json');
    }
}
