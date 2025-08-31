(() => {
  const cfg = Object.assign({
    apiPathPrefixes: ['/api/'],
    apiOrigins: (window.__API_PROXY_ORIGINS || []),
    csrfHeader: 'X-CSRF-Token'
  }, window.__FETCH_PROXY_CONFIG || {});
  const sameOrigin = location.origin;
  const isApiPath = (url) => { try { const u = new URL(url, sameOrigin); return cfg.apiPathPrefixes.some(p => u.pathname.startsWith(p)); } catch { return false; } };
  const isApiOrigin = (url) => { try { const u = new URL(url, sameOrigin); return cfg.apiOrigins.some(o => { try { return new URL(o).origin === u.origin; } catch { return false; } }); } catch { return false; } };
  const rewriteToSameOrigin = (url) => { const u = new URL(url, sameOrigin); return sameOrigin + u.pathname + u.search + u.hash; };
  const _fetch = window.fetch;
  window.fetch = async function(input, init = {}) {
    const urlStr = (typeof input === 'string') ? input : (input && input.url) || '';
    const shouldProxy = isApiPath(urlStr) || isApiOrigin(urlStr);
    if (!shouldProxy) return _fetch(input, init);
    const newUrl = isApiPath(urlStr) ? new URL(urlStr, sameOrigin).toString() : rewriteToSameOrigin(urlStr);
    const headers = new Headers(init && init.headers || (typeof input !== 'string' && input && input.headers) || {});
    if (!headers.has(cfg.csrfHeader)) {
      const meta = document.querySelector('meta[name=\"csrf-token\"]');
      if (meta && meta.content) headers.set(cfg.csrfHeader, meta.content);
      const cookie = document.cookie.split('; ').find(x=>x.startsWith('CSRF-TOKEN='));
      if (!headers.has(cfg.csrfHeader) && cookie) headers.set(cfg.csrfHeader, decodeURIComponent(cookie.split('=')[1]));
    }
    const newInit = Object.assign({}, init, { credentials: 'include', headers });
    return _fetch(newUrl, newInit);
  };
  const _XHR = window.XMLHttpRequest;
  function ProxyXHR() {
    const xhr = new _XHR();
    const open = xhr.open;
    xhr.open = function(method, url, async=true, user, password) {
      let finalUrl = url;
      if (isApiPath(url)) finalUrl = new URL(url, sameOrigin).toString();
      else if (isApiOrigin(url)) finalUrl = rewriteToSameOrigin(url);
      return open.call(xhr, method, finalUrl, async, user, password);
    };
    const send = xhr.send;
    xhr.send = function(body) {
      try {
        const meta = document.querySelector('meta[name=\"csrf-token\"]');
        const cookie = document.cookie.split('; ').find(x=>x.startsWith('CSRF-TOKEN='));
        if (meta && meta.content) xhr.setRequestHeader(cfg.csrfHeader, meta.content);
        else if (cookie) xhr.setRequestHeader(cfg.csrfHeader, decodeURIComponent(cookie.split('=')[1]));
      } catch {}
      return send.call(xhr, body);
    };
    return xhr;
  }
  window.XMLHttpRequest = ProxyXHR;
})();
// Сохраняем оригинальный fetch
const originalFetch = window.fetch;

// Переопределяем fetch для проксирования API запросов
window.fetch = function(url, options = {}) {
    // Проверяем, является ли URL относительным API запросом
    if (typeof url === 'string' && url.startsWith('/api/')) {
        // Используем текущий хост для API запросов
        const apiUrl = window.location.origin + url;
        
        // Добавляем CSRF токен если его нет
        if (!options.headers) {
            options.headers = {};
        }
        
        // Получаем CSRF токен из meta тега или cookie
        const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ||
                         getCookie('CSRF-TOKEN');
        
        if (csrfToken && (options.method === 'POST' || options.method === 'PUT' || options.method === 'DELETE')) {
            options.headers['X-CSRF-Token'] = csrfToken;
        }
        
        // Добавляем Content-Type для JSON запросов
        if (options.body && typeof options.body === 'string') {
            options.headers['Content-Type'] = 'application/json';
        }
        
        console.log('API Request:', apiUrl, options);
        return originalFetch(apiUrl, options);
    }
    
    // Для всех остальных запросов используем оригинальный fetch
    return originalFetch(url, options);
};

// Вспомогательная функция для получения cookie
function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
}

// Функция для установки токена авторизации
window.setAuthToken = function(token) {
    if (token) {
        localStorage.setItem('authToken', token);
    } else {
        localStorage.removeItem('authToken');
    }
};

// Функция для получения токена авторизации
window.getAuthToken = function() {
    return localStorage.getItem('authToken');
};

// Автоматически добавляем Authorization header для API запросов
const originalFetchWithAuth = window.fetch;
window.fetch = function(url, options = {}) {
    if (typeof url === 'string' && url.startsWith('/api/')) {
        const token = getAuthToken();
        if (token) {
            if (!options.headers) {
                options.headers = {};
            }
            options.headers['Authorization'] = `Bearer ${token}`;
        }
    }
    
    return originalFetchWithAuth(url, options);
};
