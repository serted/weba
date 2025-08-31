<?php
namespace App\middleware;

use PDO;
use Psr\Http\Message\ServerRequestInterface as Request;
use Psr\Http\Message\ResponseInterface as Response;

final class RateLimitMiddleware
{
    public function __construct(private PDO $pdo, private array $env) {}

    public function __invoke(Request $request, $handler): Response
    {
        $method = strtoupper($request->getMethod());
        $path   = $request->getUri()->getPath();

        if (!in_array($method, ['POST','PUT','PATCH','DELETE']) || !preg_match('#^/api/#',$path)) {
            return $handler->handle($request);
        }

        $ip = $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
        $action = $this->actionFor($path);
        [$window, $max] = $this->limitsFor($action);

        if ($this->exceeded($action, $ip, $window, $max)) {
            $retryAfter = 1 + $this->secondsToReset($action, $ip, $window);
            $res = new \Slim\Psr7\Response(429);
            $res = $res->withHeader('Retry-After', (string)$retryAfter)
                       ->withHeader('Content-Type','application/json');
            $res->getBody()->write(json_encode(['error'=>'Too Many Requests']));
            return $res;
        }

        $this->record($action, $ip);
        return $handler->handle($request);
    }

    private function actionFor(string $path): string
    {
        if (str_starts_with($path, '/api/login'))    return 'login';
        if (str_starts_with($path, '/api/register')) return 'register';
        return 'api_mutation';
    }

    private function limitsFor(string $action): array
    {
        $map = [
          'api_mutation' => [
            (int)($this->env['RATE_LIMIT_MUTATION_WINDOW'] ?? 60),
            (int)($this->env['RATE_LIMIT_MUTATION_MAX'] ?? 60),
          ],
          'login' => [
            (int)($this->env['RATE_LIMIT_LOGIN_WINDOW'] ?? 60),
            (int)($this->env['RATE_LIMIT_LOGIN_MAX'] ?? 10),
          ],
          'register' => [
            (int)($this->env['RATE_LIMIT_REGISTER_WINDOW'] ?? 60),
            (int)($this->env['RATE_LIMIT_REGISTER_MAX'] ?? 10),
          ],
        ];
        return $map[$action] ?? $map['api_mutation'];
    }

    private function keyHash(string $action, string $ip): string
    {
        return hash('sha256', $action . '|' . $ip);
    }

    private function exceeded(string $action, string $ip, int $window, int $max): bool
    {
        $cut = date('Y-m-d H:i:s', time() - $window);
        $key = $this->keyHash($action, $ip);
        $st  = $this->pdo->prepare("SELECT COUNT(*) c FROM login_attempts WHERE action=:a AND key_hash=:k AND created_at >= :cut");
        $st->execute([':a'=>$action, ':k'=>$key, ':cut'=>$cut]);
        return (int)$st->fetchColumn() >= $max;
    }

    private function secondsToReset(string $action, string $ip, int $window): int
    {
        $key = $this->keyHash($action, $ip);
        $st  = $this->pdo->prepare("SELECT MIN(created_at) AS first FROM login_attempts WHERE action=:a AND key_hash=:k AND created_at >= :cut");
        $st->execute([':a'=>$action, ':k'=>$key, ':cut'=>date('Y-m-d H:i:s', time() - $window)]);
        $first = $st->fetchColumn();
        if (!$first) return 0;
        $elapsed = time() - strtotime($first);
        return max(0, $window - $elapsed);
    }

    private function record(string $action, string $ip): void
    {
        $key = $this->keyHash($action, $ip);
        $st  = $this->pdo->prepare("INSERT INTO login_attempts(action, key_hash, ip, created_at) VALUES (:a,:k,:ip,NOW())");
        $st->execute([':a'=>$action, ':k'=>$key, ':ip'=>$ip]);
    }
}
