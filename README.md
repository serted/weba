# WebApp

## Установка на shared-хостинг

1. Залейте проект по FTP/SFTP.
2. Выполните `composer install --no-dev` локально и загрузите папку `vendor/`.
3. Скопируйте `.env.example` в `.env` и настройте доступы к БД и JWT.
4. Импортируйте SQL из `migrations/*.sql` в MySQL.
5. Проверьте, что `.htaccess` включен.

## Тесты

- Unit: `vendor/bin/phpunit`
- E2E: `npx cypress open`

## CI/CD

GitHub Actions настроен: линтинг, тесты, визуальный регресс, автодеплой через FTP.



## Testing
- PHPUnit: `vendor/bin/phpunit --configuration tests/phpunit.xml`
- Cypress: `npx cypress open`

## Roles
- user, admin, super-admin (migration 004)
"# weba" 
