(function () {
  function $(id) { return document.getElementById(id); }
  function isStaticSite() {
    return window.location.protocol === 'file:' ||
      window.location.hostname.endsWith('github.io');
  }
  function apiUrl(path) {
    if (window.location.protocol === 'file:' || window.location.hostname === '') {
      return 'http://127.0.0.1:4173' + path;
    }
    if (window.location.port && window.location.port !== '4173') {
      return 'http://127.0.0.1:4173' + path;
    }
    return path;
  }

  $('loginForm').addEventListener('submit', async function (event) {
    event.preventDefault();
    var username = $('loginUsername').value.trim();
    var password = $('loginPassword').value;
    if (isStaticSite()) {
      if (username === 'admin' && password === 'admin123') {
        sessionStorage.setItem('clothes-admin-session-v1', 'authenticated');
        window.location.href = 'index.html';
      } else {
        $('loginError').textContent = 'بيانات الدخول غير صحيحة';
      }
      return;
    }
    try {
      var response = await fetch(apiUrl('/api/login'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username, password: password })
      });
      var result = await response.json();
      if (!response.ok) throw new Error(result.error || 'بيانات الدخول غير صحيحة');
      window.location.href = 'index.html';
    } catch (error) {
      $('loginError').textContent = error.message;
    }
  });
})();
