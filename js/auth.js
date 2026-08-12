/**
 * auth.js - 后台页面级登录守卫（在 layout.js 之后加载）
 *  - 校验登录态：未登录直接跳登录页
 *  - 全局拦截 401（登录过期）→ 跳登录页
 *  - 登录成功后：渲染公共侧边栏 Layout.render(user)，再调用当前页面的 Page.init()
 */
(function () {
  'use strict';

  // 拦截 fetch：业务接口返回 401（非登录接口本身）时，跳转登录页
  var _origFetch = window.fetch;
  window.fetch = function (input, init) {
    var url = (typeof input === 'string') ? input : (input && input.url) || '';
    return _origFetch.apply(this, arguments).then(function (r) {
      if (r.status === 401 && url.indexOf('/api/auth/login') < 0 && url.indexOf('/api/auth/me') < 0) {
        location.replace('/login.html');
      }
      return r;
    });
  };

  fetch('/api/auth/me', { method: 'GET', credentials: 'same-origin' })
    .then(function (r) {
      if (!r.ok) { location.replace('/login.html'); return null; }
      return r.json();
    })
    .then(function (data) {
      if (!data || !data.success) { location.replace('/login.html'); return; }
      window.__ADMIN_USER__ = data.user;
      if (window.Layout) Layout.render(data.user);
      if (window.Page && window.Page.init) window.Page.init(data.user);
    })
    .catch(function () { location.replace('/login.html'); });
})();
