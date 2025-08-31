
<?php

namespace App\helpers;

class Csrf 
{
    private static $secret;
    
    public static function setSecret($secret) 
    {
        self::$secret = $secret;
    }
    
    public static function generateToken(): string 
    {
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }
        
        $sessionId = session_id();
        return hash_hmac('sha256', $sessionId, self::$secret ?? 'default-secret');
    }
    
    public static function validateToken($token): bool 
    {
        if (empty($token)) {
            return false;
        }
        
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }
        
        $sessionId = session_id();
        $expectedToken = hash_hmac('sha256', $sessionId, self::$secret ?? 'default-secret');
        
        return hash_equals($expectedToken, $token);
    }
}
