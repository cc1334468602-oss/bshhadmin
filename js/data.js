/**
 * data.js - 助贷管理后台 基础数据层
 *
 * 仅保留后台职能所需数据：员工账号、简道云业务员映射、银行产品目录、匹配规则默认值。
 * 客户数据不在此处，一律通过 /api/jdy/customers 从简道云实时拉取。
 */
window.MOCK_DATA = (function () {

  // ============ 员工数据 ============
  const EMPLOYEES = [
    { id: 'E001', name: '张明远', phone: '13800138001', department: '业务一部', password: '123456', jiandaoyunBound: true,  jiandaoyunAccount: '张明远（简道云）', avatar: '' },
    { id: 'E002', name: '李晓燕', phone: '13900139002', department: '业务二部', password: '123456', jiandaoyunBound: true,  jiandaoyunAccount: '李晓燕（简道云）', avatar: '' },
    { id: 'E003', name: '王海涛', phone: '13700137003', department: '业务一部', password: '123456', jiandaoyunBound: false, jiandaoyunAccount: '',                avatar: '' },
    { id: 'E004', name: '陈思琪', phone: '13600136004', department: '业务三部', password: '123456', jiandaoyunBound: false, jiandaoyunAccount: '',                avatar: '' },
  ];

  // 简道云业务员列表（供管理员绑定用）
  const JIANDAOYUN_USERS = [
    { id: 'JDY001', name: '张明远', workId: 'BZ001' },
    { id: 'JDY002', name: '李晓燕', workId: 'BZ002' },
    { id: 'JDY003', name: '王海涛', workId: 'BZ003' },
    { id: 'JDY004', name: '陈思琪', workId: 'BZ004' },
    { id: 'JDY005', name: '刘建国', workId: 'BZ005' },
    { id: 'JDY006', name: '赵雅琴', workId: 'BZ006' },
  ];

  // ============ 银行信贷产品 (12) ============
  // 后台用于规则配置时的银行类型参考与产品数统计
  const PRODUCTS = [
    // --- 国有大行 ---
    { id: 'P01', name: '融e借',       bank: '工商银行', bankType: '国有大行',   type: '信用贷', minAmt: 60000,  maxAmt: 800000,  minRate: 3.6, maxRate: 5.6, terms: [12,24,36], req: { minCredit: 650, minIncome: 5000,  maxDebtRatio: 50, collateral: false, minYears: 1 }, features: ['纯信用无抵押','线上审批','随借随还'] },
    { id: 'P02', name: '快贷',         bank: '建设银行', bankType: '国有大行',   type: '信用贷', minAmt: 50000,  maxAmt: 500000,  minRate: 3.7, maxRate: 5.8, terms: [12,24,36], req: { minCredit: 640, minIncome: 4500,  maxDebtRatio: 55, collateral: false, minYears: 1 }, features: ['秒批秒贷','按日计息','提前还款无手续费'] },
    { id: 'P03', name: '网捷贷',       bank: '农业银行', bankType: '国有大行',   type: '信用贷', minAmt: 30000,  maxAmt: 300000,  minRate: 3.8, maxRate: 6.0, terms: [12,24,36], req: { minCredit: 630, minIncome: 4000,  maxDebtRatio: 55, collateral: false, minYears: 1 }, features: ['自助申请','自动审批','循环使用'] },
    { id: 'P04', name: '中银E贷',      bank: '中国银行', bankType: '国有大行',   type: '信用贷', minAmt: 50000,  maxAmt: 300000,  minRate: 3.9, maxRate: 6.2, terms: [12,24,36], req: { minCredit: 640, minIncome: 5000,  maxDebtRatio: 50, collateral: false, minYears: 1 }, features: ['全流程线上','实时审批','灵活还款'] },
    // --- 股份制银行 ---
    { id: 'P05', name: '闪电贷',       bank: '招商银行', bankType: '股份制银行', type: '信用贷', minAmt: 20000,  maxAmt: 300000,  minRate: 4.2, maxRate: 7.2, terms: [12,24,36,48], req: { minCredit: 620, minIncome: 4000,  maxDebtRatio: 60, collateral: false, minYears: 1 }, features: ['最快60秒到账','受邀客户专享','支持提前还款'] },
    { id: 'P06', name: '消费微贷',     bank: '民生银行', bankType: '股份制银行', type: '信用贷', minAmt: 30000,  maxAmt: 500000,  minRate: 4.5, maxRate: 7.8, terms: [12,24,36], req: { minCredit: 610, minIncome: 3500,  maxDebtRatio: 60, collateral: false, minYears: 1 }, features: ['额度高','期限灵活','线上申请'] },
    { id: 'P07', name: '新一贷',       bank: '平安银行', bankType: '股份制银行', type: '信用贷', minAmt: 30000,  maxAmt: 500000,  minRate: 4.9, maxRate: 8.5, terms: [12,24,36], req: { minCredit: 600, minIncome: 4000,  maxDebtRatio: 65, collateral: false, minYears: 1 }, features: ['门槛低','审批快','用途广泛'] },
    { id: 'P08', name: '兴闪贷',       bank: '兴业银行', bankType: '股份制银行', type: '信用贷', minAmt: 20000,  maxAmt: 300000,  minRate: 4.3, maxRate: 7.5, terms: [12,24,36], req: { minCredit: 620, minIncome: 4000,  maxDebtRatio: 60, collateral: false, minYears: 1 }, features: ['线上秒批','循环额度','按日计息'] },
    { id: 'P09', name: '信金贷',       bank: '中信银行', bankType: '股份制银行', type: '信用贷', minAmt: 30000,  maxAmt: 300000,  minRate: 4.4, maxRate: 7.6, terms: [12,24,36], req: { minCredit: 620, minIncome: 4500,  maxDebtRatio: 55, collateral: false, minYears: 1 }, features: ['快速审批','灵活期限','随借随还'] },
    // --- 消费金融 / 兜底机构 ---
    { id: 'P10', name: '好期贷',       bank: '招联金融', bankType: '消费金融',   type: '信用贷', minAmt: 5000,   maxAmt: 200000,  minRate: 7.2, maxRate: 14.6, terms: [3,6,12,24,36], req: { minCredit: 560, minIncome: 2500,  maxDebtRatio: 75, collateral: false, minYears: 0 }, features: ['门槛低','放款快','支持分期'] },
    { id: 'P11', name: '乐享贷',       bank: '中银消费金融', bankType: '消费金融', type: '信用贷', minAmt: 10000,  maxAmt: 200000,  minRate: 8.5, maxRate: 15.4, terms: [6,12,24,36], req: { minCredit: 550, minIncome: 2000,  maxDebtRatio: 80, collateral: false, minYears: 0 }, features: ['信用贷','额度灵活','快速放款'] },
    { id: 'P12', name: '经营抵押贷',   bank: '建设银行', bankType: '国有大行',   type: '抵押贷', minAmt: 200000, maxAmt: 5000000, minRate: 3.4, maxRate: 4.8, terms: [12,24,36,60,120], req: { minCredit: 600, minIncome: 8000,  maxDebtRatio: 60, collateral: true,  minYears: 2 }, features: ['额度高','利率低','支持房产/商铺抵押'] },
  ];

  // ============ 匹配规则配置（后台可编辑，前台读取执行） ============
  const MATCH_RULES = {
    // 优先推荐档位
    preferred: {
      minCreditScore: 650,
      maxDebtRatio: 55,
      bankTypes: ['国有大行'],
      rateCeiling: 6.0,
    },
    // 备选方案档位
    backup: {
      minCreditScore: 600,
      maxDebtRatio: 65,
      bankTypes: ['国有大行', '股份制银行'],
      rateCeiling: 8.5,
    },
    // 兜底方案档位
    fallback: {
      minCreditScore: 500,
      maxDebtRatio: 80,
      bankTypes: ['消费金融'],
      rateCeiling: 20,
    },
    // 额度建议倍数（月收入倍数）
    amountMultiplier: { preferred: 30, backup: 20, fallback: 10 },
  };

  return { EMPLOYEES, JIANDAOYUN_USERS, PRODUCTS, MATCH_RULES };
})();
