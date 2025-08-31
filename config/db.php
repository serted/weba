<?php
$dsn = sprintf("mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4", getenv('DB_HOST')?:'127.0.0.1', getenv('DB_PORT')?:'3306', getenv('DB_NAME')?:'webapp');
return new PDO($dsn, getenv('DB_USER')?:'webapp', getenv('DB_PASS')?:'', [
  PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC, PDO::ATTR_EMULATE_PREPARES=>false
]);
