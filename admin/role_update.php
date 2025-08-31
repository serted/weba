<?php
// admin/role_update.php
require __DIR__ . '/../vendor/autoload.php';
session_start();
if (empty($_SESSION['admin_id'])) { header('Location: /admin/login.php'); exit; }

$env = $_ENV;
if (file_exists(__DIR__ . '/../.env')) {
  $dotenv = Dotenv\Dotenv::createImmutable(dirname(__DIR__)); $dotenv->safeLoad();
  $env = $_ENV;
}

$dsn = sprintf("mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4", $env['DB_HOST']??'127.0.0.1', $env['DB_PORT']??'3306', $env['DB_NAME']??'webapp');
$pdo = new PDO($dsn, $env['DB_USER']??'webapp', $env['DB_PASS']??'', [
  PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC
]);

$id   = (int)($_POST['id'] ?? 0);
$role = $_POST['role'] ?? 'user';

if (!in_array($role, ['user','admin','super-admin'], true)) {
  http_response_code(400); echo "Bad role"; exit;
}

// Only super-admin can assign roles
if (($_SESSION['admin_role'] ?? 'admin') !== 'super-admin') {
  http_response_code(403); echo "Forbidden"; exit;
}

$st = $pdo->prepare("UPDATE users SET role=:r WHERE id=:id");
$st->execute([':r'=>$role, ':id'=>$id]);

$st2 = $pdo->prepare("INSERT INTO admin_logs(admin_id, action, meta, created_at) VALUES (:aid,'role_change',:m,NOW())");
$st2->execute([':aid'=>$_SESSION['admin_id'], ':m'=>json_encode(['user_id'=>$id,'role'=>$role])]);

header('Location: /admin/users_list.php?updated=1');
