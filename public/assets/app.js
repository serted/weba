
// SPA Router
class Router {
    constructor() {
        this.routes = {};
        this.currentRoute = null;
        
        // Обработка клика по ссылкам с data-route
        document.addEventListener('click', (e) => {
            if (e.target.matches('[data-route]')) {
                e.preventDefault();
                const route = e.target.getAttribute('data-route');
                this.navigate(route);
            }
        });
        
        // Обработка popstate для кнопки "назад"
        window.addEventListener('popstate', () => {
            this.loadRoute(window.location.pathname);
        });
        
        // Загружаем текущий маршрут при инициализации
        this.loadRoute(window.location.pathname);
    }
    
    addRoute(path, handler) {
        this.routes[path] = handler;
    }
    
    navigate(path) {
        window.history.pushState({}, '', path);
        this.loadRoute(path);
    }
    
    loadRoute(path) {
        this.currentRoute = path;
        
        // Обновляем активное состояние навигации
        document.querySelectorAll('[data-route]').forEach(link => {
            link.classList.toggle('active', link.getAttribute('data-route') === path);
        });
        
        // Загружаем контент маршрута
        if (this.routes[path]) {
            this.routes[path]();
        } else {
            this.routes['/'] && this.routes['/']();
        }
    }
}

// API Client
class ApiClient {
    static async request(url, options = {}) {
        try {
            const response = await fetch(url, options);
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Ошибка запроса');
            }
            
            return data;
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    }
    
    static async get(url) {
        return this.request(url, { method: 'GET' });
    }
    
    static async post(url, data) {
        return this.request(url, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }
    
    static async put(url, data) {
        return this.request(url, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }
}

// Инициализация приложения
document.addEventListener('DOMContentLoaded', function() {
    const router = new Router();
    const contentElement = document.getElementById('content');
    
    // Маршруты
    router.addRoute('/', () => {
        contentElement.innerHTML = `
            <div class="container">
                <h1>Главная страница</h1>
                <p>Добро пожаловать в WebApp!</p>
                <button onclick="testHealthCheck()">Проверить API</button>
                <div id="api-result"></div>
            </div>
        `;
    });
    
    router.addRoute('/login', () => {
        contentElement.innerHTML = `
            <div class="container">
                <h1>Вход в систему</h1>
                <form id="login-form">
                    <div class="form-group">
                        <label for="email">Email:</label>
                        <input type="email" id="email" name="email" required>
                    </div>
                    <div class="form-group">
                        <label for="password">Пароль:</label>
                        <input type="password" id="password" name="password" required>
                    </div>
                    <button type="submit">Войти</button>
                </form>
                <div id="login-result"></div>
            </div>
        `;
        
        document.getElementById('login-form').addEventListener('submit', handleLogin);
    });
    
    router.addRoute('/register', () => {
        contentElement.innerHTML = `
            <div class="container">
                <h1>Регистрация</h1>
                <form id="register-form">
                    <div class="form-group">
                        <label for="email">Email:</label>
                        <input type="email" id="email" name="email" required>
                    </div>
                    <div class="form-group">
                        <label for="password">Пароль:</label>
                        <input type="password" id="password" name="password" required>
                    </div>
                    <button type="submit">Зарегистрироваться</button>
                </form>
                <div id="register-result"></div>
            </div>
        `;
        
        document.getElementById('register-form').addEventListener('submit', handleRegister);
    });
    
    router.addRoute('/profile', () => {
        const token = getAuthToken();
        if (!token) {
            router.navigate('/login');
            return;
        }
        
        contentElement.innerHTML = `
            <div class="container">
                <h1>Профиль пользователя</h1>
                <div id="profile-content">Загрузка...</div>
                <button onclick="logout()">Выйти</button>
            </div>
        `;
        
        loadProfile();
    });
    
    // Проверяем статус авторизации при загрузке
    updateAuthState();
});

// Обработчики форм
async function handleLogin(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData);
    
    try {
        const result = await ApiClient.post('/api/login', data);
        setAuthToken(result.token);
        updateAuthState();
        document.getElementById('login-result').innerHTML = 
            '<div class="success">Вход выполнен успешно!</div>';
        setTimeout(() => window.router.navigate('/profile'), 1000);
    } catch (error) {
        document.getElementById('login-result').innerHTML = 
            `<div class="error">Ошибка: ${error.message}</div>`;
    }
}

async function handleRegister(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData);
    
    try {
        await ApiClient.post('/api/register', data);
        document.getElementById('register-result').innerHTML = 
            '<div class="success">Регистрация успешна! Теперь можете войти.</div>';
        setTimeout(() => window.router.navigate('/login'), 1000);
    } catch (error) {
        document.getElementById('register-result').innerHTML = 
            `<div class="error">Ошибка: ${error.message}</div>`;
    }
}

async function loadProfile() {
    try {
        const result = await ApiClient.get('/api/profile');
        document.getElementById('profile-content').innerHTML = `
            <p><strong>Email:</strong> ${result.user.email}</p>
            <p><strong>ID:</strong> ${result.user.id}</p>
        `;
    } catch (error) {
        document.getElementById('profile-content').innerHTML = 
            `<div class="error">Ошибка загрузки профиля: ${error.message}</div>`;
    }
}

function logout() {
    setAuthToken(null);
    updateAuthState();
    window.router.navigate('/');
}

function updateAuthState() {
    const token = getAuthToken();
    const authSection = document.getElementById('auth-section');
    
    if (token) {
        authSection.innerHTML = '<button onclick="logout()">Выйти</button>';
    } else {
        authSection.innerHTML = `
            <a href="/login" data-route="/login">Вход</a>
            <a href="/register" data-route="/register">Регистрация</a>
        `;
    }
}

// Тест API
async function testHealthCheck() {
    try {
        const result = await ApiClient.get('/api/health');
        document.getElementById('api-result').innerHTML = 
            `<div class="success">API работает! Статус: ${result.status}</div>`;
    } catch (error) {
        document.getElementById('api-result').innerHTML = 
            `<div class="error">Ошибка API: ${error.message}</div>`;
    }
}
