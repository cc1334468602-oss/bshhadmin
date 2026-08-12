/**
 * login.js - 后台登录页逻辑
 * 提交手机号+密码到 /api/auth/login，成功后跳转后台主页。
 */
(function () {
  'use strict';

  // 已登录则直接进后台，避免重复登录
  fetch('/api/auth/me', { method: 'GET', credentials: 'same-origin' })
    .then(function (r) { if (r.ok) location.replace('/pages/employees.html'); })
    .catch(function () {});

  var form = document.getElementById('loginForm');
  var errBox = document.getElementById('loginError');
  var btn = document.getElementById('loginBtn');

  function showErr(msg) {
    errBox.textContent = msg;
    errBox.style.display = 'block';
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    errBox.style.display = 'none';

    var username = document.getElementById('username').value.trim();
    var password = document.getElementById('password').value;
    if (!username || !password) { showErr('请输入管理员账号和密码'); return; }

    btn.disabled = true;
    btn.textContent = '登录中...';

    fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ username: username, password: password }),
    })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (res) {
        if (res.ok && res.d.success) {
          location.replace('/pages/employees.html');
        } else {
          showErr((res.d && res.d.error) || '登录失败');
        }
      })
      .catch(function (e) { showErr('网络错误：' + e.message); })
      .finally(function () {
        btn.disabled = false;
        btn.textContent = '登 录';
      });
  });
})();
