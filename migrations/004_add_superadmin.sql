-- 004: expand role to include super-admin
ALTER TABLE users MODIFY role ENUM('user','admin','super-admin') NOT NULL DEFAULT 'user';
-- Добавление супер-админа (пароль: admin123)
INSERT IGNORE INTO users (email, password_hash, role) VALUES 
('admin@webapp.local', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'super-admin');
