/**
 * jdyapi.js - 简道云接口配置页面逻辑
 */
window.Page = (function () {
  'use strict';

  function $(id) { return document.getElementById(id); }

  function init() {
    loadJdyConfig();
  }

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

  return {
    init: init,
    loadJdyConfig: loadJdyConfig,
    saveJdyConfig: saveJdyConfig,
    testJdyConnection: testJdyConnection,
  };
})();
