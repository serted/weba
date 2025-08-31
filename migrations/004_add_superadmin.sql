-- 004: expand role to include super-admin
ALTER TABLE users MODIFY role ENUM('user','admin','super-admin') NOT NULL DEFAULT 'user';
