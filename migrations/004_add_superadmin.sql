
-- 004: expand role to include super-admin
ALTER TABLE users ADD COLUMN role_new ENUM('user','admin','super-admin') NOT NULL DEFAULT 'user';
UPDATE users SET role_new = role WHERE role IN ('user','admin');
UPDATE users SET role_new = 'admin' WHERE role NOT IN ('user','admin');

-- Для SQLite совместимости
DROP TABLE IF EXISTS users_new;
CREATE TABLE users_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'user',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO users_new (id, email, password_hash, role, created_at, updated_at)
SELECT id, email, password_hash, 
       CASE WHEN role IN ('user','admin') THEN role ELSE 'admin' END,
       created_at, updated_at 
FROM users;

DROP TABLE users;
ALTER TABLE users_new RENAME TO users;

-- Добавление супер-админа (пароль: admin123)
INSERT OR IGNORE INTO users (email, password_hash, role) VALUES 
('admin@webapp.local', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'super-admin');
