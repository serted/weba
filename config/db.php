<?php
$socket = $_ENV['DB_SOCKET'] ?? null;

    if ($socket && file_exists($socket)) {
        $dsn = "mysql:unix_socket={$socket};dbname={$_ENV['DB_NAME']};charset=utf8mb4";
    } else {
        $dsn = "mysql:host={$_ENV['DB_HOST']};port={$_ENV['DB_PORT']};dbname={$_ENV['DB_NAME']};charset=utf8mb4";
    }
return new PDO($dsn, getenv('DB_USER')?:'webapp', getenv('DB_PASS')?:'', [
  PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC, PDO::ATTR_EMULATE_PREPARES=>false
]);