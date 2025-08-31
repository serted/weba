<?php
namespace App\helpers;

final class Csrf
{
    public static function issue(array $env): array
    {
        $ttl     = (int)($env['CSRF_TTL'] ?? 7200);
        $secret  = $env['CSRF_SECRET'] ?? 'csrf-secret';
        $token   = bin2hex(random_bytes(32));
        $exp     = time() + $ttl;
        $payload = $token . '|' . $exp;
        $sig     = hash_hmac('sha256', $payload, $secret);
        return [$token, $exp, $sig];
    }

    public static function sign(array $env, string $token, int $exp): string
    {
        $secret  = $env['CSRF_SECRET'] ?? 'csrf-secret';
        return hash_hmac('sha256', $token . '|' . $exp, $secret);
    }

    public static function verify(array $env, string $token, int $exp, string $sig): bool
    {
        if ($exp < time()) return false;
        $calc = self::sign($env, $token, $exp);
        return hash_equals($calc, $sig);
    }
}
