(function () {
  var STORAGE_KEY = 'clothes-materials-v1';
  var SESSION_KEY = 'clothes-admin-session-v1';
  var defaultMaterials = [
    { id: 1, name: 'كوريشه', price: 0, stock: 0, image: 'images/koreesha.svg' },
    { id: 2, name: 'اسكوبا كريب', price: 0, stock: 0, image: 'images/escoba-crepe.svg' },
    { id: 3, name: 'هشيره كلوز ماش', price: 0, stock: 0, image: 'images/hashira-cloth-mash.svg' },
    { id: 4, name: 'سنجل شعيرات', price: 0, stock: 0, image: 'images/single-shairat.svg' },
    { id: 5, name: 'سنجل ليكرا', price: 0, stock: 0, image: 'images/single-lycra.svg' },
    { id: 6, name: 'ليجن غطس', price: 0, stock: 0, image: 'images/legging-ghats.svg' },
    { id: 7, name: 'بسكوته', price: 0, stock: 0, image: 'images/biscotta.svg' },
    { id: 8, name: 'كاردونيه', price: 0, stock: 0, image: 'images/cardona.svg' },
    { id: 9, name: 'ماجيك', price: 0, stock: 0, image: 'images/magic.svg' },
    { id: 10, name: 'مارسيليا', price: 0, stock: 0, image: 'images/marseille.svg' }
  ];

  var materials = defaultMaterials.map(function (item) { return Object.assign({}, item); });
  var nextId = materials.reduce(function (max, item) { return Math.max(max, item.id); }, 0) + 1;
  var mode = 'client';
  var tab = 'orders';
  var search = '';
  var cart = {};
  var detailId = null;
  var detailQty = 1;
  var sheetKind = null;
  var toastTimer;
  var nf = new Intl.NumberFormat('ar-EG');
  var firebaseDb = null;
  var firebaseAuth = null;
  var firebaseReady = false;

  if (window.firebase) {
    var firebaseConfig = {
      apiKey: 'AIzaSyDQks1xvFxzmRvKlnv4aYxBgF3Bqn9o0Nk',
      authDomain: 'clothes-d1754.firebaseapp.com',
      projectId: 'clothes-d1754',
      storageBucket: 'clothes-d1754.firebasestorage.app',
      messagingSenderId: '459177272979',
      appId: '1:459177272979:web:406bb6d5cbf037b7484f66'
    };
    if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
    firebaseDb = firebase.firestore();
    firebaseAuth = firebase.auth();
    firebaseReady = true;
  }

  function $(id) { return document.getElementById(id); }
  function apiUrl(path) {
    if (window.location.protocol === 'file:' || window.location.hostname === '') {
      return 'http://127.0.0.1:4173' + path;
    }
    if (window.location.port && window.location.port !== '4173') {
      return 'http://127.0.0.1:4173' + path;
    }
    return path;
  }
  function isStaticSite() {
    return window.location.protocol === 'file:' ||
      window.location.hostname === 'localhost' && window.location.port !== '4173' ||
      window.location.hostname.endsWith('github.io') ||
      window.location.hostname.endsWith('web.app') ||
      window.location.hostname.endsWith('firebaseapp.com');
  }
  function isAdminAuthenticated() {
    return isStaticSite()
      ? sessionStorage.getItem(SESSION_KEY) === 'authenticated'
      : null;
  }
  function fmt(value) { return nf.format(Math.round(value)); }
  function egp(value) { return fmt(value) + ' ج.م'; }
  function esc(value) {
    return String(value).replace(/[&<>"']/g, function (char) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char];
    });
  }
  async function loadMaterials() {
    if (firebaseReady) {
      firebaseDb.collection('materials').orderBy('id').onSnapshot(function (snapshot) {
        var shared = [];
        snapshot.forEach(function (document) {
          var item = document.data();
          item.id = Number(item.id || document.id);
          shared.push(item);
        });
        shared.sort(function (a, b) { return Number(a.id) - Number(b.id); });
        if (shared.length) {
          materials = shared;
          nextId = materials.reduce(function (max, item) { return Math.max(max, Number(item.id)); }, 0) + 1;
          renderGrid();
          renderStock();
        }
      }, function (error) {
        toast('تعذر تحميل الخامات من Firebase');
      });
      return;
    }
    if (isStaticSite()) {
      try {
        var saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
        if (Array.isArray(saved) && saved.length) {
          materials = saved;
          nextId = materials.reduce(function (max, item) { return Math.max(max, item.id); }, 0) + 1;
          renderGrid();
          renderStock();
        }
      } catch (error) {
        toast('تعذر تحميل الخامات المحفوظة');
      }
      return;
    }
    try {
      var response = await fetch(apiUrl('/api/materials'), { cache: 'no-store', credentials: 'include' });
      if (!response.ok) throw new Error('Load failed');
      var saved = await response.json();
      if (Array.isArray(saved) && saved.length) {
        materials = saved;
        nextId = materials.reduce(function (max, item) { return Math.max(max, item.id); }, 0) + 1;
        renderGrid();
        renderStock();
      }
    } catch (error) {
      toast('تعذر تحميل الخامات المشتركة');
    }
  }
  async function saveMaterials() {
    if (firebaseReady) {
      try {
        var batch = firebaseDb.batch();
        var collection = firebaseDb.collection('materials');
        var snapshot = await collection.get();
        var liveIds = {};
        materials.forEach(function (item) {
          var id = String(item.id);
          liveIds[id] = true;
          batch.set(collection.doc(id), Object.assign({}, item, { id: Number(item.id) }));
        });
        snapshot.forEach(function (document) {
          if (!liveIds[document.id]) batch.delete(document.ref);
        });
        await batch.commit();
        localStorage.setItem(STORAGE_KEY, JSON.stringify(materials));
      } catch (error) {
        toast('تعذر حفظ التعديل في Firebase');
      }
      return;
    }
    if (isStaticSite()) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(materials));
      return;
    }
    try {
      var response = await fetch(apiUrl('/api/materials'), {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(materials)
      });
      if (!response.ok) throw new Error('Save failed');
    } catch (error) {
      toast('تعذر حفظ التعديل على السيرفر');
    }
  }
  function byId(id) {
    return materials.find(function (item) { return item.id === id; });
  }
  function materialImage(item) {
    return item.image
      ? '<img class="material-photo" src="' + esc(item.image) + '" alt="">'
      : '<div class="sw material-placeholder" aria-hidden="true"></div>';
  }
  function renderChips() {
    $('chips').innerHTML = '<button type="button" class="chip" aria-pressed="true">كل الخامات</button>';
  }
  function stockBadge(item) {
    if (item.stock <= 0) return '<span class="pill bad">نفد</span>';
    if (item.stock <= 20) return '<span class="pill warn">آخر ' + fmt(item.stock) + ' م</span>';
    return '<span class="pill good">متاح</span>';
  }
  function renderGrid() {
    var list = materials.filter(function (item) {
      return !search || item.name.indexOf(search) >= 0;
    });
    $('grid').innerHTML = list.length ? list.map(function (item) {
      return '<button type="button" class="card" data-act="open" data-id="' + item.id + '"' + (item.stock <= 0 ? ' disabled' : '') + '>' +
        materialImage(item) +
        '<div class="cb"><h3>' + esc(item.name) + '</h3>' +
        '<div class="row"><b class="price">' + egp(item.price) + '<small>/متر</small></b>' + stockBadge(item) + '</div></div></button>';
    }).join('') : '<p class="empty">مفيش خامة بالاسم ده.</p>';
  }
  function cartTotal() {
    var total = 0;
    var count = 0;
    Object.keys(cart).forEach(function (id) {
      var item = byId(+id);
      if (item) { total += item.price * cart[id]; count++; }
    });
    return { total: total, count: count };
  }
  function renderCartbar() {
    var totals = cartTotal();
    $('cartbar').hidden = mode !== 'client' || totals.count === 0;
    $('cartCount').textContent = fmt(totals.count) + ' صنف في الطلب';
    $('cartTotal').textContent = egp(totals.total);
  }
  function openSheet(kind) {
    sheetKind = kind;
    $('scrim').hidden = false;
    document.body.classList.add('locked');
    $('sheet').focus();
  }
  function closeSheet() {
    sheetKind = null;
    $('scrim').hidden = true;
    document.body.classList.remove('locked');
  }
  function openDetail(id) {
    var item = byId(id);
    if (!item || item.stock <= 0) return;
    detailId = id;
    detailQty = Math.min(cart[id] || 1, item.stock);
    renderDetail();
    openSheet('detail');
  }
  function renderDetail() {
    var item = byId(detailId);
    $('sheet').innerHTML =
      '<div class="handle"></div>' +
      (item.image ? '<img class="sheet-photo" src="' + esc(item.image) + '" alt="' + esc(item.name) + '">' : '<div class="sw tall material-placeholder"></div>') +
      '<div><h2>' + esc(item.name) + '</h2><p class="sub">السعر للمتر</p></div>' +
      '<dl class="specs"><div><dt>السعر</dt><dd>' + egp(item.price) + '</dd></div>' +
      '<div><dt>المتاح</dt><dd>' + fmt(item.stock) + ' متر</dd></div></dl>' +
      '<div class="qty"><button type="button" data-act="qminus" aria-label="أقل">−</button>' +
      '<input id="qtyInput" type="number" inputmode="numeric" dir="ltr" min="1" max="' + item.stock + '" value="' + detailQty + '">' +
      '<button type="button" data-act="qplus" aria-label="أكتر">+</button><span class="sub">متر</span></div>' +
      '<div class="sumbox"><div><span>الإجمالي</span><b id="dTotal"></b></div></div>' +
      '<button type="button" class="btn block" data-act="add">أضف للطلب</button>';
    updateDetailTotal();
  }
  function clampQty(value) {
    var item = byId(detailId);
    value = Math.floor(+value || 1);
    return Math.max(1, Math.min(item.stock, value));
  }
  function updateDetailTotal() {
    var item = byId(detailId);
    $('dTotal').textContent = egp(item.price * detailQty);
  }
  function renderCheckout() {
    var ids = Object.keys(cart);
    if (!ids.length) { closeSheet(); return; }
    var totals = cartTotal();
    $('sheet').innerHTML =
      '<div class="handle"></div><h2>مراجعة الطلب</h2>' +
      '<ul class="lines">' + ids.map(function (id) {
        var item = byId(+id);
        return '<li><div><b>' + esc(item.name) + '</b><div class="sub">' + fmt(cart[id]) + ' متر × ' + egp(item.price) + '</div></div>' +
          '<div style="text-align:end"><b>' + egp(item.price * cart[id]) + '</b><br><button type="button" class="x" data-act="rm" data-id="' + id + '">شيل</button></div></li>';
      }).join('') + '</ul>' +
      '<div class="sumbox"><div><span>الإجمالي</span><b>' + egp(totals.total) + '</b></div></div>' +
      '<button type="button" class="btn block" data-act="place">أكد الطلب</button>';
  }
  function renderStock() {
    $('stockList').innerHTML = materials.map(function (item) {
      return '<article class="srow">' +
        '<div class="top2">' +
        (item.image ? '<img class="sw sm" src="' + esc(item.image) + '" alt="' + esc(item.name) + '">' : '<div class="sw sm material-placeholder"></div>') +
        '<div><b>' + esc(item.name) + '</b><span class="sub">القائمة الرئيسية</span></div></div>' +
        '<div class="fields">' +
        '<label>السعر للمتر<input type="number" inputmode="decimal" min="0" data-f="price" data-id="' + item.id + '" value="' + item.price + '"></label>' +
        '<label>المتاح بالمتر<input type="number" inputmode="numeric" min="0" data-f="stock" data-id="' + item.id + '" value="' + item.stock + '"></label>' +
        '<label>رابط الصورة<input type="url" inputmode="url" dir="ltr" data-image-id="' + item.id + '" value="' + esc(item.image || '') + '" placeholder="https://example.com/image.jpg"></label>' +
        '</div><button type="button" class="btn ghost delete-btn" data-act="delete" data-id="' + item.id + '">حذف الخامة</button>' +
        '</article>';
    }).join('');
  }
  function toast(message) {
    $('toastText').textContent = message;
    $('toast').hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { $('toast').hidden = true; }, 3200);
  }
  function setMode(value) {
    if (value === 'admin') {
      if (!(firebaseAuth && firebaseAuth.currentUser) && isStaticSite()) {
        if (!isAdminAuthenticated()) {
          window.location.href = 'login.html';
          return;
        }
      } else if (!firebaseAuth && !isStaticSite()) {
        fetch(apiUrl('/api/session'), { cache: 'no-store', credentials: 'include' })
          .then(function (response) { return response.json(); })
          .then(function (session) {
            if (!session.authenticated) window.location.href = 'login.html';
          });
      }
    }
    mode = value;
    document.querySelectorAll('[data-act="mode"]').forEach(function (button) {
      button.setAttribute('aria-pressed', String(button.dataset.mode === value));
    });
    $('clientView').hidden = value !== 'client';
    $('adminView').hidden = value !== 'admin';
    closeSheet();
    renderGrid();
    renderCartbar();
  }
  function setTab(value) {
    tab = value;
    document.querySelectorAll('[data-act="tab"]').forEach(function (button) {
      button.setAttribute('aria-pressed', String(button.dataset.tab === value));
    });
    $('ordersPanel').hidden = value !== 'orders';
    $('stockPanel').hidden = value !== 'stock';
  }

  document.addEventListener('click', function (event) {
    if (event.target === $('scrim')) { closeSheet(); return; }
    var element = event.target.closest('[data-act]');
    if (!element) return;
    var act = element.dataset.act;
    if (act === 'mode') setMode(element.dataset.mode);
    else if (act === 'tab') setTab(element.dataset.tab);
    else if (act === 'open') openDetail(+element.dataset.id);
    else if (act === 'qminus' || act === 'qplus') {
      detailQty = clampQty(detailQty + (act === 'qplus' ? 1 : -1));
      $('qtyInput').value = detailQty;
      updateDetailTotal();
    } else if (act === 'add') {
      detailQty = clampQty($('qtyInput').value);
      cart[detailId] = detailQty;
      closeSheet();
      renderCartbar();
      toast('اتضاف للطلب: ' + fmt(detailQty) + ' متر');
    } else if (act === 'checkout') {
      renderCheckout();
      openSheet('checkout');
    } else if (act === 'rm') {
      delete cart[element.dataset.id];
      renderCartbar();
      renderCheckout();
    } else if (act === 'place') {
      Object.keys(cart).forEach(function (id) {
        var item = byId(+id);
        item.stock = Math.max(0, item.stock - cart[id]);
      });
      saveMaterials();
      cart = {};
      closeSheet();
      renderGrid();
      renderStock();
      renderCartbar();
      toast('تم تأكيد الطلب بنجاح');
    } else if (act === 'delete') {
      var item = byId(+element.dataset.id);
      if (item && confirm('هل تريد حذف ' + item.name + '؟')) {
        materials = materials.filter(function (entry) { return entry.id !== item.id; });
        saveMaterials();
        renderGrid();
        renderStock();
        toast('تم حذف الخامة');
      }
    }
  });
  document.addEventListener('input', function (event) {
    if (event.target.id === 'search') {
      search = event.target.value.trim();
      renderGrid();
    } else if (event.target.id === 'qtyInput') {
      detailQty = clampQty(event.target.value);
      updateDetailTotal();
    }
  });
  document.addEventListener('change', function (event) {
    var target = event.target;
    if (target.dataset && target.dataset.f) {
      var item = byId(+target.dataset.id);
      item[target.dataset.f] = Math.max(0, +target.value || 0);
      target.value = item[target.dataset.f];
      saveMaterials();
      renderGrid();
    } else if (target.dataset && target.dataset.imageId) {
      var imageItem = byId(+target.dataset.imageId);
      var imageUrl = target.value.trim();
      if (imageUrl && !/^https?:\/\//i.test(imageUrl)) {
        toast('أدخل رابطًا يبدأ بـ https://');
        return;
      }
      imageItem.image = imageUrl;
      saveMaterials();
      renderGrid();
      renderStock();
      toast(imageUrl ? 'تم تحديث رابط الصورة' : 'تمت إزالة الصورة');
    }
  });
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && sheetKind) closeSheet();
  });
  $('addForm').addEventListener('submit', function (event) {
    event.preventDefault();
    var name = $('nf-name').value.trim();
    var price = +$('nf-price').value;
    var stock = +$('nf-stock').value;
    if (!name || !(price >= 0) || !(stock >= 0)) {
      toast('اكتب الاسم والسعر والكمية');
      return;
    }
    var imageUrl = $('nf-image').value.trim();
    if (imageUrl && !/^https?:\/\//i.test(imageUrl)) {
      toast('أدخل رابطًا يبدأ بـ https://');
      return;
    }
    var addItem = function (image) {
      materials.push({ id: nextId++, name: name, price: price, stock: stock, image: image || '' });
      saveMaterials();
      event.target.reset();
      renderGrid();
      renderStock();
      renderChips();
      toast('تمت إضافة الخامة');
    };
    addItem(imageUrl);
  });

  $('logoutBtn').addEventListener('click', function () {
    if (isStaticSite()) {
      sessionStorage.removeItem(SESSION_KEY);
      if (firebaseAuth) firebaseAuth.signOut();
      window.location.href = 'index.html';
      return;
    }
    fetch(apiUrl('/api/logout'), { method: 'POST', credentials: 'include' }).finally(function () {
      window.location.href = 'index.html';
    });
  });

  setTab('orders');
  renderChips();
  renderGrid();
  renderCartbar();
  renderStock();
  if (firebaseAuth) {
    firebaseAuth.onAuthStateChanged(function (user) {
      var authenticated = !!user;
      $('adminControls').hidden = !authenticated;
      if (authenticated) {
        sessionStorage.setItem(SESSION_KEY, 'authenticated');
        setMode('admin');
        setTab('stock');
      } else {
        sessionStorage.removeItem(SESSION_KEY);
        setMode('client');
      }
    });
  } else if (isStaticSite()) {
    var authenticated = isAdminAuthenticated();
    $('adminControls').hidden = !authenticated;
    if (authenticated) {
      setMode('admin');
      setTab('stock');
    } else {
      setMode('client');
    }
  } else {
    fetch(apiUrl('/api/session'), { cache: 'no-store', credentials: 'include' })
      .then(function (response) { return response.json(); })
      .then(function (session) {
        $('adminControls').hidden = !session.authenticated;
        if (session.authenticated) {
          setMode('admin');
          setTab('stock');
        } else {
          setMode('client');
        }
      })
      .catch(function () {
        $('adminControls').hidden = true;
        setMode('client');
      });
  }
  loadMaterials();
  setInterval(loadMaterials, 10000);
})();
