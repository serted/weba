<?php
use PHPUnit\Framework\TestCase;

final class AuthTest extends TestCase
{
    private string $base = 'http://localhost:8000';

    public function testRegisterAndLogin(): void
    {
        $email = 'u'.time().'@example.com';
        $this->assertEquals(201, $this->post('/api/register', ['email'=>$email,'password'=>'StrongPass123'])['status']);
        $res = $this->post('/api/login', ['email'=>$email,'password'=>'StrongPass123']);
        $this->assertEquals(200, $res['status']);
    }

    public function testLoginWrong(): void
    {
        $res = $this->post('/api/login', ['email'=>'nope@example.com','password'=>'bad']);
        $this->assertTrue(in_array($res['status'], [401,404]));
    }

    private function post(string $path, array $body): array
    {
        $opts = ['http'=>['method'=>'POST','header'=>"Content-Type: application/json\r\n",'content'=>json_encode($body),'ignore_errors'=>true]];
        $ctx = stream_context_create($opts);
        $out = file_get_contents($this->base.$path, false, $ctx);
        preg_match('#HTTP/\S+\s(\d{3})#', $http_response_header[0] ?? '', $m);
        return ['status'=>(int)($m[1]??0),'body'=>$out];
    }
}
