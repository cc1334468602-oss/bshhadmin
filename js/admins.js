/**
 * admins.js - 管理员账号管理页面逻辑（仅超级管理员入口可见，权限由后端守卫）
 */
window.Page = (function () {
  'use strict';

  function $(id) { return document.getElementById(id); }

  function init() {
    loadAdmins();
  }

  function loadAdmins() {
    const tbody = $('adminTableBody');
    if (tbody) tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#8e8e93;padding:20px;">加载中...</td></tr>';
    fetch('/api/admin/accounts', { method: 'GET' })
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (!res.success) {
          if (tbody) tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#d33;padding:20px;">' + (res.error || '加载失败') + '</td></tr>';
          return;
        }
        renderAdmins(res.data || []);
      })
      .catch(function (e) {
        if (tbody) tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#d33;padding:20px;">加载失败：' + e.message + '</td></tr>';
      });
  }

  function renderAdmins(list) {
    const tbody = $('adminTableBody');
    if (!tbody) return;
    if (!list.length) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#8e8e93;padding:20px;">暂无账号</td></tr>';
      return;
    }
    const me = window.__ADMIN_USER__ ? window.__ADMIN_USER__.account : '';
    let html = '';
    list.forEach(function (a) {
      const isSuper = a.role === 'super';
      const roleLabel = isSuper
        ? '<span class="status-badge status-bound">👑 超级管理员</span>'
        : '<span class="status-badge status-unbound">普通管理员</span>';
      const isSelf = a.username === me;
      html += '<tr>' +
        '<td>' + a.username + (isSelf ? ' <span style="color:#185FA5;font-size:12px;">(当前)</span>' : '') + '</td>' +
        '<td>' + (a.name || '') + '</td>' +
        '<td>' + roleLabel + '</td>' +
        '<td>' + (a.createdAt ? String(a.createdAt).replace('T', ' ').substring(0, 19) : '-') + '</td>' +
        '<td>' +
          '<button class="btn btn-outline btn-sm" onclick="Page.showChgPwd(\'' + a.username + '\')">改密码</button> ' +
          (isSuper
            ? '<span style="color:#8e8e93;font-size:12px;">超级管理员不可删</span>'
            : '<button class="btn btn-danger btn-sm" onclick="Page.deleteAdmin(\'' + a.username + '\')">删除</button>') +
        '</td>' +
      '</tr>';
    });
    tbody.innerHTML = html;
  }

  function showAddAdmin() {
    $('addAdminTitle').textContent = '添加管理员账号';
    $('addAdminUsername').value = '';
    $('addAdminName').value = '';
    $('addAdminPwd').value = '';
    $('addAdminRole').value = 'admin';
    $('addAdminModal').classList.add('active');
  }
  function closeAddAdmin() { $('addAdminModal').classList.remove('active'); }

  function confirmAddAdmin() {
    const username = $('addAdminUsername').value.trim();
    const name = $('addAdminName').value.trim();
    const password = $('addAdminPwd').value;
    const role = $('addAdminRole').value;
    if (!username) { alert('请输入登录账号'); return; }
    if (!password) { alert('请输入初始密码'); return; }
    fetch('/api/admin/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username, name: name, password: password, role: role }),
    }).then(function (r) { return r.json(); })
      .then(function (res) {
        if (res.success) { alert('账号 ' + username + ' 添加成功！'); closeAddAdmin(); loadAdmins(); }
        else alert('添加失败：' + (res.error || '未知错误'));
      })
      .catch(function (e) { alert('添加失败：' + e.message); });
  }

  function showChgPwd(username) {
    $('chgPwdUsername').textContent = username;
    $('chgPwdNew').value = '';
    $('chgPwdModal').classList.add('active');
  }
  function closeChgPwd() { $('chgPwdModal').classList.remove('active'); }

  function confirmChgPwd() {
    const username = $('chgPwdUsername').textContent;
    const pwd = $('chgPwdNew').value;
    if (!pwd) { alert('请输入新密码'); return; }
    fetch('/api/admin/accounts', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username, password: pwd }),
    }).then(function (r) { return r.json(); })
      .then(function (res) {
        if (res.success) { alert('密码修改成功！'); closeChgPwd(); }
        else alert('修改失败：' + (res.error || '未知错误'));
      })
      .catch(function (e) { alert('修改失败：' + e.message); });
  }

  function deleteAdmin(username) {
    if (!confirm('确认删除账号 ' + username + '？该账号将不能再登录后台。')) return;
    fetch('/api/admin/accounts', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username }),
    }).then(function (r) { return r.json(); })
      .then(function (res) {
        if (res.success) { alert('账号 ' + username + ' 已删除'); loadAdmins(); }
        else alert('删除失败：' + (res.error || '未知错误'));
      })
      .catch(function (e) { alert('删除失败：' + e.message); });
  }

  return {
    init: init,
    loadAdmins: loadAdmins,
    showAddAdmin: showAddAdmin,
    closeAddAdmin: closeAddAdmin,
    confirmAddAdmin: confirmAddAdmin,
    showChgPwd: showChgPwd,
    closeChgPwd: closeChgPwd,
    confirmChgPwd: confirmChgPwd,
    deleteAdmin: deleteAdmin,
  };
})();
