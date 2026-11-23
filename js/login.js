(function () {
  function $(id) { return document.getElementById(id); }
  function isStaticSite() {
    return window.location.protocol === 'file:' ||
      window.location.hostname.endsWith('github.io') ||
      window.location.hostname.endsWith('web.app') ||
      window.location.hostname.endsWith('firebaseapp.com');
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
  var firebaseAuth = null;
  if (window.firebase) {
    var firebaseConfig = {
      apiKey: 'AIzaSyD6j5Ro3JmYmhzpYJYfe-VMQgZ6ALSllsw',
      authDomain: 'amazing-clothes.firebaseapp.com',
      projectId: 'amazing-clothes',
      storageBucket: 'amazing-clothes.firebasestorage.app',
      messagingSenderId: '820217241764',
      appId: '1:820217241764:web:4020fc34bc4a5f03110631'
    };
    if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
    firebaseAuth = firebase.auth();
  }

  $('loginForm').addEventListener('submit', async function (event) {
    event.preventDefault();
    var username = $('loginUsername').value.trim();
    var password = $('loginPassword').value;
    if (isStaticSite()) {
      if (firebaseAuth) {
        try {
          var email = username.indexOf('@') >= 0 ? username : username + '@clothes.local';
          await firebaseAuth.signInWithEmailAndPassword(email, password);
          sessionStorage.setItem('clothes-admin-session-v1', 'authenticated');
          window.location.href = 'index.html';
          return;
        } catch (error) {
          $('loginError').textContent = 'بيانات الدخول غير صحيحة';
          return;
        }
      }
      $('loginError').textContent = 'تعذر الاتصال بمصادقة Firebase';
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
