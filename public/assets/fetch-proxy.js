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
    
    // Add Authorization header if auth token exists
    const authToken = localStorage.getItem('authToken');
    if (authToken && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${authToken}`);
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
        
        // Add Authorization header if auth token exists
        const authToken = localStorage.getItem('authToken');
        if (authToken) xhr.setRequestHeader('Authorization', `Bearer ${authToken}`);
      } catch {}
      return send.call(xhr, body);
    };
    return xhr;
  }
  window.XMLHttpRequest = ProxyXHR;
  
  // Utility functions for auth token management
  window.setAuthToken = function(token) {
    if (token) {
      localStorage.setItem('authToken', token);
    } else {
      localStorage.removeItem('authToken');
    }
  };

  window.getAuthToken = function() {
    return localStorage.getItem('authToken');
  };
})();
