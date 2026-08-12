/**
 * rules.js - 匹配规则配置页面逻辑
 */
window.Page = (function () {
  'use strict';

  const D = window.MOCK_DATA;
  let rules = JSON.parse(JSON.stringify(D.MATCH_RULES));

  function $(id) { return document.getElementById(id); }

  function init() {
    loadRules();
  }

  function loadRules() {
    fetch('/api/db/match-rules', { method: 'GET' })
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (res.success && res.data) {
          rules = res.data;
          D.MATCH_RULES = JSON.parse(JSON.stringify(res.data));
        }
        loadRulesToForm();
      })
      .catch(function () { loadRulesToForm(); });
  }

  function loadRulesToForm() {
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

    $('ruleJsonEditor').value = JSON.stringify(rules, null, 2);
  }

  function saveRules() {
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

    D.MATCH_RULES = JSON.parse(JSON.stringify(rules));
    $('ruleJsonEditor').value = JSON.stringify(rules, null, 2);

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
    saveRules();
  }

  return {
    init: init,
    saveRules: saveRules,
    resetRules: resetRules,
    applyJson: applyJson,
    syncFormToJson: syncFormToJson,
  };
})();
