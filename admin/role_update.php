<?php
// admin/role_update.php
require __DIR__ . '/../vendor/autoload.php';
session_start();

use Dotenv\Dotenv;

if (empty($_SESSION['admin_id'])) { 
    header('Location: /admin/login.php'); 
    exit; 
}

// Only super-admin can assign roles
if (($_SESSION['admin_role'] ?? 'admin') !== 'super-admin') {
    http_response_code(403); 
    echo "Forbidden"; 
    exit;
}

// Load environment
$dotenv = Dotenv::createImmutable(dirname(__DIR__)); 
$dotenv->safeLoad();

// Use same database connection as main app
$pdo = require __DIR__ . '/../config/db.php';

// CSRF Protection
require_once __DIR__ . '/../src/helpers/Csrf.php';
use App\helpers\Csrf;

Csrf::setSecret($_ENV['CSRF_SECRET'] ?? 'default-csrf-secret');

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $csrfToken = $_POST['csrf_token'] ?? '';
    if (!Csrf::validateToken($csrfToken)) {
        http_response_code(403);
        echo "Invalid CSRF token";
        exit;
    }
}

$id   = (int)($_POST['id'] ?? 0);
$role = $_POST['role'] ?? 'user';

if (!in_array($role, ['user','admin','super-admin'], true)) {
    http_response_code(400); 
    echo "Bad role"; 
    exit;
}

$st = $pdo->prepare("UPDATE users SET role=:r WHERE id=:id");
$st->execute([':r'=>$role, ':id'=>$id]);

// Use proper timestamp format for SQLite/MySQL compatibility  
$timestamp = date('Y-m-d H:i:s');
$st2 = $pdo->prepare("INSERT INTO admin_logs(admin_id, action, meta, created_at) VALUES (:aid,'role_change',:m,:ts)");
$st2->execute([':aid'=>$_SESSION['admin_id'], ':m'=>json_encode(['user_id'=>$id,'role'=>$role]), ':ts'=>$timestamp]);

header('Location: /admin/users_list.php?updated=1');
