<?php
// admin/logs.php
require __DIR__ . '/../vendor/autoload.php';
session_start();
if (empty($_SESSION['admin_id'])) { header('Location: /admin/login.php'); exit; }
if (($_SESSION['admin_role'] ?? 'admin') !== 'super-admin') { http_response_code(403); exit('Forbidden'); }

use Dotenv\Dotenv;

$dotenv = Dotenv::createImmutable(dirname(__DIR__)); 
$dotenv->safeLoad();

// Используем тот же подход что и в config/db.php
$pdo = require __DIR__ . '/../config/db.php';

$logs = $pdo->query("SELECT * FROM admin_logs ORDER BY id DESC LIMIT 200")->fetchAll();
?><!doctype html>
<html><head><meta charset="utf-8"><title>Admin Logs</title>
<style>body{font-family:sans-serif;padding:16px} table{border-collapse:collapse;width:100%} td,th{border:1px solid #ddd;padding:8px}</style>
</head><body>
<h1>Admin logs</h1>
<table>
<tr><th>ID</th><th>Admin</th><th>Action</th><th>Meta</th><th>At</th></tr>
<?php foreach($logs as $l): ?>
<tr>
  <td><?= htmlspecialchars($l['id']) ?></td>
  <td><?= htmlspecialchars($l['admin_id']) ?></td>
  <td><?= htmlspecialchars($l['action']) ?></td>
  <td><pre><?= htmlspecialchars($l['meta']) ?></pre></td>
  <td><?= htmlspecialchars($l['created_at']) ?></td>
</tr>
<?php endforeach; ?>
</table>
</body></html>
