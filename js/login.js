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
      apiKey: 'AIzaSyAuX7hqzsakZPea5-rEPc41mTN-HAaY3RM',
      authDomain: 'clothes-434d8.firebaseapp.com',
      projectId: 'clothes-434d8',
      storageBucket: 'clothes-434d8.firebasestorage.app',
      messagingSenderId: '644317359025',
      appId: '1:644317359025:web:bc9d22ac9bca32eb8beb90'
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
