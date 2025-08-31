
<?php
namespace App\Controllers;

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

class UserController
{
    public function profile(Request $request, Response $response): Response
    {
        // Получаем данные пользователя из middleware
        $user = $request->getAttribute('user');
        
        $result = [
            'success' => true,
            'user' => $user
        ];
        
        $response->getBody()->write(json_encode($result));
        return $response->withHeader('Content-Type', 'application/json');
    }
    
    public function updateProfile(Request $request, Response $response): Response
    {
        $data = json_decode($request->getBody()->getContents(), true);
        $user = $request->getAttribute('user');
        
        // Здесь должна быть логика обновления профиля
        $result = [
            'success' => true,
            'message' => 'Профиль обновлен успешно',
            'user' => array_merge($user, $data)
        ];
        
        $response->getBody()->write(json_encode($result));
        return $response->withHeader('Content-Type', 'application/json');
    }
}
