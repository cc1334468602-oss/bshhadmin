/**
 * dashboard.js - 数据概览页面逻辑
 *  客户统计优先来自 MySQL；数据库不可用时回退简道云实时拉取。
 */
window.Page = (function () {
  'use strict';

  const D = window.MOCK_DATA;
  let employees = D.EMPLOYEES.slice();

  function $(id) { return document.getElementById(id); }

  function init() {
    renderDashboard();
  }

  function renderDashboard() {
    // 员工数优先取最新列表
    fetch('/api/db/employees', { method: 'GET' })
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (res.success && res.data && res.data.length > 0) employees = res.data;
        else employees = D.EMPLOYEES.slice();
        $('statEmployees').textContent = employees.length;
        $('statBound').textContent = employees.filter(function (e) { return e.jiandaoyunBound; }).length;
      })
      .catch(function () {
        $('statEmployees').textContent = employees.length;
        $('statBound').textContent = employees.filter(function (e) { return e.jiandaoyunBound; }).length;
      });

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
          fetchJdyStats();
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

  return {
    init: init,
  };
})();
