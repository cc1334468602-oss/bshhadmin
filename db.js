/**
 * db.js - bshh 前台 MySQL 数据访问层
 *
 * 设计要点：
 *  - 通过环境变量连接 MySQL：DB_HOST / DB_PORT / DB_USER / DB_PASS / DB_NAME
 *  - 使用 mysql2 连接池，自动处理连接复用
 *  - 默认兜底：若未配置或连接失败，getStatus() 返回 false，上层接口回退到 Mock/简道云
 *  - 首次启动自动播种默认数据（产品库、匹配规则、4 个演示员工）
 *
 * 注意：本文件只提供"连接 + 基础工具"，具体 SQL 写在 server.js 中，便于维护。
 */

const crypto = require('crypto');

// mysql2 在部署时通过 npm install 安装（deploy-ecs.sh 已配置 npmmirror 镜像）
let mysql = null;
try { mysql = require('mysql2/promise'); } catch (e) { mysql = null; }

// 注意：本函数每次调用都实时读取 process.env。
// 原因：server.js 先 require('./db')，之后才执行 loadDotEnv() 加载 .env。
// 若在模块加载时把配置缓存成常量，密码会被早期捕获为空串——此时 isConfigured()
// 看 process.env.DB_PASS 却显示"已启用"，于是 MySQL 以空密码连接，报
// "Access denied ... (using password: NO)"。故改为懒加载，建连时才读真实值。
function getDbConfig() {
  return {
    host:     process.env.DB_HOST || '127.0.0.1',
    port:     parseInt(process.env.DB_PORT, 10) || 3306,
    user:     process.env.DB_USER || 'bshh_user',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'bshh_db',
    waitForConnections: true,
    connectionLimit: 5,
    charset: 'utf8mb4',
  };
}

let pool = null;
let available = false;

function isConfigured() {
  // 必须显式配置 DB_HOST 且密码非空，才认为启用了数据库
  return !!process.env.DB_HOST && !!process.env.DB_PASS && mysql;
}

function getPool() {
  if (!isConfigured()) return null;
  if (!pool) {
    try {
      pool = mysql.createPool(getDbConfig());
    } catch (e) {
      console.error('[DB] 连接池创建失败：', e.message);
      return null;
    }
  }
  return pool;
}

/**
 * 执行 SQL。未配置数据库时直接 reject，由调用方回退 Mock。
 */
async function query(sql, params) {
  const p = getPool();
  if (!p) throw new Error('数据库未启用（请在 .env 配置 DB_HOST/DB_USER/DB_PASS/DB_NAME）');
  const [rows] = await p.execute(sql, params || []);
  return rows;
}

async function getStatus() {
  if (!isConfigured()) return { enabled: false, reason: '未配置 DB_HOST/DB_PASS' };
  try {
    const p = getPool();
    await p.execute('SELECT 1');
    available = true;
    return { enabled: true, connected: true };
  } catch (e) {
    available = false;
    return { enabled: true, connected: false, reason: e.message };
  }
}

// ---------------- 密码哈希 ----------------
// 采用 sha256(phone + ':' + plain) 作为演示用的哈希（内部系统、非公网直连）。
// 如需更强安全性可后续替换为 bcrypt。
function hashPwd(phone, plain) {
  return crypto.createHash('sha256').update(phone + ':' + plain).digest('hex');
}
function verifyPwd(phone, plain, hash) {
  if (!hash) return false;
  return hashPwd(phone, plain) === hash;
}

// 后台管理员账号哈希（与员工哈希盐不同，避免混淆）
function hashAdminPwd(username, plain) {
  return crypto.createHash('sha256').update('admin:' + username + ':' + plain).digest('hex');
}
function verifyAdminPwd(username, plain, hash) {
  if (!hash) return false;
  return hashAdminPwd(username, plain) === hash;
}

// ---------------- 默认数据播种 ----------------
const DEFAULT_PRODUCTS = [
  { id:'P01', name:'融e借', bank:'工商银行', bankType:'国有大行', type:'信用贷', minAmt:60000, maxAmt:800000, minRate:3.6, maxRate:5.6, terms:[12,24,36], req:{minCredit:650,minIncome:5000,maxDebtRatio:50,collateral:false,minYears:1}, features:['纯信用无抵押','线上审批','随借随还'] },
  { id:'P02', name:'快贷', bank:'建设银行', bankType:'国有大行', type:'信用贷', minAmt:50000, maxAmt:500000, minRate:3.7, maxRate:5.8, terms:[12,24,36], req:{minCredit:640,minIncome:4500,maxDebtRatio:55,collateral:false,minYears:1}, features:['秒批秒贷','按日计息','提前还款无手续费'] },
  { id:'P03', name:'网捷贷', bank:'农业银行', bankType:'国有大行', type:'信用贷', minAmt:30000, maxAmt:300000, minRate:3.8, maxRate:6.0, terms:[12,24,36], req:{minCredit:630,minIncome:4000,maxDebtRatio:55,collateral:false,minYears:1}, features:['自助申请','自动审批','循环使用'] },
  { id:'P04', name:'中银E贷', bank:'中国银行', bankType:'国有大行', type:'信用贷', minAmt:50000, maxAmt:300000, minRate:3.9, maxRate:6.2, terms:[12,24,36], req:{minCredit:640,minIncome:5000,maxDebtRatio:50,collateral:false,minYears:1}, features:['全流程线上','实时审批','灵活还款'] },
  { id:'P05', name:'闪电贷', bank:'招商银行', bankType:'股份制银行', type:'信用贷', minAmt:20000, maxAmt:300000, minRate:4.2, maxRate:7.2, terms:[12,24,36,48], req:{minCredit:620,minIncome:4000,maxDebtRatio:60,collateral:false,minYears:1}, features:['最快60秒到账','受邀客户专享','支持提前还款'] },
  { id:'P06', name:'消费微贷', bank:'民生银行', bankType:'股份制银行', type:'信用贷', minAmt:30000, maxAmt:500000, minRate:4.5, maxRate:7.8, terms:[12,24,36], req:{minCredit:610,minIncome:3500,maxDebtRatio:60,collateral:false,minYears:1}, features:['额度高','期限灵活','线上申请'] },
  { id:'P07', name:'新一贷', bank:'平安银行', bankType:'股份制银行', type:'信用贷', minAmt:30000, maxAmt:500000, minRate:4.9, maxRate:8.5, terms:[12,24,36], req:{minCredit:600,minIncome:4000,maxDebtRatio:65,collateral:false,minYears:1}, features:['门槛低','审批快','用途广泛'] },
  { id:'P08', name:'兴闪贷', bank:'兴业银行', bankType:'股份制银行', type:'信用贷', minAmt:20000, maxAmt:300000, minRate:4.3, maxRate:7.5, terms:[12,24,36], req:{minCredit:620,minIncome:4000,maxDebtRatio:60,collateral:false,minYears:1}, features:['线上秒批','循环额度','按日计息'] },
  { id:'P09', name:'信金贷', bank:'中信银行', bankType:'股份制银行', type:'信用贷', minAmt:30000, maxAmt:300000, minRate:4.4, maxRate:7.6, terms:[12,24,36], req:{minCredit:620,minIncome:4500,maxDebtRatio:55,collateral:false,minYears:1}, features:['快速审批','灵活期限','随借随还'] },
  { id:'P10', name:'好期贷', bank:'招联金融', bankType:'消费金融', type:'信用贷', minAmt:5000, maxAmt:200000, minRate:7.2, maxRate:14.6, terms:[3,6,12,24,36], req:{minCredit:560,minIncome:2500,maxDebtRatio:75,collateral:false,minYears:0}, features:['门槛低','放款快','支持分期'] },
  { id:'P11', name:'乐享贷', bank:'中银消费金融', bankType:'消费金融', type:'信用贷', minAmt:10000, maxAmt:200000, minRate:8.5, maxRate:15.4, terms:[6,12,24,36], req:{minCredit:550,minIncome:2000,maxDebtRatio:80,collateral:false,minYears:0}, features:['信用贷','额度灵活','快速放款'] },
  { id:'P12', name:'经营抵押贷', bank:'建设银行', bankType:'国有大行', type:'抵押贷', minAmt:200000, maxAmt:5000000, minRate:3.4, maxRate:4.8, terms:[12,24,36,60,120], req:{minCredit:600,minIncome:8000,maxDebtRatio:60,collateral:true,minYears:2}, features:['额度高','利率低','支持房产/商铺抵押'] },
];

const DEFAULT_RULES = {
  preferred: { minCreditScore:650, maxDebtRatio:55, bankTypes:['国有大行'], rateCeiling:6.0 },
  backup:    { minCreditScore:600, maxDebtRatio:65, bankTypes:['国有大行','股份制银行'], rateCeiling:8.5 },
  fallback:  { minCreditScore:500, maxDebtRatio:80, bankTypes:['消费金融'], rateCeiling:20 },
  amountMultiplier: { preferred:30, backup:20, fallback:10 },
};

const DEFAULT_EMPLOYEES = [
  { id:'E001', name:'张明远', phone:'13800138001', department:'业务一部', jiandaoyunBound:true,  jiandaoyunAccount:'张明远（简道云）' },
  { id:'E002', name:'李晓燕', phone:'13900139002', department:'业务二部', jiandaoyunBound:true,  jiandaoyunAccount:'李晓燕（简道云）' },
  { id:'E003', name:'王海涛', phone:'13700137003', department:'业务一部', jiandaoyunBound:false, jiandaoyunAccount:'' },
  { id:'E004', name:'陈思琪', phone:'13600136004', department:'业务三部', jiandaoyunBound:false, jiandaoyunAccount:'' },
];

const DEFAULT_ADMIN = { id:'admin', username:'admin', name:'超级管理员', password:'111111', role:'super' };

async function ensureSeed() {
  if (!isConfigured()) return false;
  try {
    const st = await getStatus();
    if (!st.connected) return false;

    const prodCount = await query('SELECT COUNT(*) AS c FROM products');
    if (prodCount[0].c === 0) {
      for (const p of DEFAULT_PRODUCTS) {
        await query(
          'INSERT INTO products (id,name,bank,bank_type,type,min_amt,max_amt,min_rate,max_rate,terms,req,features) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
          [p.id, p.name, p.bank, p.bankType, p.type, p.minAmt, p.maxAmt, p.minRate, p.maxRate,
           JSON.stringify(p.terms), JSON.stringify(p.req), JSON.stringify(p.features)]
        );
      }
      console.log('[DB] 已播种 ' + DEFAULT_PRODUCTS.length + ' 个银行产品');
    }

    const ruleCount = await query('SELECT COUNT(*) AS c FROM match_rules');
    if (ruleCount[0].c === 0) {
      await query(
        'INSERT INTO match_rules (id,preferred,backup,fallback,amount_multiplier) VALUES (1,?,?,?,?)',
        [JSON.stringify(DEFAULT_RULES.preferred), JSON.stringify(DEFAULT_RULES.backup),
         JSON.stringify(DEFAULT_RULES.fallback), JSON.stringify(DEFAULT_RULES.amountMultiplier)]
      );
      console.log('[DB] 已播种默认匹配规则');
    }

    const empCount = await query('SELECT COUNT(*) AS c FROM employees');
    if (empCount[0].c === 0) {
      for (const e of DEFAULT_EMPLOYEES) {
        await query(
          'INSERT INTO employees (id,name,phone,password_hash,department,jiandaoyun_bound,jiandaoyun_account) VALUES (?,?,?,?,?,?,?)',
          [e.id, e.name, e.phone, hashPwd(e.phone, '123456'), e.department, e.jiandaoyunBound ? 1 : 0, e.jiandaoyunAccount]
        );
      }
      console.log('[DB] 已播种 ' + DEFAULT_EMPLOYEES.length + ' 个演示员工（默认密码 123456，请尽快修改）');
    }

    const adminCount = await query('SELECT COUNT(*) AS c FROM admin_users');
    if (adminCount[0].c === 0) {
      await query(
        'INSERT INTO admin_users (id,username,password_hash,name,role) VALUES (?,?,?,?,?)',
        [DEFAULT_ADMIN.id, DEFAULT_ADMIN.username, hashAdminPwd(DEFAULT_ADMIN.username, DEFAULT_ADMIN.password), DEFAULT_ADMIN.name, DEFAULT_ADMIN.role]
      );
      console.log('[DB] 已播种超级管理员账号 admin（默认密码 111111，请尽快修改）');
    }
    return true;
  } catch (e) {
    console.error('[DB] 播种失败：', e.message);
    return false;
  }
}

module.exports = {
  isConfigured, getPool, query, getStatus, ensureSeed, hashPwd, verifyPwd,
  hashAdminPwd, verifyAdminPwd, DEFAULT_ADMIN,
  DEFAULT_PRODUCTS, DEFAULT_RULES, DEFAULT_EMPLOYEES,
};
