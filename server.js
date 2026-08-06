/**
 * bshhadmin · 助贷管理后台 —— 后台服务
 *
 * 职责：托管 PC 后台页面 + 简道云凭证配置管理 + 连接测试 + 数据概览
 * 独占能力：写入共享配置文件（前台 bshh 只读该文件）
 *
 * 配置来源优先级：共享配置文件(JDY_CONFIG_PATH) > .env 环境变量
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

// ---- 环境变量加载：生产环境把密钥放 .env，不写进代码 ----
(function loadDotEnv() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) return;
  fs.readFileSync(envPath, 'utf-8').split('\n').forEach(function (line) {
    line = line.trim();
    if (!line || line.charAt(0) === '#') return;
    const idx = line.indexOf('=');
    if (idx < 0) return;
    const key = line.slice(0, idx).trim();
    const val = line.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = val;
  });
})();

const PORT = parseInt(process.env.PORT, 10) || 9192;
const HOST = process.env.HOST || '0.0.0.0';
const ROOT = __dirname;
const JDY_HOST = 'api.jiandaoyun.com';

// 共享配置文件：与前台 bshh 指向同一路径，此处写入后前台即时生效
const CONFIG_PATH = process.env.JDY_CONFIG_PATH
  ? path.resolve(process.env.JDY_CONFIG_PATH)
  : path.join(ROOT, 'jdy-config.json');

// 密钥一律从环境变量读取，代码里不留任何真实值，保证仓库可安全托管
const ENV_CONFIG = {
  apiKey: process.env.JDY_API_KEY || '',
  appId:  process.env.JDY_APP_ID  || '',
  entries: {
    customer:    process.env.JDY_ENTRY_CUSTOMER     || '',
    loan:        process.env.JDY_ENTRY_LOAN         || '',
    loanHistory: process.env.JDY_ENTRY_LOAN_HISTORY || '',
    cashFlow:    process.env.JDY_ENTRY_CASHFLOW     || '',
    intention:   process.env.JDY_ENTRY_INTENTION    || '',
    followUp:    process.env.JDY_ENTRY_FOLLOWUP     || '',
    repayment:   process.env.JDY_ENTRY_REPAYMENT    || '',
  },
};

function loadConfig() {
  if (fs.existsSync(CONFIG_PATH)) {
    try {
      const fileCfg = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
      return {
        apiKey: fileCfg.apiKey || ENV_CONFIG.apiKey,
        appId:  fileCfg.appId  || ENV_CONFIG.appId,
        entries: Object.assign({}, ENV_CONFIG.entries, fileCfg.entries || {}),
      };
    } catch (e) {
      console.error('[配置] 共享配置文件解析失败，回退到 .env：', e.message);
    }
  }
  return ENV_CONFIG;
}

function saveConfig(cfg) {
  const dir = path.dirname(CONFIG_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), 'utf-8');
  // 配置文件含明文密钥，收紧权限（Windows 下会静默失败，不影响流程）
  try { fs.chmodSync(CONFIG_PATH, 0o600); } catch (e) {}
  console.log('[配置] 已写入共享配置 ' + CONFIG_PATH + '，前台服务下次请求即生效');
}

(function checkConfigOnBoot() {
  const cfg = loadConfig();
  console.log('[配置] 共享配置路径：' + CONFIG_PATH);
  if (!cfg.apiKey || !cfg.appId) {
    console.warn('[警告] 未检测到简道云凭证，请登录后台「简道云接口」页面配置。');
  } else {
    console.log('[配置] 简道云凭证已就绪');
  }
})();

const FIELD_MAP_CUSTOMER = {
  '_widget_1771923209993': 'name',
  '_widget_1771923209994': 'phone',
  '_widget_1771985710736': 'level',
  '_widget_1772089340773': 'status',
  '_widget_1771923209996': 'source',
  '_widget_1771983232211': 'salesperson',
  '_widget_1772068830044': 'company',
  '_widget_1772068830054': 'address',
  '_widget_1772068830049': 'requiredAmount',
  '_widget_1772068830045': 'approvedAmount',
  '_widget_1772068830046': 'assets',
  '_widget_1772068830047': 'liabilities',
  '_widget_1776130440780': 'remark',
  '_widget_1776130440771': 'remark2',
  '_widget_1776130780636': 'remark3',
  '_widget_1772173381235': 'numField1',
  '_widget_1772176092127': 'numField2',
};

function mapCustomer(raw) {
  const obj = { _id: raw._id, createTime: raw.createTime, updateTime: raw.updateTime };
  for (const k in FIELD_MAP_CUSTOMER) {
    if (raw[k] !== undefined) {
      let val = raw[k];
      if (k === '_widget_1771983232211' && val && typeof val === 'object') {
        val = val.name || '';
      }
      if (k === '_widget_1772068830054' && val && typeof val === 'object') {
        val = [val.province, val.city, val.district, val.detail].filter(Boolean).join('');
      }
      if (Array.isArray(val) && val.length > 0 && val[0].url) {
        val = val.map(function(f) { return { name: f.name, url: f.url }; });
      }
      obj[FIELD_MAP_CUSTOMER[k]] = val;
    }
  }
  if (!obj.name) obj.name = '未填写';
  if (!obj.phone) obj.phone = '';
  if (!obj.status) obj.status = '活跃状态';
  obj.requiredAmount = parseFloat(obj.requiredAmount) || 0;
  obj.approvedAmount = parseFloat(obj.approvedAmount) || 0;

  var statusMap = {
    '静默状态': '新线索', '活跃状态': '跟进中',
    '已签约': '已匹配', '审批中': '审批中',
    '已拒绝': '已拒绝', '已放款': '已匹配', '已完成': '已匹配',
  };
  obj.statusLabel = statusMap[obj.status] || obj.status;
  return obj;
}

function jdyRequest(entryId, filter, limit, config) {
  return new Promise(function(resolve, reject) {
    if (!config.apiKey || !config.appId) {
      return reject(new Error('简道云凭证未配置，请先在「简道云接口」页面填写'));
    }
    if (!entryId) {
      return reject(new Error('目标表单 entry_id 未配置'));
    }
    var body = JSON.stringify({
      app_id: config.appId,
      entry_id: entryId,
      fields: ['*'],
      limit: limit || 100,
      filter: filter || {},
    });
    var options = {
      hostname: JDY_HOST,
      port: 443,
      path: '/api/v5/app/entry/data/list',
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + config.apiKey,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };
    var req = https.request(options, function(res) {
      var chunks = '';
      res.on('data', function(d) { chunks += d; });
      res.on('end', function() {
        try { resolve(JSON.parse(chunks)); }
        catch (e) { reject(new Error('Parse error: ' + chunks.substring(0, 200))); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function handleApi(req, res, urlPath, body) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (urlPath === '/api/health') {
    var cfgH = loadConfig();
    res.end(JSON.stringify({
      status: 'ok',
      app: 'bshh-admin',
      uptime: Math.round(process.uptime()),
      time: new Date().toISOString(),
      node: process.version,
      configPath: CONFIG_PATH,
      jdyReady: !!(cfgH.apiKey && cfgH.appId),
    }));
    return;
  }

  // 读取配置：不返回 apiKey 明文，只告知是否已设置
  if (urlPath === '/api/jdy/config' && req.method === 'GET') {
    var cfg = loadConfig();
    res.end(JSON.stringify({
      appId: cfg.appId,
      entries: cfg.entries,
      hasApiKey: !!cfg.apiKey,
      configPath: CONFIG_PATH,
    }));
    return;
  }

  // 写入配置：后台独占能力，写完前台即时生效
  if (urlPath === '/api/jdy/config' && req.method === 'POST') {
    try {
      var newCfg = JSON.parse(body);
      var old = loadConfig();
      if (newCfg.apiKey) old.apiKey = newCfg.apiKey;
      if (newCfg.appId) old.appId = newCfg.appId;
      if (newCfg.entries) old.entries = Object.assign(old.entries, newCfg.entries);
      saveConfig(old);
      res.end(JSON.stringify({ success: true, configPath: CONFIG_PATH }));
    } catch (e) {
      res.end(JSON.stringify({ success: false, error: e.message }));
    }
    return;
  }

  if (urlPath === '/api/jdy/test' && req.method === 'POST') {
    var cfg2 = loadConfig();
    jdyRequest(cfg2.entries.customer, {}, 1, cfg2).then(function(r) {
      if (r.data) {
        res.end(JSON.stringify({ success: true, count: r.data.length }));
      } else {
        res.end(JSON.stringify({ success: false, error: r.msg || JSON.stringify(r).substring(0, 200) }));
      }
    }).catch(function(e) {
      res.end(JSON.stringify({ success: false, error: e.message }));
    });
    return;
  }

  // 数据概览：后台统计客户总数与状态分布
  if (urlPath === '/api/jdy/customers' && req.method === 'POST') {
    var cfg3 = loadConfig();
    var params = {};
    try { params = JSON.parse(body || '{}'); } catch (e) {}
    jdyRequest(cfg3.entries.customer, {}, params.limit || 100, cfg3).then(function(r) {
      var customers = (r.data || []).map(mapCustomer);
      var byStatus = {};
      customers.forEach(function(c) {
        byStatus[c.statusLabel] = (byStatus[c.statusLabel] || 0) + 1;
      });
      res.end(JSON.stringify({
        success: true,
        data: customers,
        total: customers.length,
        byStatus: byStatus,
      }));
    }).catch(function(e) {
      res.end(JSON.stringify({ success: false, error: e.message }));
    });
    return;
  }

  res.writeHead(404);
  res.end(JSON.stringify({ error: 'Unknown API: ' + urlPath }));
}

var MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

var server = http.createServer(function(req, res) {
  var urlPath = req.url.split('?')[0];
  if (urlPath === '/') urlPath = '/index.html';

  if (urlPath.startsWith('/api/')) {
    var body = '';
    req.on('data', function(d) { body += d; });
    req.on('end', function() { handleApi(req, res, urlPath, body); });
    return;
  }

  // 禁止通过 HTTP 读取配置文件本身
  if (urlPath.indexOf('jdy-config.json') >= 0 || urlPath.indexOf('.env') >= 0) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('403 Forbidden');
    return;
  }

  var safePath = path.normalize(urlPath).replace(/^(\.\.[\/\\])+/, '');
  var filePath = path.join(ROOT, safePath);
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('403 Forbidden');
    return;
  }

  var ext = path.extname(filePath);
  var contentType = MIME[ext] || 'application/octet-stream';
  fs.readFile(filePath, function(err, data) {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found: ' + urlPath);
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(data);
    }
  });
});

server.listen(PORT, HOST, function() {
  console.log('[' + new Date().toISOString() + '] bshhadmin 后台服务 http://' + HOST + ':' + PORT);
  console.log('配置接口: /api/jdy/config (GET/POST), /api/jdy/test');
  console.log('健康检查: /api/health');
});

process.on('uncaughtException', function (err) {
  console.error('[uncaughtException]', err && err.stack ? err.stack : err);
});
process.on('unhandledRejection', function (err) {
  console.error('[unhandledRejection]', err && err.stack ? err.stack : err);
});
