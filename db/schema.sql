-- ============================================================
-- bshh / bshhadmin 共享数据库 schema
-- 数据库名：bshh_db
-- 说明：一张库被前台(bshh)与后台(bshhadmin)两个服务共用，
--      通过环境变量 DB_HOST/DB_PORT/DB_USER/DB_PASS/DB_NAME 连接。
-- 字符集：utf8mb4（支持中文与 emoji）
-- ============================================================

CREATE DATABASE IF NOT EXISTS `bshh_db`
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_general_ci;
USE `bshh_db`;

-- ---------------- 员工 / 登录账号 ----------------
CREATE TABLE IF NOT EXISTS `employees` (
  `id`                  VARCHAR(32)   NOT NULL,
  `name`                VARCHAR(64)   NOT NULL,
  `phone`               VARCHAR(20)   NOT NULL,
  `password_hash`       VARCHAR(128)  NOT NULL DEFAULT '',
  `department`          VARCHAR(64)   DEFAULT '',
  `avatar`              VARCHAR(255)  DEFAULT '',
  `jiandaoyun_bound`    TINYINT(1)    DEFAULT 0,
  `jiandaoyun_account`  VARCHAR(128)  DEFAULT '',
  `created_at`          DATETIME      DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_phone` (`phone`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------- 客户 ----------------
CREATE TABLE IF NOT EXISTS `customers` (
  `id`               VARCHAR(32)    NOT NULL,
  `name`             VARCHAR(64)    NOT NULL,
  `phone`            VARCHAR(20)    DEFAULT '',
  `gender`           VARCHAR(8)     DEFAULT '',
  `age`              INT            DEFAULT NULL,
  `marital`          VARCHAR(16)    DEFAULT '',
  `income`           DECIMAL(12,2)  DEFAULT 0,
  `employer`         VARCHAR(128)   DEFAULT '',
  `industry`         VARCHAR(64)    DEFAULT '',
  `years`            INT            DEFAULT 0,
  `assets`           TEXT,
  `liabilities`      TEXT,
  `credit_score`     INT            DEFAULT 0,
  `credit_desc`      VARCHAR(255)   DEFAULT '',
  `collateral`       TINYINT(1)     DEFAULT 0,
  `collateral_type`  VARCHAR(32)    DEFAULT '',
  `collateral_value` DECIMAL(14,2)  DEFAULT 0,
  `demand_amount`    DECIMAL(14,2)  DEFAULT 0,
  `status`           VARCHAR(16)    DEFAULT 'new',
  `assigned_to`      VARCHAR(32)    DEFAULT '',
  `tags`             JSON           DEFAULT NULL,
  `source`           VARCHAR(64)    DEFAULT '',
  `remark`           TEXT,
  `created_at`       DATETIME       DEFAULT CURRENT_TIMESTAMP,
  `updated_at`       DATETIME       DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_assigned` (`assigned_to`),
  KEY `idx_status` (`status`),
  KEY `idx_phone` (`phone`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------- 跟进记录 ----------------
CREATE TABLE IF NOT EXISTS `follow_ups` (
  `id`           VARCHAR(32) NOT NULL,
  `customer_id`  VARCHAR(32) NOT NULL,
  `employee_id`  VARCHAR(32) DEFAULT '',
  `note`         TEXT,
  `time`         DATETIME    DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_customer` (`customer_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------- 匹配记录 ----------------
CREATE TABLE IF NOT EXISTS `match_records` (
  `id`           VARCHAR(32) NOT NULL,
  `customer_id`  VARCHAR(32) NOT NULL,
  `employee_id`  VARCHAR(32) DEFAULT '',
  `banks`        VARCHAR(255) DEFAULT '',
  `note`         TEXT,
  `result`       JSON        DEFAULT NULL,
  `time`         DATETIME    DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_customer` (`customer_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------- 对话历史 ----------------
CREATE TABLE IF NOT EXISTS `conversations` (
  `id`            VARCHAR(32) NOT NULL,
  `employee_id`   VARCHAR(32) DEFAULT '',
  `customer_name` VARCHAR(64) DEFAULT '',
  `title`         VARCHAR(128) DEFAULT '',
  `messages`      JSON        NOT NULL,
  `created_at`    DATETIME    DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------- 系统通知 ----------------
CREATE TABLE IF NOT EXISTS `notifications` (
  `id`         VARCHAR(32) NOT NULL,
  `employee_id` VARCHAR(32) DEFAULT '',
  `type`       VARCHAR(32) DEFAULT 'system',
  `title`      VARCHAR(128) DEFAULT '',
  `content`    TEXT,
  `time`       DATETIME    DEFAULT CURRENT_TIMESTAMP,
  `is_read`    TINYINT(1)  DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_employee` (`employee_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------- 银行产品库 ----------------
CREATE TABLE IF NOT EXISTS `products` (
  `id`          VARCHAR(32)  NOT NULL,
  `name`        VARCHAR(64)  NOT NULL,
  `bank`        VARCHAR(64)  DEFAULT '',
  `bank_type`   VARCHAR(32)  DEFAULT '',
  `type`        VARCHAR(32)  DEFAULT '',
  `min_amt`     DECIMAL(14,2) DEFAULT 0,
  `max_amt`     DECIMAL(14,2) DEFAULT 0,
  `min_rate`    DECIMAL(5,2) DEFAULT 0,
  `max_rate`    DECIMAL(5,2) DEFAULT 0,
  `terms`       JSON         DEFAULT NULL,
  `req`         JSON         DEFAULT NULL,
  `features`    JSON         DEFAULT NULL,
  `created_at`  DATETIME     DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------- 匹配规则（全局一份） ----------------
CREATE TABLE IF NOT EXISTS `match_rules` (
  `id`                 INT         NOT NULL DEFAULT 1,
  `preferred`          JSON        NOT NULL,
  `backup`             JSON        NOT NULL,
  `fallback`           JSON        NOT NULL,
  `amount_multiplier`  JSON        NOT NULL,
  `updated_at`         DATETIME    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
