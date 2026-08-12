/**
 * layout.js - PC端后台公共布局（侧边栏 + 用户区）
 *  由各页面加载，登录校验通过后由 auth.js 调用 Layout.render(user)。
 *  侧边栏菜单为真实 <a href> 跳转，点击进入不同的后台页面。
 *  当前页根据 location.pathname 自动高亮；"管理员账号" 仅超级管理员可见。
 */
window.Layout = (function () {
  'use strict';

  // 菜单定义：key 用于匹配当前页，href 为相对路径（同目录 pages/ 下）
  function navItems(user) {
    var items = [
      { key: 'employees', icon: '👥', label: '员工管理',     href: 'employees.html' },
      { key: 'rules',     icon: '⚙️', label: '匹配规则配置', href: 'rules.html' },
      { key: 'dashboard', icon: '📊', label: '数据概览',     href: 'dashboard.html' },
      { key: 'jdyapi',    icon: '🔗', label: '简道云接口',   href: 'jdyapi.html' },
    ];
    if (user && user.role === 'super') {
      items.push({ key: 'admins', icon: '🔐', label: '管理员账号', href: 'admins.html' });
    }
    return items;
  }

  // 根据当前 URL 推断高亮项
  function currentKey() {
    var p = location.pathname;
    if (p.indexOf('employees') >= 0) return 'employees';
    if (p.indexOf('rules') >= 0) return 'rules';
    if (p.indexOf('dashboard') >= 0) return 'dashboard';
    if (p.indexOf('jdyapi') >= 0) return 'jdyapi';
    if (p.indexOf('admins') >= 0) return 'admins';
    return 'employees';
  }

  function render(user) {
    var el = document.getElementById('app-sidebar');
    if (!el) return;
    var key = currentKey();
    var html = '<div class="logo">🏦 助贷管理后台</div>';
    navItems(user).forEach(function (it) {
      var cls = 'nav-item' + (it.key === key ? ' active' : '');
      html += '<a class="' + cls + '" href="' + it.href + '">' +
              '<span class="ni-icon">' + it.icon + '</span> ' + it.label + '</a>';
    });
    html += '<div class="admin-sidebar-footer">';
    var who = user ? (user.name + '（' + (user.account || '') + '）') : '未登录';
    html += '<div class="asf-user" id="sidebarUser">👤 ' + who + '</div>';
    html += '<button class="asf-logout" onclick="Layout.logout()">退出登录</button>';
    html += '</div>';
    el.innerHTML = html;
  }

  function logout() {
    fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' })
      .then(function () { location.replace('/login.html'); })
      .catch(function () { location.replace('/login.html'); });
  }

  return {
    render: render,
    logout: logout,
  };
})();
