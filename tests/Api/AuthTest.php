<?php

use PHPUnit\Framework\TestCase;
use Slim\Factory\AppFactory;
use Slim\Psr7\Factory\ServerRequestFactory;
use App\Controllers\AuthController;

class AuthTest extends TestCase
{
    private $app;
    private $authController;

    protected function setUp(): void
    {
        // Configure Slim application for testing
        AppFactory::setSlimHttpDecoratorsCallable(function () {
            return new \Slim\Psr7\Factory\ServerRequestFactory();
        });
        $this->app = AppFactory::create();
        $this->authController = new AuthController();

        // Set environment variables for testing
        $_ENV['JWT_SECRET'] = 'test-secret-key-for-testing';
        $_ENV['DB_HOST'] = 'mysql'; // Assuming a MySQL container named 'mysql'
        $_ENV['DB_NAME'] = 'slim_app';
        $_ENV['DB_USER'] = 'root';
        $_ENV['DB_PASS'] = 'password';

        // Add the AuthController routes to the app
        $app = $this->app;
        $app->post('/api/register', [$this->authController, 'register']);
        $app->post('/api/login', [$this->authController, 'login']);
        $app->post('/api/logout', [$this->authController, 'logout']);
    }

    public function testCanRegisterUser(): void
    {
        $requestFactory = new ServerRequestFactory();
        $request = $requestFactory->createServerRequest('POST', '/api/register')
            ->withParsedBody([
                'email' => 'test_' . time() . '@example.com',
                'password' => 'password123'
            ]);

        // Mock the request body as JSON
        $request = $request->withBody(
            \Slim\Psr7\Factory\StreamFactory::createFromString(
                json_encode(['email' => 'test_' . time() . '@example.com', 'password' => 'password123'])
            )
        );

        $response = new \Slim\Psr7\Response();
        $result = $this->authController->register($request, $response);

        $this->assertEquals(200, $result->getStatusCode());

        $body = json_decode((string)$result->getBody(), true);
        $this->assertTrue($body['success']);
        $this->assertEquals('Пользователь зарегистрирован успешно', $body['message']);
    }

    public function testCanLoginUser(): void
    {
        // First, register a user
        $registerRequestFactory = new ServerRequestFactory();
        $registerRequest = $registerRequestFactory->createServerRequest('POST', '/api/register')
            ->withParsedBody([
                'email' => 'login_test@example.com',
                'password' => 'password123'
            ]);
        $registerRequest = $registerRequest->withBody(
            \Slim\Psr7\Factory\StreamFactory::createFromString(
                json_encode(['email' => 'login_test@example.com', 'password' => 'password123'])
            )
        );
        $registerResponse = new \Slim\Psr7\Response();
        $this->authController->register($registerRequest, $registerResponse);


        // Now, try to log in
        $requestFactory = new ServerRequestFactory();
        $request = $requestFactory->createServerRequest('POST', '/api/login')
            ->withParsedBody([
                'email' => 'login_test@example.com',
                'password' => 'password123'
            ]);

        // Mock the request body as JSON
        $request = $request->withBody(
            \Slim\Psr7\Factory\StreamFactory::createFromString(
                json_encode(['email' => 'login_test@example.com', 'password' => 'password123'])
            )
        );

        $response = new \Slim\Psr7\Response();
        $result = $this->authController->login($request, $response);

        $this->assertEquals(200, $result->getStatusCode());

        $body = json_decode((string)$result->getBody(), true);
        $this->assertTrue($body['success']);
        $this->assertArrayHasKey('token', $body);
        $this->assertArrayHasKey('user', $body);
        $this->assertEquals('login_test@example.com', $body['user']['email']);
    }

    public function testLoginRequiresEmailAndPassword(): void
    {
        $requestFactory = new ServerRequestFactory();
        $request = $requestFactory->createServerRequest('POST', '/api/login');

        // Empty body
        $request = $request->withBody(
            \Slim\Psr7\Factory\StreamFactory::createFromString('{}')
        );

        $response = new \Slim\Psr7\Response();
        $result = $this->authController->login($request, $response);

        $this->assertEquals(400, $result->getStatusCode());

        $body = json_decode((string)$result->getBody(), true);
        $this->assertEquals('Email и пароль обязательны', $body['error']);
    }

    public function testLoginWithIncorrectPassword(): void
    {
        // Register a user first
        $registerRequestFactory = new ServerRequestFactory();
        $registerRequest = $registerRequestFactory->createServerRequest('POST', '/api/register')
            ->withParsedBody([
                'email' => 'wrong_pass_test@example.com',
                'password' => 'correct_password'
            ]);
        $registerRequest = $registerRequest->withBody(
            \Slim\Psr7\Factory\StreamFactory::createFromString(
                json_encode(['email' => 'wrong_pass_test@example.com', 'password' => 'correct_password'])
            )
        );
        $registerResponse = new \Slim\Psr7\Response();
        $this->authController->register($registerRequest, $registerResponse);

        // Attempt login with incorrect password
        $requestFactory = new ServerRequestFactory();
        $request = $requestFactory->createServerRequest('POST', '/api/login')
            ->withParsedBody([
                'email' => 'wrong_pass_test@example.com',
                'password' => 'wrong_password'
            ]);
        $request = $request->withBody(
            \Slim\Psr7\Factory\StreamFactory::createFromString(
                json_encode(['email' => 'wrong_pass_test@example.com', 'password' => 'wrong_password'])
            )
        );

        $response = new \Slim\Psr7\Response();
        $result = $this->authController->login($request, $response);

        $this->assertEquals(401, $result->getStatusCode());

        $body = json_decode((string)$result->getBody(), true);
        $this->assertEquals('Неверный email или пароль', $body['error']);
    }


    public function testLogoutUser(): void
    {
        // First, log in to get a token
        $loginRequestFactory = new ServerRequestFactory();
        $loginRequest = $loginRequestFactory->createServerRequest('POST', '/api/login')
            ->withParsedBody([
                'email' => 'logout_test@example.com',
                'password' => 'password123'
            ]);
        $loginRequest = $loginRequest->withBody(
            \Slim\Psr7\Factory\StreamFactory::createFromString(
                json_encode(['email' => 'logout_test@example.com', 'password' => 'password123'])
            )
        );
        $loginResponse = new \Slim\Psr7\Response();
        $loginResult = $this->authController->login($loginRequest, $loginResponse);
        $loginBody = json_decode((string)$loginResult->getBody(), true);
        $token = $loginBody['token'];

        // Now, attempt to log out
        $requestFactory = new ServerRequestFactory();
        $request = $requestFactory->createServerRequest('POST', '/api/logout')
            ->withHeader('Authorization', 'Bearer ' . $token); // Assuming token is passed in header

        $response = new \Slim\Psr7\Response();
        $result = $this->authController->logout($request, $response);

        $this->assertEquals(200, $result->getStatusCode());

        $body = json_decode((string)$result->getBody(), true);
        $this->assertTrue($body['success']);
        $this->assertEquals('Выход выполнен успешно', $body['message']);
    }

    public function testLogoutWithoutToken(): void
    {
        $requestFactory = new ServerRequestFactory();
        $request = $requestFactory->createServerRequest('POST', '/api/logout'); // No token header

        $response = new \Slim\Psr7\Response();
        $result = $this->authController->logout($request, $response);

        $this->assertEquals(401, $result->getStatusCode());

        $body = json_decode((string)$result->getBody(), true);
        $this->assertEquals('Требуется аутентификация', $body['error']);
    }
}