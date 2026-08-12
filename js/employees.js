/**
 * employees.js - 员工管理页面逻辑
 *  由 layout.js + auth.js 加载；登录校验通过后 auth.js 调用 window.Page.init()。
 */
window.Page = (function () {
  'use strict';

  const D = window.MOCK_DATA;
  let employees = D.EMPLOYEES.slice();
  let currentBindEmpId = null;

  function $(id) { return document.getElementById(id); }

  // ===== 初始化（auth.js 登录校验后调用） =====
  function init() {
    loadEmployees();
  }

  // ===== 员工列表 =====
  function renderEmployees() {
    const tbody = $('employeeTableBody');
    let html = '';
    employees.forEach(function (e) {
      const bound = e.jiandaoyunBound;
      html += '<tr>' +
        '<td>' + e.id + '</td>' +
        '<td>' + e.name + '</td>' +
        '<td>' + e.phone + '</td>' +
        '<td>' + e.department + '</td>' +
        '<td><span class="status-badge ' + (bound ? 'status-bound' : 'status-unbound') + '">' + (bound ? '🟢 已关联' : '🔴 未关联') + '</span></td>' +
        '<td>2026-07-15</td>' +
        '<td>' +
          '<button class="btn btn-outline btn-sm" onclick="Page.showBindModal(\'' + e.id + '\')">' + (bound ? '重新绑定' : '绑定简道云') + '</button>' +
        '</td>' +
      '</tr>';
    });
    tbody.innerHTML = html;
  }

  function loadEmployees() {
    fetch('/api/db/employees', { method: 'GET' })
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (res.success && res.data && res.data.length > 0) {
          employees = res.data;
        } else {
          employees = D.EMPLOYEES.slice();
        }
        renderEmployees();
      })
      .catch(function () { employees = D.EMPLOYEES.slice(); renderEmployees(); });
  }

  // ===== 绑定简道云 =====
  function showBindModal(empId) {
    currentBindEmpId = empId;
    const emp = employees.find(function (e) { return e.id === empId; });
    if (!emp) return;
    $('bindEmployeeName').textContent = emp.name + '（' + emp.phone + '）';
    $('bindCurrent').textContent = emp.jiandaoyunBound ? '当前绑定：' + emp.jiandaoyunAccount : '当前未绑定';

    const select = $('bindSelect');
    select.innerHTML = '<option value="">请选择简道云业务员...</option>';
    D.JIANDAOYUN_USERS.forEach(function (u) {
      select.innerHTML += '<option value="' + u.id + '">' + u.name + '（工号：' + u.workId + '）</option>';
    });

    $('bindModal').classList.add('active');
  }

  function closeBindModal() {
    $('bindModal').classList.remove('active');
    currentBindEmpId = null;
  }

  function confirmBind() {
    const select = $('bindSelect');
    const jdyId = select.value;
    if (!jdyId) { alert('请选择简道云业务员'); return; }

    const jdyUser = D.JIANDAOYUN_USERS.find(function (u) { return u.id === jdyId; });
    const emp = employees.find(function (e) { return e.id === currentBindEmpId; });
    if (!emp || !jdyUser) return;

    emp.jiandaoyunBound = true;
    emp.jiandaoyunAccount = jdyUser.name + '（简道云）';
    renderEmployees();

    fetch('/api/db/employees', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: emp.id, phone: emp.phone, jiandaoyunBound: true, jiandaoyunAccount: emp.jiandaoyunAccount }),
    }).catch(function () {});

    alert('绑定成功！' + emp.name + ' 已关联简道云账号：' + jdyUser.name);
    closeBindModal();
  }

  // ===== 添加员工 =====
  function showAddEmployee() {
    $('addEmpName').value = '';
    $('addEmpPhone').value = '';
    $('addEmpDept').value = '';
    $('addEmpModal').classList.add('active');
  }

  function closeAddEmp() {
    $('addEmpModal').classList.remove('active');
  }

  function confirmAddEmp() {
    const name = $('addEmpName').value.trim();
    const phone = $('addEmpPhone').value.trim();
    const dept = $('addEmpDept').value.trim();
    if (!name) { alert('请输入姓名'); return; }
    if (!phone || phone.length !== 11) { alert('请输入11位手机号'); return; }
    if (!dept) { alert('请输入部门'); return; }

    const newId = 'E' + String(employees.length + 1).padStart(3, '0');
    const emp = {
      id: newId, name: name, phone: phone, department: dept,
      jiandaoyunBound: false, jiandaoyunAccount: '',
    };
    employees.push(emp);
    renderEmployees();
    closeAddEmp();

    fetch('/api/db/employees', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: newId, name: name, phone: phone, department: dept }),
    }).then(function (r) { return r.json(); })
      .then(function (res) {
        if (res.success) alert('员工 ' + name + ' 添加成功！');
        else { alert('添加失败：' + (res.error || '未知错误')); loadEmployees(); }
      })
      .catch(function () { alert('保存失败，已恢复本地列表'); loadEmployees(); });
  }

  return {
    init: init,
    showBindModal: showBindModal,
    closeBindModal: closeBindModal,
    confirmBind: confirmBind,
    showAddEmployee: showAddEmployee,
    closeAddEmp: closeAddEmp,
    confirmAddEmp: confirmAddEmp,
  };
})();
