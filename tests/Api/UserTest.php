<?php
use PHPUnit\Framework\TestCase;

final class UserTest extends TestCase
{
    private string $base = 'http://localhost:8000';

    public function testUserUnauthorized(): void
    {
        $opts = ['http'=>['method'=>'GET','ignore_errors'=>true]];
        $ctx = stream_context_create($opts);
        $out = file_get_contents($this->base.'/api/user', false, $ctx);
        preg_match('#HTTP/\S+\s(\d{3})#', $http_response_header[0] ?? '', $m);
        $this->assertEquals(401, (int)($m[1]??0));
    }
}
