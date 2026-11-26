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
  var stockSearch = '';
  var stockEdits = {};
  var orderNameFilter = '';
  var orderStatusFilter = 'all';
  var cart = {};
  var orders = [];
  var detailId = null;
  var detailQty = 1;
  var sheetKind = null;
  var checkoutPaymentMethod = 'deposit';
  var toastTimer;
  var nf = new Intl.NumberFormat('ar-EG');
  var firebaseDb = null;
  var firebaseAuth = null;
  var firebaseReady = false;
  var paymentSettings = {
    paymentNumber: '01114205243',
    accountName: '',
    depositPercent: 10
  };

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
  function compressImage(file) {
    return new Promise(function (resolve, reject) {
      var sourceReader = new FileReader();
      sourceReader.onerror = function () { reject(new Error('Could not read image')); };
      sourceReader.onload = function () {
        var image = new Image();
        image.onerror = function () { reject(new Error('Invalid image')); };
        image.onload = function () {
          var scale = Math.min(1, 1280 / Math.max(image.naturalWidth, image.naturalHeight));
          var canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
          canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
          canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
          var quality = 0.82;
          function encode() {
            canvas.toBlob(function (blob) {
              if (!blob) {
                reject(new Error('Could not compress image'));
                return;
              }
              if (blob.size > 600 * 1024 && quality > 0.52) {
                quality -= 0.1;
                encode();
                return;
              }
              if (blob.size > 600 * 1024) {
                reject(new Error('Compressed image is too large'));
                return;
              }
              var resultReader = new FileReader();
              resultReader.onerror = function () { reject(new Error('Could not encode image')); };
              resultReader.onload = function () { resolve(resultReader.result); };
              resultReader.readAsDataURL(blob);
            }, 'image/jpeg', quality);
          }
          encode();
        };
        image.src = sourceReader.result;
      };
      sourceReader.readAsDataURL(file);
    });
  }
  function esc(value) {
    return String(value).replace(/[&<>"']/g, function (char) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char];
    });
  }
  function normalizeMaterialName(value) {
    return String(value || '')
      .trim()
      .replace(/[\u064B-\u065F\u0670]/g, '')
      .replace(/[\u0622\u0623\u0625]/g, '\u0627')
      .replace(/\u0629/g, '\u0647')
      .replace(/\u0649/g, '\u064A')
      .replace(/\u0640/g, '')
      .replace(/\s+/g, ' ')
      .toLocaleLowerCase();
  }
  function findMaterialByName(name) {
    var normalizedName = normalizeMaterialName(name);
    if (!normalizedName) return null;
    return materials.find(function (item) {
      return normalizeMaterialName(item.name) === normalizedName;
    }) || null;
  }
  function updateMaterialNameCheck() {
    var input = $('nf-name');
    var status = $('nf-name-status');
    var datalist = $('materialNameSuggestions');
    if (!input || !status || !datalist) return;
    var query = normalizeMaterialName(input.value);
    var exact = findMaterialByName(input.value);
    datalist.innerHTML = materials
      .filter(function (item) {
        return !query || normalizeMaterialName(item.name).indexOf(query) >= 0;
      })
      .map(function (item) { return '<option value="' + esc(item.name) + '"></option>'; })
      .join('');
    if (exact) {
      status.textContent = 'هذه الخامة موجودة بالفعل';
      status.className = 'name-status duplicate';
      input.setAttribute('aria-invalid', 'true');
    } else if (query) {
      status.textContent = 'اسم متاح للإضافة';
      status.className = 'name-status available';
      input.setAttribute('aria-invalid', 'false');
    } else {
      status.textContent = '';
      status.className = 'name-status';
      input.removeAttribute('aria-invalid');
    }
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
          updateMaterialNameCheck();
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
          updateMaterialNameCheck();
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
        var existingMaterials = {};
        var hasChanges = false;
        snapshot.forEach(function (document) {
          existingMaterials[document.id] = document.data();
        });
        materials.forEach(function (item) {
          var id = String(item.id);
          var data = Object.assign({}, item, { id: Number(item.id) });
          var existing = existingMaterials[id];
          liveIds[id] = true;
          if (!existing || existing.id !== data.id || existing.name !== data.name || existing.price !== data.price ||
              existing.stock !== data.stock || existing.image !== data.image) {
            batch.set(collection.doc(id), data);
            hasChanges = true;
          }
        });
        snapshot.forEach(function (document) {
          if (!liveIds[document.id]) {
            batch.delete(document.ref);
            hasChanges = true;
          }
        });
        if (hasChanges) await batch.commit();
        return true;
      } catch (error) {
        console.error('Failed to save materials to Firebase', error);
        toast('تعذر حفظ التعديل في Firebase');
        return false;
      }
    }
    if (isStaticSite()) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(materials));
      return true;
    }
    try {
      var response = await fetch(apiUrl('/api/materials'), {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(materials)
      });
      if (!response.ok) throw new Error('Save failed');
      return true;
    } catch (error) {
      console.error('Failed to save materials to server', error);
      toast('تعذر حفظ التعديل على السيرفر');
      return false;
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
    var normalizedSearch = normalizeMaterialName(search);
    var list = materials.filter(function (item) {
      return !normalizedSearch || normalizeMaterialName(item.name).indexOf(normalizedSearch) >= 0;
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
      '<form id="orderForm" class="order-form">' +
      '<div class="order-form-head"><h3>بيانات التأكيد</h3><span>بياناتك المطلوبة لإتمام الطلب</span></div>' +
      '<label><span>اسم العميل</span><input id="orderName" type="text" autocomplete="name" required minlength="2" placeholder="اكتب اسمك بالكامل"></label>' +
      '<label><span>رقم الهاتف</span><input id="orderPhone" type="tel" inputmode="tel" dir="ltr" autocomplete="tel" required minlength="6" maxlength="20" placeholder="01xxxxxxxxx"></label>' +
      '<label><span>البريد الإلكتروني</span><input id="orderEmail" type="email" autocomplete="email" required placeholder="name@example.com"></label>' +
      '<label><span>طريقة الدفع</span><select id="paymentMethod" required>' +
      '<option value="deposit"' + (checkoutPaymentMethod === 'deposit' ? ' selected' : '') + '>دفع عربون</option>' +
      '<option value="cash_on_delivery"' + (checkoutPaymentMethod === 'cash_on_delivery' ? ' selected' : '') + '>الدفع عند الاستلام</option>' +
      '</select></label>' +
      '<div id="paymentDetails"></div>' +
      '<button type="submit" class="btn block">تأكيد وإرسال الطلب</button>' +
      '</form>';
    renderPaymentDetails();
  }
  function renderPaymentDetails() {
    var paymentDetails = $('paymentDetails');
    if (!paymentDetails) return;
    var totals = cartTotal();
    if (checkoutPaymentMethod === 'cash_on_delivery') {
      paymentDetails.innerHTML =
        '<section class="deposit-box"><h3>الدفع عند الاستلام</h3>' +
        '<div class="deposit-account"><span>المبلغ كاملًا عند الاستلام</span><b>' + egp(totals.total) + '</b></div>' +
        '</section>';
      return;
    }
    var deposit = Math.ceil(totals.total * paymentSettings.depositPercent / 100);
    paymentDetails.innerHTML =
      '<section class="deposit-box"><h3>حوّل العربون</h3>' +
      '<p>حوّل ' + fmt(paymentSettings.depositPercent) + '% من إجمالي الطلب ( ' + egp(deposit) + ' ) عن طريق إنستاباي أو فودافون كاش.</p>' +
      '<div class="deposit-account"><span>الباقي عند الاستلام (بعد خصم العربون)</span><b>' + egp(Math.max(0, totals.total - deposit)) + '</b></div>' +
      '<div class="deposit-account"><span>رقم التحويل</span><b dir="ltr">' + esc(paymentSettings.paymentNumber || '') + '</b></div>' +
      (paymentSettings.accountName ? '<div class="deposit-account"><span>اسم صاحب الحساب</span><b>' + esc(paymentSettings.accountName) + '</b></div>' : '') +
      '</section>' +
      '<label><span>طريقة تحويل العربون</span><select id="paymentChannel" required>' +
      '<option value="InstaPay">إنستاباي</option><option value="Vodafone Cash">فودافون كاش</option>' +
      '</select></label>' +
      '<label class="proof-upload"><span>إرفاق صورة إيصال التحويل</span><input id="paymentProof" type="file" accept="image/jpeg,image/png,image/webp" required><small>صورة JPG أو PNG أو WEBP، بحد أقصى 5 ميجابايت.</small></label>';
  }
  function renderOrders() {
    var statusNames = {
      new: 'جديد',
      in_progress: 'قيد التنفيذ',
      rejected: 'مرفوض',
      completed: 'مكتمل'
    };
    var filteredOrders = orders.filter(function (order) {
      var matchesName = !orderNameFilter ||
        String(order.customerName || '').toLocaleLowerCase().indexOf(orderNameFilter.toLocaleLowerCase()) >= 0;
      var matchesStatus = orderStatusFilter === 'all' || (order.status || 'new') === orderStatusFilter;
      return matchesName && matchesStatus;
    });
    var orderMarkup = filteredOrders.map(function (order) {
      var items = Array.isArray(order.items) ? order.items : [];
      var status = ['new', 'in_progress', 'rejected', 'completed'].indexOf(order.status) >= 0
        ? order.status
        : 'new';
      var created = order.createdAt && order.createdAt.toDate
        ? order.createdAt.toDate().toLocaleString('ar-EG')
        : 'الآن';
      return '<article class="order">' +
        '<header class="order-header"><div><b>طلب #' + esc(order.id || '') + '</b><span class="sub">' + esc(created) + '</span></div>' +
        '</header>' +
        '<label class="order-status"><span>حالة الطلب</span><span class="status-control status-' + status + '">' +
        '<select data-order-status data-id="' + esc(order.id) + '" aria-label="حالة الطلب">' +
        Object.keys(statusNames).map(function (value) {
          return '<option value="' + value + '"' + (value === status ? ' selected' : '') + '>' + statusNames[value] + '</option>';
        }).join('') + '</select></span></label>' +
        '<div class="sumbox order-details"><div><span>الاسم</span><b>' + esc(order.customerName || '') + '</b></div>' +
        '<div><span>الهاتف</span><b dir="ltr">' + esc(order.phone || '') + '</b></div>' +
        '<div><span>البريد</span><b dir="ltr">' + esc(order.email || '') + '</b></div></div>' +
        (order.paymentMethod === 'cash_on_delivery'
          ? '<div class="deposit-admin"><div><span>طريقة الدفع</span><b>الدفع عند الاستلام</b></div>' +
            '<div><span>المبلغ المستحق عند الاستلام</span><b>' + egp(order.total || 0) + '</b></div>' +
            '<span class="pill good">الدفع عند الاستلام</span></div>'
          : order.paymentProofData
          ? '<div class="deposit-admin"><div><span>العربون المطلوب</span><b>' + egp(order.depositAmount || 0) + '</b></div>' +
            '<div><span>الباقي عند الاستلام</span><b>' + egp(Math.max(0, (order.total || 0) - (order.depositAmount || 0))) + '</b></div>' +
              '<div><span>طريقة الدفع</span><b>دفع عربون - ' + esc(order.paymentChannel || order.paymentMethod || 'غير محددة') + '</b></div>' +
            '<span class="pill warn">تم رفع الإثبات، بانتظار مراجعة العربون</span>' +
            '<div class="proof-preview"><img src="' + esc(order.paymentProofData || '') + '" alt="صورة إيصال التحويل"></div></div>'
            : '<div class="deposit-admin"><div><span>العربون المطلوب</span><b>' + egp(order.depositAmount || 0) + '</b></div>' +
            '<div><span>الباقي عند الاستلام</span><b>' + egp(Math.max(0, (order.total || 0) - (order.depositAmount || 0))) + '</b></div>' +
            '<span class="pill warn">لم يرفق إيصال تحويل</span></div>') +
        '<ul class="lines">' + items.map(function (item) {
          return '<li><span>' + esc(item.name) + ' · ' + fmt(item.quantity) + ' متر</span><b>' + egp(item.price * item.quantity) + '</b></li>';
        }).join('') + '</ul>' +
        '<div class="sumbox"><div><span>الإجمالي</span><b>' + egp(order.total || 0) + '</b></div></div>' +
        '</article>';
    }).join('');
    $('ordersPanel').innerHTML =
      '<div class="order-toolbar"><div><h2>طلبات العملاء</h2><span class="sub">' + fmt(orders.length) + ' طلب</span></div>' +
      '<button type="button" class="btn export-btn" data-act="export-orders"' + (orders.length ? '' : ' disabled') + '>تصدير كل الطلبات</button></div>' +
      '<form id="paymentSettingsForm" class="payment-settings">' +
      '<h3>بيانات استلام العربون</h3>' +
      '<div class="payment-settings-fields">' +
      '<label>رقم إنستاباي / فودافون كاش<input id="paymentNumberSetting" type="tel" inputmode="tel" dir="ltr" value="' + esc(paymentSettings.paymentNumber || '') + '" required></label>' +
      '<label>اسم صاحب الحساب (اختياري)<input id="paymentAccountNameSetting" type="text" value="' + esc(paymentSettings.accountName || '') + '"></label>' +
      '</div><button class="btn" type="submit">حفظ بيانات الدفع</button></form>' +
      '<div class="order-filters">' +
      '<label>البحث باسم العميل<input id="orderNameFilter" type="search" value="' + esc(orderNameFilter) + '" placeholder="اكتب اسم العميل"></label>' +
      '<label>تصفية حسب الحالة<select id="orderStatusFilter">' +
      '<option value="all"' + (orderStatusFilter === 'all' ? ' selected' : '') + '>كل الحالات</option>' +
      Object.keys(statusNames).map(function (value) {
        return '<option value="' + value + '"' + (orderStatusFilter === value ? ' selected' : '') + '>' + statusNames[value] + '</option>';
      }).join('') + '</select></label></div>' +
      (filteredOrders.length ? '<div class="orders-grid">' + orderMarkup + '</div>' : '<p class="empty">' + (orders.length ? 'لا توجد طلبات مطابقة للتصفية.' : 'لا توجد طلبات جديدة.') + '</p>');
  }
  function exportOrders() {
    var statusNames = {
      new: 'جديد',
      in_progress: 'قيد التنفيذ',
      rejected: 'مرفوض',
      completed: 'مكتمل'
    };
    var quote = function (value) {
      var text = String(value == null ? '' : value);
      if (/^[\t\r ]*[=+\-@]/.test(text)) text = "'" + text;
      return '"' + text.replace(/"/g, '""') + '"';
    };
    var rows = [[
      'رقم الطلب', 'التاريخ', 'اسم العميل', 'الهاتف', 'البريد الإلكتروني',
      'المنتجات', 'الإجمالي', 'طريقة الدفع', 'طريقة التحويل', 'العربون', 'الباقي عند الاستلام', 'الحالة'
    ]];
    orders.forEach(function (order) {
      var created = order.createdAt && order.createdAt.toDate
        ? order.createdAt.toDate().toLocaleString('ar-EG')
        : '';
      var items = (Array.isArray(order.items) ? order.items : []).map(function (item) {
        return item.name + ' (' + item.quantity + ' م)';
      }).join('، ');
      rows.push([
        order.id,
        created,
        order.customerName,
        order.phone,
        order.email,
        items,
        order.total,
        order.paymentMethod === 'cash_on_delivery' ? 'الدفع عند الاستلام' : 'دفع عربون',
        order.paymentChannel || order.paymentMethod || '',
        order.depositAmount || 0,
        Math.max(0, (order.total || 0) - (order.depositAmount || 0)),
        statusNames[order.status || 'new'] || statusNames.new
      ]);
    });
    var csv = '\uFEFF' + rows.map(function (row) {
      return row.map(quote).join(',');
    }).join('\r\n');
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = 'customer-orders-' + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    toast('تم تصدير ' + fmt(orders.length) + ' طلب');
  }
  async function loadOrders() {
    if (!firebaseReady) return;
    firebaseDb.collection('orders').orderBy('createdAt', 'desc').onSnapshot(function (snapshot) {
      orders = [];
      snapshot.forEach(function (document) {
        var order = document.data();
        order.id = document.id;
        orders.push(order);
      });
      renderOrders();
    }, function () {
      $('ordersPanel').innerHTML = '<p class="empty">تعذر تحميل الطلبات.</p>';
    });
  }
  function loadPaymentSettings() {
    if (!firebaseReady) return;
    firebaseDb.collection('settings').doc('payment').onSnapshot(function (document) {
      if (document.exists) {
        var savedSettings = document.data();
        paymentSettings = {
          paymentNumber: savedSettings.paymentNumber || '',
          accountName: savedSettings.accountName || '',
          depositPercent: 10
        };
      }
      if (sheetKind === 'checkout') renderCheckout();
      if (mode === 'admin' && tab === 'orders') renderOrders();
    }, function (error) {
      console.error('Failed to load payment settings', error);
      toast('تعذر تحميل بيانات الدفع');
    });
  }
  function renderStock() {
    var normalizedSearch = normalizeMaterialName(stockSearch);
    var filteredMaterials = materials.filter(function (item) {
      return !normalizedSearch || normalizeMaterialName(item.name).indexOf(normalizedSearch) >= 0;
    });
    $('stockList').innerHTML = filteredMaterials.length ? filteredMaterials.map(function (item) {
      var draft = stockEdits[item.id] || item;
      return '<article class="srow">' +
        '<div class="top2">' +
        '<div class="stock-image-preview" data-stock-image="' + item.id + '">' +
        (draft.image ? '<img class="sw sm" src="' + esc(draft.image) + '" alt="' + esc(item.name) + '">' : '<div class="sw sm material-placeholder"></div>') +
        '</div>' +
        '<div><b>' + esc(item.name) + '</b><span class="sub">القائمة الرئيسية</span></div></div>' +
        '<div class="fields">' +
        '<label>السعر للمتر<input type="number" inputmode="decimal" min="0" data-f="price" data-id="' + item.id + '" value="' + esc(draft.price) + '"></label>' +
        '<label>المتاح بالمتر<input type="number" inputmode="numeric" min="0" data-f="stock" data-id="' + item.id + '" value="' + esc(draft.stock) + '"></label>' +
        '<label>رفع صورة جديدة<input type="file" accept="image/jpeg,image/png,image/webp" data-image-id="' + item.id + '"><small>JPG أو PNG أو WEBP، حتى 5 ميجابايت</small></label>' +
        '</div><div class="stock-card-actions">' +
        '<button type="button" class="btn save-material-btn" data-act="save-material" data-id="' + item.id + '">حفظ التعديلات</button>' +
        '<button type="button" class="btn ghost delete-btn" data-act="delete" data-id="' + item.id + '">حذف الخامة</button></div>' +
        '</article>';
    }).join('') : '<p class="empty stock-empty">لا توجد خامات مطابقة للبحث.</p>';
  }
  function openAddMaterialSheet() {
    $('sheet').innerHTML =
      '<div class="handle"></div>' +
      '<div class="modal-head"><div><h2>إضافة خامة جديدة</h2><p class="sub">أضف بيانات الخامة للقائمة الرئيسية</p></div>' +
      '<button type="button" class="modal-close" data-act="close-modal" aria-label="إغلاق">×</button></div>' +
      '<form class="addbox addbox-modal" id="addForm">' +
      '<div class="formgrid">' +
      '<label class="full">اسم الخامة' +
      '<input id="nf-name" list="materialNameSuggestions" required placeholder="مثال: كوريشه" autocomplete="off">' +
      '<datalist id="materialNameSuggestions"></datalist>' +
      '<span id="nf-name-status" class="name-status" aria-live="polite"></span></label>' +
      '<label>سعر البيع للمتر<input id="nf-price" type="number" inputmode="decimal" min="1" required></label>' +
      '<label>المتاح بالمتر<input id="nf-stock" type="number" inputmode="numeric" min="0" required></label>' +
      '<label class="full image-upload">صورة الخامة' +
      '<input id="nf-image" type="file" accept="image/jpeg,image/png,image/webp">' +
      '<span id="nf-image-name" class="sub">اختياري — JPG أو PNG أو WEBP حتى 5 ميجابايت</span></label>' +
      '</div>' +
      '<button class="btn block" type="submit">أضف الخامة</button>' +
      '</form>';
    openSheet('add-material');
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

  document.addEventListener('click', async function (event) {
    if (event.target === $('scrim')) { closeSheet(); return; }
    var element = event.target.closest('[data-act]');
    if (!element) return;
    var act = element.dataset.act;
    if (act === 'mode') setMode(element.dataset.mode);
    else if (act === 'tab') setTab(element.dataset.tab);
    else if (act === 'open-add-material') openAddMaterialSheet();
    else if (act === 'close-modal') closeSheet();
    else if (act === 'export-orders') exportOrders();
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
    } else if (act === 'save-material') {
      var material = byId(+element.dataset.id);
      if (!material) return;
      var draft = stockEdits[material.id] || material;
      var price = Number(draft.price);
      var stock = Number(draft.stock);
      if (!Number.isFinite(price) || price < 0 || !Number.isFinite(stock) || stock < 0) {
        toast('أدخل سعرًا وكمية صحيحين قبل الحفظ');
        return;
      }
      var updatedMaterial = {
        id: material.id,
        name: material.name,
        price: price,
        stock: stock,
        image: draft.image || ''
      };
      try {
        if (firebaseReady) {
          await firebaseDb.collection('materials').doc(String(material.id)).set(updatedMaterial);
        } else {
          var previousMaterial = Object.assign({}, material);
          Object.assign(material, updatedMaterial);
          if (!await saveMaterials()) {
            Object.assign(material, previousMaterial);
            return;
          }
        }
        Object.assign(material, updatedMaterial);
        delete stockEdits[material.id];
        renderGrid();
        renderStock();
        toast('تم حفظ تعديلات ' + material.name);
      } catch (error) {
        console.error('Failed to save product', error);
        toast('تعذر حفظ تعديلات الخامة');
      }
    } else if (act === 'delete') {
      var item = byId(+element.dataset.id);
      if (item && confirm('هل تريد حذف ' + item.name + '؟')) {
        try {
          if (firebaseReady) {
            await firebaseDb.collection('materials').doc(String(item.id)).delete();
            materials = materials.filter(function (entry) { return entry.id !== item.id; });
          } else {
            var oldMaterials = materials;
            materials = materials.filter(function (entry) { return entry.id !== item.id; });
            if (!await saveMaterials()) {
              materials = oldMaterials;
              return;
            }
          }
          delete stockEdits[item.id];
          renderGrid();
          renderStock();
          toast('تم حذف الخامة');
        } catch (error) {
          console.error('Failed to delete product', error);
          toast('تعذر حذف الخامة');
        }
      }
    }
  });
  document.addEventListener('input', function (event) {
    if (event.target.id === 'search') {
      search = event.target.value.trim();
      renderGrid();
    } else if (event.target.id === 'stockSearch') {
      stockSearch = event.target.value.trim();
      renderStock();
    } else if (event.target.dataset && event.target.dataset.f) {
      var draftItem = byId(+event.target.dataset.id);
      if (!draftItem) return;
      var edit = stockEdits[draftItem.id] || {
        price: draftItem.price,
        stock: draftItem.stock,
        image: draftItem.image || ''
      };
      edit[event.target.dataset.f] = event.target.value;
      stockEdits[draftItem.id] = edit;
    } else if (event.target.id === 'nf-name') {
      updateMaterialNameCheck();
    } else if (event.target.id === 'orderNameFilter') {
      orderNameFilter = event.target.value.trim();
      renderOrders();
      var filter = $('orderNameFilter');
      filter.focus();
      filter.setSelectionRange(filter.value.length, filter.value.length);
    } else if (event.target.id === 'qtyInput') {
      detailQty = clampQty(event.target.value);
      updateDetailTotal();
    }
  });
  document.addEventListener('change', async function (event) {
    var target = event.target;
    if (target.id === 'paymentMethod') {
      checkoutPaymentMethod = target.value;
      renderPaymentDetails();
    } else if (target.id === 'nf-image') {
      $('nf-image-name').textContent = target.files[0] ? target.files[0].name : 'اختياري — JPG أو PNG أو WEBP حتى 5 ميجابايت';
    } else if (target.id === 'orderStatusFilter') {
      orderStatusFilter = target.value;
      renderOrders();
    } else if (target.dataset && target.dataset.orderStatus !== undefined) {
      var order = orders.find(function (item) { return item.id === target.dataset.id; });
      if (!order) return;
      var previousStatus = order.status || 'new';
      var nextStatus = target.value;
      if (!firebaseReady || !firebaseAuth || !firebaseAuth.currentUser) {
        target.value = previousStatus;
        toast('يجب تسجيل دخول الأدمن لتحديث حالة الطلب');
        return;
      }
      firebaseDb.collection('orders').doc(order.id).update({ status: nextStatus })
        .then(function () {
          order.status = nextStatus;
          renderOrders();
          toast('تم تحديث حالة الطلب');
        })
        .catch(function () {
          target.value = previousStatus;
          toast('تعذر تحديث حالة الطلب');
        });
    } else if (target.dataset && target.dataset.imageId) {
      var imageItem = byId(+target.dataset.imageId);
      if (!imageItem) return;
      var imageFile = target.files[0];
      if (!imageFile) return;
      if (!/^image\/(jpeg|png|webp)$/.test(imageFile.type) || imageFile.size > 5 * 1024 * 1024) {
        target.value = '';
        toast('اختر صورة JPG أو PNG أو WEBP لا تتجاوز 5 ميجابايت');
        return;
      }
      try {
        var imageEdit = stockEdits[imageItem.id] || {
          price: imageItem.price,
          stock: imageItem.stock,
          image: imageItem.image || ''
        };
        imageEdit.image = await compressImage(imageFile);
        stockEdits[imageItem.id] = imageEdit;
        var preview = document.querySelector('[data-stock-image="' + imageItem.id + '"]');
        if (preview) {
          preview.innerHTML = '<img class="sw sm" src="' + esc(imageEdit.image) + '" alt="' + esc(imageItem.name) + '">';
        }
        toast('الصورة جاهزة، اضغط حفظ التعديلات');
      } catch (error) {
        console.error('Failed to process product image', error);
        toast('تعذر تجهيز صورة الخامة');
      }
      target.value = '';
    }
  });
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && sheetKind) closeSheet();
  });
  document.addEventListener('submit', async function (event) {
    if (event.target.id === 'paymentSettingsForm') {
      event.preventDefault();
      if (!firebaseReady || !firebaseAuth || !firebaseAuth.currentUser) {
        toast('يجب تسجيل دخول الأدمن لحفظ بيانات الدفع');
        return;
      }
      var paymentNumber = $('paymentNumberSetting').value.trim();
      var accountName = $('paymentAccountNameSetting').value.trim();
      if (!paymentNumber) {
        toast('أدخل رقم استلام العربون');
        return;
      }
      try {
        await firebaseDb.collection('settings').doc('payment').set({
          paymentNumber: paymentNumber,
          accountName: accountName,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        paymentSettings.paymentNumber = paymentNumber;
        paymentSettings.accountName = accountName;
        renderOrders();
        toast('تم حفظ بيانات الدفع');
      } catch (error) {
        console.error('Failed to save payment settings', error);
        toast('تعذر حفظ بيانات الدفع');
      }
      return;
    }
    if (event.target.id === 'addForm') {
      event.preventDefault();
      var materialName = $('nf-name').value.trim();
      var materialPrice = +$('nf-price').value;
      var materialStock = +$('nf-stock').value;
      if (!materialName || !(materialPrice >= 0) || !(materialStock >= 0)) {
        toast('اكتب الاسم والسعر والكمية');
        return;
      }
      if (findMaterialByName(materialName)) {
        updateMaterialNameCheck();
        $('nf-name').focus();
        toast('لا يمكن إضافة خامة بنفس الاسم');
        return;
      }
      var materialImageFile = $('nf-image').files[0];
      if (materialImageFile &&
          (!/^image\/(jpeg|png|webp)$/.test(materialImageFile.type) || materialImageFile.size > 5 * 1024 * 1024)) {
        toast('اختر صورة JPG أو PNG أو WEBP لا تتجاوز 5 ميجابايت');
        return;
      }
      var materialImage = '';
      try {
        if (materialImageFile) materialImage = await compressImage(materialImageFile);
      } catch (error) {
        console.error('Failed to process new product image', error);
        toast('تعذر تجهيز صورة الخامة');
        return;
      }
      var newMaterial = {
        id: nextId,
        name: materialName,
        price: materialPrice,
        stock: materialStock,
        image: materialImage
      };
      try {
        if (firebaseReady) {
          await firebaseDb.collection('materials').doc(String(newMaterial.id)).set(newMaterial);
        } else {
          materials.push(newMaterial);
          if (!await saveMaterials()) {
            materials.pop();
            return;
          }
        }
      } catch (error) {
        console.error('Failed to create product', error);
        toast('تعذر حفظ الخامة الجديدة');
        return;
      }
      if (firebaseReady && !byId(newMaterial.id)) materials.push(newMaterial);
      nextId++;
      event.target.reset();
      renderGrid();
      renderStock();
      renderChips();
      closeSheet();
      toast('تمت إضافة الخامة');
      return;
    }
    if (event.target.id !== 'orderForm') return;
    event.preventDefault();
    var name = $('orderName').value.trim();
    var phone = $('orderPhone').value.trim();
    var email = $('orderEmail').value.trim();
    var ids = Object.keys(cart);
    if (!name || !phone || !email || !ids.length) {
      toast('أدخل الاسم ورقم الهاتف والبريد الإلكتروني');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast('البريد الإلكتروني غير صحيح');
      return;
    }
    var paymentMethod = $('paymentMethod').value;
    if (paymentMethod !== 'deposit' && paymentMethod !== 'cash_on_delivery') {
      toast('اختر طريقة دفع صحيحة');
      return;
    }
    var paymentChannel = '';
    var proofFile = null;
    if (paymentMethod === 'deposit') {
      paymentChannel = $('paymentChannel').value;
      proofFile = $('paymentProof').files[0];
      if (!proofFile) {
        toast('أرفق صورة إيصال التحويل');
        return;
      }
      if (!/^image\/(jpeg|png|webp)$/.test(proofFile.type) || proofFile.size > 5 * 1024 * 1024) {
        toast('اختر صورة JPG أو PNG أو WEBP لا تتجاوز 5 ميجابايت');
        return;
      }
    }
    if (!firebaseReady) {
      toast('إرسال الطلب غير متاح حاليًا');
      return;
    }
    var items = ids.map(function (id) {
      var item = byId(+id);
      return { materialId: item.id, name: item.name, quantity: cart[id], price: item.price };
    });
    var total = cartTotal().total;
    var isDeposit = paymentMethod === 'deposit';
    var depositAmount = isDeposit ? Math.ceil(total * paymentSettings.depositPercent / 100) : 0;
    try {
      var paymentProofData = isDeposit ? await compressImage(proofFile) : '';
      var orderRef = firebaseDb.collection('orders').doc();
      await orderRef.set({
        customerName: name,
        phone: phone,
        email: email,
        items: items,
        total: total,
        depositAmount: depositAmount,
        paymentMethod: paymentMethod,
        paymentChannel: paymentChannel,
        paymentStatus: isDeposit ? 'submitted' : 'cash_on_delivery',
        paymentProofData: paymentProofData,
        status: 'new',
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      cart = {};
      closeSheet();
      renderCartbar();
      renderGrid();
      checkoutPaymentMethod = 'deposit';
      toast(isDeposit ? 'تم إرسال الطلب وإيصال العربون بنجاح' : 'تم إرسال الطلب بنجاح، والدفع عند الاستلام');
    } catch (error) {
      console.error('Failed to submit order', error);
      toast('تعذر إرسال الطلب');
    }
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
      var authenticated = !!user || isAdminAuthenticated();
      $('adminControls').hidden = !authenticated;
      if (authenticated) {
        sessionStorage.setItem(SESSION_KEY, 'authenticated');
        setMode('admin');
        setTab('orders');
        loadOrders();
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
      setTab('orders');
      loadOrders();
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
          setTab('orders');
        } else {
          setMode('client');
        }
      })
      .catch(function () {
        $('adminControls').hidden = true;
        setMode('client');
      });
  }
  loadPaymentSettings();
  loadMaterials();
  setInterval(loadMaterials, 10000);
})();
