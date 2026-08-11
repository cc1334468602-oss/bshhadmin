/**
 * admin.js - PC端后台管理逻辑
 * 员工管理 + 简道云绑定 + 匹配规则配置 + 数据概览
 */
window.Admin = (function () {
  'use strict';

  const D = window.MOCK_DATA;
  let employees = D.EMPLOYEES.slice(); // 可变副本
  let currentBindEmpId = null;
  let rules = JSON.parse(JSON.stringify(D.MATCH_RULES)); // 深拷贝

  function $(id) { return document.getElementById(id); }

  // ===== 页面切换 =====
  function switchPage(page) {
    document.querySelectorAll('.admin-page').forEach(function (p) { p.classList.add('hidden'); });
    $('page-' + page).classList.remove('hidden');
    document.querySelectorAll('.nav-item').forEach(function (n) { n.classList.remove('active'); });
    document.querySelector('.nav-item[data-page="' + page + '"]').classList.add('active');

    if (page === 'employees') renderEmployees();
    else if (page === 'rules') loadRules();
    else if (page === 'dashboard') renderDashboard();
    else if (page === 'jdyapi') loadJdyConfig();
  }

  // ===== 简道云接口配置 =====
  function loadJdyConfig() {
    fetch('/api/jdy/config')
      .then(function (r) { return r.json(); })
      .then(function (cfg) {
        if (cfg.appId) $('jdy-appId').value = cfg.appId;
        if (cfg.entries) {
          var keys = ['customer', 'loan', 'loanHistory', 'cashFlow', 'intention', 'followUp', 'repayment'];
          keys.forEach(function (k) {
            var el = $('jdy-entry-' + k);
            if (el && cfg.entries[k]) el.value = cfg.entries[k];
          });
        }
        if (cfg.hasApiKey) {
          $('jdy-apiKey').placeholder = '已配置（如需更换请直接输入新Key）';
        }
      })
      .catch(function () {});
  }

  function saveJdyConfig() {
    var cfg = {
      apiKey: $('jdy-apiKey').value.trim(),
      appId: $('jdy-appId').value.trim(),
      entries: {},
    };
    var keys = ['customer', 'loan', 'loanHistory', 'cashFlow', 'intention', 'followUp', 'repayment'];
    keys.forEach(function (k) {
      var el = $('jdy-entry-' + k);
      if (el) cfg.entries[k] = el.value.trim();
    });
    fetch('/api/jdy/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cfg),
    })
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (res.success) alert('配置保存成功！');
        else alert('保存失败：' + (res.error || '未知错误'));
      })
      .catch(function (e) { alert('保存失败：' + e.message); });
  }

  function testJdyConnection() {
    $('jdyConnectionStatus').innerHTML = '<span style="color:#185FA5;">正在测试连接...</span>';
    fetch('/api/jdy/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    })
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (res.success) {
          $('jdyConnectionStatus').innerHTML = '<span style="color:#0F6E56;font-weight:600;">连接成功！</span> 简道云API可正常访问，客户数据可正常拉取。';
        } else {
          $('jdyConnectionStatus').innerHTML = '<span style="color:#A32D2D;font-weight:600;">连接失败</span> ' + (res.error || '请检查API Key和Entry ID是否正确');
        }
      })
      .catch(function (e) {
        $('jdyConnectionStatus').innerHTML = '<span style="color:#A32D2D;font-weight:600;">连接失败</span> ' + e.message;
      });
  }

  // ===== 员工管理 =====
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
          '<button class="btn btn-outline btn-sm" onclick="Admin.showBindModal(\'' + e.id + '\')">' + (bound ? '重新绑定' : '绑定简道云') + '</button>' +
        '</td>' +
      '</tr>';
    });
    tbody.innerHTML = html;
  }

  function showBindModal(empId) {
    currentBindEmpId = empId;
    const emp = employees.find(function (e) { return e.id === empId; });
    if (!emp) return;
    $('bindEmployeeName').textContent = emp.name + '（' + emp.phone + '）';
    $('bindCurrent').textContent = emp.jiandaoyunBound ? '当前绑定：' + emp.jiandaoyunAccount : '当前未绑定';

    // 填充简道云用户下拉
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

    // 落库
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
    // 乐观更新
    employees.push(emp);
    renderEmployees();
    closeAddEmp();

    // 落库
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

  // ===== 匹配规则配置 =====
  function loadRules() {
    fetch('/api/db/match-rules', { method: 'GET' })
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (res.success && res.data) {
          rules = res.data;
          D.MATCH_RULES = JSON.parse(JSON.stringify(res.data)); // 同步到引擎缓存
        }
        loadRulesToForm();
      })
      .catch(function () { loadRulesToForm(); });
  }

  function loadRulesToForm() {
    // 表单填充
    $('rule-preferred-minCredit').value = rules.preferred.minCreditScore;
    $('rule-preferred-maxDebt').value = rules.preferred.maxDebtRatio;
    $('rule-preferred-rateCeiling').value = rules.preferred.rateCeiling;
    $('rule-preferred-bankTypes').value = rules.preferred.bankTypes.join(',');
    $('rule-preferred-multiplier').value = rules.amountMultiplier.preferred;

    $('rule-backup-minCredit').value = rules.backup.minCreditScore;
    $('rule-backup-maxDebt').value = rules.backup.maxDebtRatio;
    $('rule-backup-rateCeiling').value = rules.backup.rateCeiling;
    $('rule-backup-bankTypes').value = rules.backup.bankTypes.join(',');
    $('rule-backup-multiplier').value = rules.amountMultiplier.backup;

    $('rule-fallback-minCredit').value = rules.fallback.minCreditScore;
    $('rule-fallback-maxDebt').value = rules.fallback.maxDebtRatio;
    $('rule-fallback-rateCeiling').value = rules.fallback.rateCeiling;
    $('rule-fallback-bankTypes').value = rules.fallback.bankTypes.join(',');
    $('rule-fallback-multiplier').value = rules.amountMultiplier.fallback;

    // JSON 编辑器
    $('ruleJsonEditor').value = JSON.stringify(rules, null, 2);
  }

  function saveRules() {
    // 从表单读取
    rules.preferred = {
      minCreditScore: parseInt($('rule-preferred-minCredit').value),
      maxDebtRatio: parseInt($('rule-preferred-maxDebt').value),
      rateCeiling: parseFloat($('rule-preferred-rateCeiling').value),
      bankTypes: $('rule-preferred-bankTypes').value.split(',').map(function (s) { return s.trim(); }),
    };
    rules.backup = {
      minCreditScore: parseInt($('rule-backup-minCredit').value),
      maxDebtRatio: parseInt($('rule-backup-maxDebt').value),
      rateCeiling: parseFloat($('rule-backup-rateCeiling').value),
      bankTypes: $('rule-backup-bankTypes').value.split(',').map(function (s) { return s.trim(); }),
    };
    rules.fallback = {
      minCreditScore: parseInt($('rule-fallback-minCredit').value),
      maxDebtRatio: parseInt($('rule-fallback-maxDebt').value),
      rateCeiling: parseFloat($('rule-fallback-rateCeiling').value),
      bankTypes: $('rule-fallback-bankTypes').value.split(',').map(function (s) { return s.trim(); }),
    };
    rules.amountMultiplier = {
      preferred: parseInt($('rule-preferred-multiplier').value),
      backup: parseInt($('rule-backup-multiplier').value),
      fallback: parseInt($('rule-fallback-multiplier').value),
    };

    // 同步到全局
    D.MATCH_RULES = JSON.parse(JSON.stringify(rules));
    $('ruleJsonEditor').value = JSON.stringify(rules, null, 2);

    // 落库
    fetch('/api/db/match-rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rules),
    }).then(function (r) { return r.json(); })
      .then(function (res) {
        if (!res.success) alert('规则已生效（本地），但保存到数据库失败：' + (res.error || ''));
      })
      .catch(function () {});

    alert('匹配规则已保存并即时生效！');
  }

  function resetRules() {
    if (!confirm('确认恢复默认规则？当前修改将丢失。')) return;
    rules = JSON.parse(JSON.stringify(D.MATCH_RULES));
    loadRulesToForm();
    alert('已恢复默认规则');
  }

  function applyJson() {
    try {
      const parsed = JSON.parse($('ruleJsonEditor').value);
      rules = parsed;
      D.MATCH_RULES = JSON.parse(JSON.stringify(rules));
      fetch('/api/db/match-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rules),
      }).catch(function () {});
      loadRulesToForm();
      alert('JSON 规则已应用并即时生效！');
    } catch (err) {
      alert('JSON 格式错误：' + err.message);
    }
  }

  function syncFormToJson() {
    // 先从表单读取到 rules 对象
    saveRules();
  }

  // ===== 数据概览 =====
  // 客户统计优先来自 MySQL；数据库不可用时回退简道云实时拉取
  function renderDashboard() {
    $('statEmployees').textContent = employees.length;
    $('statBound').textContent = employees.filter(function (e) { return e.jiandaoyunBound; }).length;
    $('statProducts').textContent = D.PRODUCTS.length;
    $('statCustomers').textContent = '…';
    $('statusDistribution').innerHTML =
      '<div style="padding:20px;text-align:center;color:#8e8e93;font-size:13px;">正在读取客户数据…</div>';

    loadProductsCount();
    fetchDbStats();
  }

  function loadProductsCount() {
    fetch('/api/db/products', { method: 'GET' })
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (res.success && res.data) $('statProducts').textContent = res.data.length;
      })
      .catch(function () {});
  }

  function fetchDbStats() {
    fetch('/api/db/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (res.success) {
          $('statCustomers').textContent = res.total;
          renderStatusDist(res.byStatus || {});
        } else {
          fetchJdyStats(); // 回退简道云
        }
      })
      .catch(function () { fetchJdyStats(); });
  }

  function fetchJdyStats() {
    fetch('/api/jdy/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ limit: 100 }),
    })
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (res.success) {
          $('statCustomers').textContent = res.total;
          renderStatusDist(res.byStatus || {});
        } else {
          showDashError(res.error || '未知错误');
        }
      })
      .catch(function (e) { showDashError(e.message); });
  }

  function renderStatusDist(byStatus) {
    const labels = ['new', 'following', 'matched', 'approving', 'rejected'];
    const labelsZh = { 'new': '新线索', 'following': '跟进中', 'matched': '已匹配', 'approving': '审批中', 'rejected': '已拒绝' };
    const colors = {
      'new': '#8e8e93', 'following': '#2563eb', 'matched': '#34c759',
      'approving': '#ff9500', 'rejected': '#ff3b30',
    };
    // 数据库可能返回预设之外的状态值，一并展示避免统计遗漏
    Object.keys(byStatus).forEach(function (k) {
      if (labels.indexOf(k) < 0) labels.push(k);
    });

    let html = '<div style="display:flex;gap:16px;flex-wrap:wrap;">';
    labels.forEach(function (k) {
      html += '<div style="flex:1;min-width:120px;text-align:center;padding:16px;background:#fafafa;border-radius:8px;">';
      html += '<div style="font-size:28px;font-weight:800;color:' + (colors[k] || '#5856d6') + ';">' + (byStatus[k] || 0) + '</div>';
      html += '<div style="font-size:13px;color:#8e8e93;margin-top:4px;">' + (labelsZh[k] || k) + '</div>';
      html += '</div>';
    });
    html += '</div>';
    $('statusDistribution').innerHTML = html;
  }

  function showDashError(msg) {
    $('statCustomers').textContent = '-';
    $('statusDistribution').innerHTML =
      '<div style="padding:20px;background:#fff4f4;border:1px solid #ffd7d7;border-radius:8px;color:#d33;font-size:13px;">' +
      '读取客户数据失败：' + msg +
      '<br><span style="color:#8e8e93;">请检查数据库配置或到「简道云接口」页面测试连接。</span></div>';
  }

  // ===== 初始化 =====
  function init() {
    loadEmployees();
    loadRules();
  }

  function loadEmployees() {
    fetch('/api/db/employees', { method: 'GET' })
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (res.success && res.data && res.data.length > 0) {
          employees = res.data;
        } else {
          employees = D.EMPLOYEES.slice(); // 回退 Mock
        }
        renderEmployees();
      })
      .catch(function () { employees = D.EMPLOYEES.slice(); renderEmployees(); });
  }

  return {
    init: init,
    switchPage: switchPage,
    showBindModal: showBindModal,
    closeBindModal: closeBindModal,
    confirmBind: confirmBind,
    showAddEmployee: showAddEmployee,
    closeAddEmp: closeAddEmp,
    confirmAddEmp: confirmAddEmp,
    saveRules: saveRules,
    resetRules: resetRules,
    applyJson: applyJson,
    syncFormToJson: syncFormToJson,
    loadJdyConfig: loadJdyConfig,
    saveJdyConfig: saveJdyConfig,
    testJdyConnection: testJdyConnection,
  };
})();

Admin.init();
