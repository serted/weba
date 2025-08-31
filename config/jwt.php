
<?php

return [
    'secret' => $_ENV['JWT_SECRET'] ?? 'your_super_secret_jwt_key_change_this_in_production',
    'issuer' => $_ENV['APP_URL'] ?? 'webapp',
    'ttl' => (int)($_ENV['JWT_EXPIRE'] ?? 3600),
    'algorithm' => 'HS256'
];
