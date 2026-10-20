-- ============================================================================
-- 京能协同平台 · 数据库设计 DDL
-- 目标库：MySQL 8.0+ / 引擎 InnoDB / 字符集 utf8mb4 / 排序规则 utf8mb4_unicode_ci
-- 用法：mysql -u root -p < schema.sql   （可直接执行建库）
-- 约定：
--   1. 所有实体表含 created_at / updated_at；记录型表（审批记录/评论/日志等）仅 created_at
--   2. 逻辑删除统一用 deleted_at（NULL=未删除），查询时务必过滤 deleted_at IS NULL
--   3. 金额 DECIMAL(14,2)，数量 DECIMAL(12,3)，单价 DECIMAL(14,2)
--   4. 外键默认 RESTRICT；明细随主单删除的用 ON DELETE CASCADE
-- ============================================================================

CREATE DATABASE IF NOT EXISTS jn_collab
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
USE jn_collab;

-- ============================================================================
-- 一、组织与权限
-- ============================================================================

-- 部门树（parent_id 为 NULL 表示根部门）
CREATE TABLE departments (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '部门ID',
  parent_id     BIGINT UNSIGNED NULL DEFAULT NULL COMMENT '上级部门ID，NULL=根部门',
  name          VARCHAR(64) NOT NULL COMMENT '部门名称，如：钣金车间',
  code          VARCHAR(32) NOT NULL COMMENT '部门编码，如：BJ（钣金）',
  sort          INT NOT NULL DEFAULT 0 COMMENT '同级排序，越小越靠前',
  leader_user_id BIGINT UNSIGNED NULL DEFAULT NULL COMMENT '部门负责人用户ID（不建外键，避免循环引用）',
  status        TINYINT NOT NULL DEFAULT 1 COMMENT '状态：1=启用，0=停用',
  remark        VARCHAR(255) NULL DEFAULT NULL COMMENT '备注',
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  deleted_at    DATETIME NULL DEFAULT NULL COMMENT '逻辑删除时间，NULL=未删除',
  PRIMARY KEY (id),
  UNIQUE KEY uk_code (code),
  KEY idx_parent (parent_id),
  CONSTRAINT fk_dept_parent FOREIGN KEY (parent_id) REFERENCES departments (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='部门表（树形结构）';

-- 用户
CREATE TABLE users (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '用户ID',
  username      VARCHAR(32) NOT NULL COMMENT '登录名，全局唯一',
  password_hash VARCHAR(255) NOT NULL COMMENT '密码哈希（bcrypt/argon2，禁止存明文）',
  real_name     VARCHAR(32) NOT NULL COMMENT '姓名',
  employee_no   VARCHAR(32) NULL DEFAULT NULL COMMENT '工号，全局唯一，可空',
  dept_id       BIGINT UNSIGNED NULL DEFAULT NULL COMMENT '所属部门ID',
  phone         VARCHAR(20) NULL DEFAULT NULL COMMENT '手机号',
  email         VARCHAR(64) NULL DEFAULT NULL COMMENT '邮箱',
  avatar_url    VARCHAR(255) NULL DEFAULT NULL COMMENT '头像URL',
  status        TINYINT NOT NULL DEFAULT 1 COMMENT '状态：1=正常，0=停用，2=锁定',
  last_login_at DATETIME NULL DEFAULT NULL COMMENT '最后登录时间',
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  deleted_at    DATETIME NULL DEFAULT NULL COMMENT '逻辑删除时间，NULL=未删除',
  PRIMARY KEY (id),
  UNIQUE KEY uk_username (username),
  UNIQUE KEY uk_employee_no (employee_no),
  KEY idx_dept (dept_id),
  CONSTRAINT fk_user_dept FOREIGN KEY (dept_id) REFERENCES departments (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户表';

-- 角色
CREATE TABLE roles (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '角色ID',
  code       VARCHAR(32) NOT NULL COMMENT '角色编码，如：admin/salesman/approver',
  name       VARCHAR(32) NOT NULL COMMENT '角色名称，如：系统管理员',
  remark     VARCHAR(255) NULL DEFAULT NULL COMMENT '备注',
  status     TINYINT NOT NULL DEFAULT 1 COMMENT '状态：1=启用，0=停用',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  deleted_at DATETIME NULL DEFAULT NULL COMMENT '逻辑删除时间，NULL=未删除',
  PRIMARY KEY (id),
  UNIQUE KEY uk_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='角色表';

-- 用户-角色关联
CREATE TABLE user_roles (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '关联ID',
  user_id    BIGINT UNSIGNED NOT NULL COMMENT '用户ID',
  role_id    BIGINT UNSIGNED NOT NULL COMMENT '角色ID',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (id),
  UNIQUE KEY uk_user_role (user_id, role_id),
  KEY idx_role (role_id),
  CONSTRAINT fk_ur_user FOREIGN KEY (user_id) REFERENCES users (id),
  CONSTRAINT fk_ur_role FOREIGN KEY (role_id) REFERENCES roles (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户角色关联表';

-- 应用注册表（平台可插拔应用：报价/价格库/图纸分解/快速报价…）
-- 前端侧边栏菜单由此表动态渲染；新应用上线只需 INSERT 一行，无需改平台代码
CREATE TABLE apps (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '应用ID',
  code       VARCHAR(32) NOT NULL COMMENT '应用编码，全局唯一，如：quote/price/drawing/quickquote；新表前缀用 app_{code}_',
  name       VARCHAR(32) NOT NULL COMMENT '应用名称，如：报价管理',
  icon       VARCHAR(32) NULL DEFAULT NULL COMMENT '图标名（前端图标库 key）',
  route      VARCHAR(128) NOT NULL COMMENT '前端路由，如：/app/quote',
  sort       INT NOT NULL DEFAULT 0 COMMENT '菜单排序，越小越靠前',
  status     TINYINT NOT NULL DEFAULT 1 COMMENT '状态：1=启用（显示在菜单），0=停用',
  remark     VARCHAR(255) NULL DEFAULT NULL COMMENT '备注',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  deleted_at DATETIME NULL DEFAULT NULL COMMENT '逻辑删除时间，NULL=未删除',
  PRIMARY KEY (id),
  UNIQUE KEY uk_code (code),
  KEY idx_status_sort (status, sort)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='应用注册表（平台插件化核心）';

-- 应用权限点（细粒度权限，如 quote:approve 报价审批）
CREATE TABLE app_permissions (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '权限点ID',
  app_id     BIGINT UNSIGNED NOT NULL COMMENT '所属应用ID',
  perm_code  VARCHAR(64) NOT NULL COMMENT '权限编码，如：quote:approve',
  perm_name  VARCHAR(64) NOT NULL COMMENT '权限名称，如：报价审批',
  remark     VARCHAR(255) NULL DEFAULT NULL COMMENT '备注',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (id),
  UNIQUE KEY uk_app_perm (app_id, perm_code),
  CONSTRAINT fk_ap_app FOREIGN KEY (app_id) REFERENCES apps (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='应用权限点表';

-- ============================================================================
-- 五、价格库（app_code = price；与旧版钣金价格库UI概念对齐）
--   materials      = 物料库（材料牌号/厚度/单价·元/吨）
--   cabinets       = 箱柜库（箱柜型号/箱规）
--   cabinet_bom    = 箱柜BOM明细（部件→材料→展开面积）
--   process_fees   = 加工费用项字典（激光切割/折弯/焊接/表面处理/组装）
--   cabinet_process_fees = 某箱柜的加工费用明细
-- 成本公式（与旧版UI一致，前端实时计算、不落库；后端提供BOM+单价即可）：
--   部件单重(kg) = 展开面积(m²) × 厚度(mm) × 密度(kg/(m²·mm)，钢取7.85)
--   部件材料成本(元) = 单重/1000 × 件数 × (1+损耗率) × 材料单价(元/吨)
--   箱柜总成本 = Σ部件材料成本 + Σ加工费用金额
-- ============================================================================

-- 材料库
CREATE TABLE materials (
  id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '材料ID',
  material_code  VARCHAR(32) NOT NULL COMMENT '材料编码，唯一，如：STL-CR-2.0',
  name           VARCHAR(64) NOT NULL COMMENT '材料名称，如：冷轧钢板',
  grade          VARCHAR(32) NOT NULL COMMENT '材质牌号，如：冷轧板/镀锌板/304不锈钢/铝板/紫铜板',
  thickness_mm   DECIMAL(6,2) NOT NULL COMMENT '厚度(mm)，如：2.00',
  density        DECIMAL(8,3) NOT NULL DEFAULT 7.850 COMMENT '密度，单位kg/(m²·mm)；钢=7.85，铝=2.70，铜=8.90',
  unit           ENUM('ton','sheet','meter') NOT NULL DEFAULT 'ton'
                 COMMENT '计价单位：ton=吨，sheet=张，meter=米',
  price          DECIMAL(14,2) NOT NULL DEFAULT 0.00 COMMENT '单价（按计价单位），吨价时单位为元/吨',
  tax_included   TINYINT NOT NULL DEFAULT 1 COMMENT '是否含税：1=含税价，0=未税价',
  source         VARCHAR(64) NULL DEFAULT NULL COMMENT '价格来源，如：供应商报价/市场价',
  status         TINYINT NOT NULL DEFAULT 1 COMMENT '状态：1=启用，0=停用',
  remark         VARCHAR(255) NULL DEFAULT NULL COMMENT '备注',
  updated_by     BIGINT UNSIGNED NULL DEFAULT NULL COMMENT '最后更新人用户ID',
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  deleted_at     DATETIME NULL DEFAULT NULL COMMENT '逻辑删除时间，NULL=未删除',
  PRIMARY KEY (id),
  UNIQUE KEY uk_material_code (material_code),
  KEY idx_grade (grade),
  CONSTRAINT fk_material_upd FOREIGN KEY (updated_by) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='材料库（价格库·物料）';

-- 材料调价记录（价格变更留痕；调价时必须写一条）
CREATE TABLE material_price_history (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '记录ID',
  material_id BIGINT UNSIGNED NOT NULL COMMENT '材料ID',
  old_price   DECIMAL(14,2) NOT NULL COMMENT '调价前单价',
  new_price   DECIMAL(14,2) NOT NULL COMMENT '调价后单价',
  operator_id BIGINT UNSIGNED NULL DEFAULT NULL COMMENT '操作人用户ID',
  remark      VARCHAR(255) NULL DEFAULT NULL COMMENT '调价说明',
  changed_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '调价时间',
  PRIMARY KEY (id),
  KEY idx_material (material_id, changed_at),
  CONSTRAINT fk_mph_material FOREIGN KEY (material_id) REFERENCES materials (id),
  CONSTRAINT fk_mph_operator FOREIGN KEY (operator_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='材料调价记录表';

-- 箱柜库
CREATE TABLE cabinets (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '箱柜ID',
  cabinet_no VARCHAR(32) NOT NULL COMMENT '箱柜型号，唯一，如：XG-2000',
  name       VARCHAR(64) NOT NULL COMMENT '箱柜名称，如：落地配电柜',
  width_mm   INT NULL DEFAULT NULL COMMENT '宽(mm)',
  depth_mm   INT NULL DEFAULT NULL COMMENT '深(mm)',
  height_mm  INT NULL DEFAULT NULL COMMENT '高(mm)',
  spec_desc  VARCHAR(128) NULL DEFAULT NULL COMMENT '箱规描述，如：2000×800×600落地式',
  status     TINYINT NOT NULL DEFAULT 1 COMMENT '状态：1=启用，0=停用',
  remark     VARCHAR(255) NULL DEFAULT NULL COMMENT '备注',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  deleted_at DATETIME NULL DEFAULT NULL COMMENT '逻辑删除时间，NULL=未删除',
  PRIMARY KEY (id),
  UNIQUE KEY uk_cabinet_no (cabinet_no)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='箱柜库（价格库·箱柜）';

-- 箱柜BOM明细（箱柜 → 部件 → 材料，含展开面积）
CREATE TABLE cabinet_bom (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'BOM行ID',
  cabinet_id  BIGINT UNSIGNED NOT NULL COMMENT '箱柜ID',
  part_name   VARCHAR(64) NOT NULL COMMENT '部件名称，如：左侧板/门板/顶盖',
  material_id BIGINT UNSIGNED NOT NULL COMMENT '材料ID（关联材料库）',
  area_m2     DECIMAL(10,4) NOT NULL COMMENT '展开面积(m²)',
  thickness_mm DECIMAL(6,2) NOT NULL COMMENT '用料厚度(mm)，冗余自材料，便于BOM独立调整',
  quantity    DECIMAL(10,3) NOT NULL DEFAULT 1.000 COMMENT '单台箱柜中该部件的件数',
  loss_rate   DECIMAL(5,4) NOT NULL DEFAULT 0.0000 COMMENT '损耗率，如：0.05=5%',
  sort        INT NOT NULL DEFAULT 0 COMMENT '排序',
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (id),
  KEY idx_cabinet (cabinet_id),
  CONSTRAINT fk_bom_cabinet FOREIGN KEY (cabinet_id) REFERENCES cabinets (id) ON DELETE CASCADE,
  CONSTRAINT fk_bom_material FOREIGN KEY (material_id) REFERENCES materials (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='箱柜BOM明细表';

-- 加工费用项字典（激光切割/折弯/焊接/表面处理/组装…可扩展）
CREATE TABLE process_fees (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '费用项ID',
  code        VARCHAR(32) NOT NULL COMMENT '费用编码，唯一，如：laser_cut',
  name        VARCHAR(32) NOT NULL COMMENT '费用名称，如：激光切割',
  charge_type ENUM('per_area','per_piece','per_meter','fixed') NOT NULL
              COMMENT '计价方式：per_area=按面积，per_piece=按件，per_meter=按米，fixed=固定一口价',
  unit_price  DECIMAL(14,2) NOT NULL DEFAULT 0.00 COMMENT '单价（按计价方式对应的单位）',
  unit        VARCHAR(16) NULL DEFAULT NULL COMMENT '计价单位，如：元/m²、元/米、元/台',
  status      TINYINT NOT NULL DEFAULT 1 COMMENT '状态：1=启用，0=停用',
  remark      VARCHAR(255) NULL DEFAULT NULL COMMENT '备注',
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (id),
  UNIQUE KEY uk_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='加工费用项字典';

-- 箱柜加工费用明细（某箱柜用了哪些加工项、计价参数是多少）
-- amount 冗余存储 = charge_param × 费用项单价，便于直接汇总；费用项调价不追溯历史
CREATE TABLE cabinet_process_fees (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '记录ID',
  cabinet_id   BIGINT UNSIGNED NOT NULL COMMENT '箱柜ID',
  fee_id       BIGINT UNSIGNED NOT NULL COMMENT '加工费用项ID',
  charge_param DECIMAL(14,4) NOT NULL COMMENT '计价参数：按面积=m²数，按件=件数，按米=米数，固定=1',
  amount       DECIMAL(14,2) NOT NULL DEFAULT 0.00 COMMENT '金额 = 计价参数 × 费用项单价（冗余）',
  remark       VARCHAR(255) NULL DEFAULT NULL COMMENT '备注',
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (id),
  UNIQUE KEY uk_cabinet_fee (cabinet_id, fee_id),
  CONSTRAINT fk_cpf_cabinet FOREIGN KEY (cabinet_id) REFERENCES cabinets (id) ON DELETE CASCADE,
  CONSTRAINT fk_cpf_fee FOREIGN KEY (fee_id) REFERENCES process_fees (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='箱柜加工费用明细表';

-- ============================================================================
-- 二、报价管理（平台第一个应用，app_code = quote）
-- ============================================================================

-- 报价单
-- 单号规则：Q + YYYYMM + 4位流水，如 Q2026100001（应用层生成，见数据字典）
-- 状态机：doc_status（单据状态）与 approval_status（审批状态）由后端联动维护，
--   审批通过/驳回时同步更新 approvals.status 与 quotes.approval_status/doc_status
CREATE TABLE quotes (
  id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '报价单ID',
  quote_no            VARCHAR(24) NOT NULL COMMENT '报价单号，唯一，如：Q2026100001',
  customer_name       VARCHAR(128) NOT NULL COMMENT '客户名称',
  contact_name        VARCHAR(32) NULL DEFAULT NULL COMMENT '客户联系人',
  contact_phone       VARCHAR(20) NULL DEFAULT NULL COMMENT '联系电话',
  project_name        VARCHAR(128) NULL DEFAULT NULL COMMENT '项目名称',
  salesman_id         BIGINT UNSIGNED NULL DEFAULT NULL COMMENT '业务员用户ID',
  delivery_requirement VARCHAR(64) NULL DEFAULT NULL COMMENT '交期要求，如：45天',
  tax_rate            DECIMAL(5,2) NOT NULL DEFAULT 13.00 COMMENT '税率%，如：13.00/9.00/6.00/0.00',
  remark              VARCHAR(500) NULL DEFAULT NULL COMMENT '备注',
  subtotal            DECIMAL(14,2) NOT NULL DEFAULT 0.00 COMMENT '小计（未税）= 明细金额之和',
  tax_amount          DECIMAL(14,2) NOT NULL DEFAULT 0.00 COMMENT '税额 = 小计 × 税率',
  total_amount        DECIMAL(14,2) NOT NULL DEFAULT 0.00 COMMENT '价税合计 = 小计 + 税额',
  doc_status          ENUM('draft','pending','approved','rejected','ordered') NOT NULL DEFAULT 'draft'
                      COMMENT '单据状态：draft=草稿，pending=待审批，approved=已批准，rejected=已驳回，ordered=已转订单',
  approval_status     ENUM('none','pending','approved','rejected') NOT NULL DEFAULT 'none'
                      COMMENT '审批状态：none=未提交，pending=审批中，approved=已通过，rejected=已驳回',
  created_by          BIGINT UNSIGNED NULL DEFAULT NULL COMMENT '创建人用户ID',
  created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  deleted_at          DATETIME NULL DEFAULT NULL COMMENT '逻辑删除时间，NULL=未删除',
  PRIMARY KEY (id),
  UNIQUE KEY uk_quote_no (quote_no),
  KEY idx_customer (customer_name),
  KEY idx_doc_status (doc_status),
  KEY idx_salesman (salesman_id),
  KEY idx_created (created_at),
  CONSTRAINT fk_quote_salesman FOREIGN KEY (salesman_id) REFERENCES users (id),
  CONSTRAINT fk_quote_creator FOREIGN KEY (created_by) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='报价单表';

-- 报价明细
-- cabinet_id / material_id：引用价格库（快速报价/从价格库选箱柜时填写），普通手工录入时为 NULL
CREATE TABLE quote_items (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '明细ID',
  quote_id    BIGINT UNSIGNED NOT NULL COMMENT '报价单ID',
  line_no     INT NOT NULL COMMENT '行号，从1开始，同一报价单内唯一',
  product_name VARCHAR(128) NOT NULL COMMENT '产品名称，如：GCS低压抽出式开关柜',
  spec        VARCHAR(128) NULL DEFAULT NULL COMMENT '规格型号，如：GCS-0.4kV',
  material    VARCHAR(64) NULL DEFAULT NULL COMMENT '材质，如：冷轧板/304不锈钢',
  quantity    DECIMAL(12,3) NOT NULL DEFAULT 1.000 COMMENT '数量',
  unit_price  DECIMAL(14,2) NOT NULL DEFAULT 0.00 COMMENT '单价（元）',
  amount      DECIMAL(14,2) NOT NULL DEFAULT 0.00 COMMENT '金额 = 数量 × 单价',
  cabinet_id  BIGINT UNSIGNED NULL DEFAULT NULL COMMENT '引用的箱柜ID（来自价格库），可空',
  material_id BIGINT UNSIGNED NULL DEFAULT NULL COMMENT '引用的材料ID（来自价格库），可空',
  remark      VARCHAR(255) NULL DEFAULT NULL COMMENT '备注',
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (id),
  UNIQUE KEY uk_quote_line (quote_id, line_no),
  KEY idx_cabinet (cabinet_id),
  CONSTRAINT fk_item_quote FOREIGN KEY (quote_id) REFERENCES quotes (id) ON DELETE CASCADE,
  CONSTRAINT fk_item_cabinet FOREIGN KEY (cabinet_id) REFERENCES cabinets (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='报价明细表';

-- ============================================================================
-- 三、审批流（通用能力，各应用通过 biz_type + biz_id 复用）
-- ============================================================================

-- 审批单（一笔业务单据对应一条审批单）
CREATE TABLE approvals (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '审批单ID',
  biz_type     VARCHAR(32) NOT NULL COMMENT '业务类型，如：quote=报价单，purchase=采购单，app_drawing=图纸分解任务',
  biz_id       BIGINT UNSIGNED NOT NULL COMMENT '业务单据ID',
  title        VARCHAR(128) NOT NULL COMMENT '审批标题，如：报价单Q2026100001审批',
  applicant_id BIGINT UNSIGNED NOT NULL COMMENT '申请人用户ID',
  current_step INT NOT NULL DEFAULT 1 COMMENT '当前节点序号，从1开始',
  total_steps  INT NOT NULL DEFAULT 2 COMMENT '总节点数，如：技术审核→领导审批=2',
  status       ENUM('pending','approved','rejected','cancelled') NOT NULL DEFAULT 'pending'
               COMMENT '审批状态：pending=审批中，approved=已通过，rejected=已驳回，cancelled=已撤回',
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (id),
  UNIQUE KEY uk_biz (biz_type, biz_id),
  KEY idx_applicant (applicant_id),
  KEY idx_status (status),
  CONSTRAINT fk_approval_applicant FOREIGN KEY (applicant_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='审批单表（通用审批流）';

-- 审批记录（审批时间线：提交/通过/驳回/退回/撤回全留痕）
CREATE TABLE approval_records (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '记录ID',
  approval_id BIGINT UNSIGNED NOT NULL COMMENT '审批单ID',
  step_no     INT NOT NULL COMMENT '节点序号',
  approver_id BIGINT UNSIGNED NULL DEFAULT NULL COMMENT '审批人用户ID（提交动作为申请人）',
  action      ENUM('submit','approve','reject','return','cancel') NOT NULL
              COMMENT '动作：submit=提交，approve=通过，reject=驳回，return=退回，cancel=撤回',
  comment     VARCHAR(500) NULL DEFAULT NULL COMMENT '审批意见',
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '动作时间',
  PRIMARY KEY (id),
  KEY idx_approval (approval_id, step_no),
  CONSTRAINT fk_record_approval FOREIGN KEY (approval_id) REFERENCES approvals (id) ON DELETE CASCADE,
  CONSTRAINT fk_record_approver FOREIGN KEY (approver_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='审批记录表（时间线）';

-- ============================================================================
-- 四、协同与通知
-- ============================================================================

-- 报价协同评论（@同事用 mention_user_ids 存用户ID数组，发通知时解析）
CREATE TABLE quote_comments (
  id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '评论ID',
  quote_id         BIGINT UNSIGNED NOT NULL COMMENT '报价单ID',
  user_id          BIGINT UNSIGNED NOT NULL COMMENT '评论人用户ID',
  content          TEXT NOT NULL COMMENT '评论内容',
  mention_user_ids JSON NULL DEFAULT NULL COMMENT '@的用户ID数组，如：[3,7]；发通知用',
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '评论时间',
  PRIMARY KEY (id),
  KEY idx_quote (quote_id),
  CONSTRAINT fk_comment_quote FOREIGN KEY (quote_id) REFERENCES quotes (id) ON DELETE CASCADE,
  CONSTRAINT fk_comment_user FOREIGN KEY (user_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='报价协同评论表';

-- 附件（通用：biz_type + biz_id 挂靠任意业务，如 quote/报价单、approval/审批单、app_drawing/图纸任务）
CREATE TABLE attachments (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '附件ID',
  biz_type    VARCHAR(32) NOT NULL COMMENT '业务类型，如：quote',
  biz_id      BIGINT UNSIGNED NOT NULL COMMENT '业务单据ID',
  file_name   VARCHAR(255) NOT NULL COMMENT '原始文件名',
  file_path   VARCHAR(512) NOT NULL COMMENT '存储路径（对象存储key或本地相对路径）',
  file_size   BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '文件大小（字节）',
  mime_type   VARCHAR(128) NULL DEFAULT NULL COMMENT 'MIME类型',
  uploader_id BIGINT UNSIGNED NULL DEFAULT NULL COMMENT '上传人用户ID',
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '上传时间',
  PRIMARY KEY (id),
  KEY idx_biz (biz_type, biz_id),
  CONSTRAINT fk_attach_uploader FOREIGN KEY (uploader_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='附件表（通用）';

-- 通知（站内信；link_url 约定为前端路由，如：/app/quote/detail/12）
CREATE TABLE notifications (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '通知ID',
  user_id    BIGINT UNSIGNED NOT NULL COMMENT '接收人用户ID',
  type       ENUM('approval','mention','system') NOT NULL DEFAULT 'system'
             COMMENT '类型：approval=审批，mention=@我，system=系统',
  title      VARCHAR(128) NOT NULL COMMENT '标题',
  content    VARCHAR(500) NULL DEFAULT NULL COMMENT '内容',
  link_url   VARCHAR(255) NULL DEFAULT NULL COMMENT '跳转链接（前端路由），如：/app/quote/detail/12',
  is_read    TINYINT NOT NULL DEFAULT 0 COMMENT '是否已读：0=未读，1=已读',
  read_at    DATETIME NULL DEFAULT NULL COMMENT '已读时间',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (id),
  KEY idx_user_read (user_id, is_read),
  KEY idx_created (created_at),
  CONSTRAINT fk_notif_user FOREIGN KEY (user_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='通知表';

-- ============================================================================
-- 六、通用：操作日志
-- ============================================================================

CREATE TABLE operation_logs (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '日志ID',
  user_id    BIGINT UNSIGNED NULL DEFAULT NULL COMMENT '操作人用户ID（系统任务可为NULL）',
  module     VARCHAR(32) NOT NULL COMMENT '模块，如：quote=报价，price=价格库，system=系统',
  action     VARCHAR(32) NOT NULL COMMENT '动作，如：create/update/delete/submit/approve/login',
  biz_type   VARCHAR(32) NULL DEFAULT NULL COMMENT '业务类型，如：quote',
  biz_id     BIGINT UNSIGNED NULL DEFAULT NULL COMMENT '业务单据ID',
  detail     JSON NULL DEFAULT NULL COMMENT '详情（前后值、扩展信息），JSON格式',
  ip         VARCHAR(45) NULL DEFAULT NULL COMMENT '操作IP',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '操作时间',
  PRIMARY KEY (id),
  KEY idx_user_time (user_id, created_at),
  KEY idx_module_time (module, created_at),
  CONSTRAINT fk_log_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='操作日志表';

-- ============================================================================
-- 七、基础数据（种子）
-- ============================================================================

-- 部门：根部门 + 六大部门
INSERT INTO departments (id, parent_id, name, code, sort) VALUES
  (1, NULL, '浙江京能电力设备', 'JN', 0),
  (2, 1, '钣金车间', 'BJ', 10),
  (3, 1, '成套车间', 'CT', 20),
  (4, 1, '质检部', 'ZJ', 30),
  (5, 1, '销售部', 'XS', 40),
  (6, 1, '技术部', 'JS', 50),
  (7, 1, '行政部', 'XZ', 60);

-- 角色
INSERT INTO roles (code, name, remark) VALUES
  ('admin', '系统管理员', '全部权限'),
  ('salesman', '业务员', '报价新建/编辑/提交'),
  ('approver', '审批人', '审批通过/驳回');

-- 应用注册（平台插件：报价管理 + 价格库先行，图纸分解/快速报价预留）
INSERT INTO apps (code, name, icon, route, sort, status) VALUES
  ('quote', '报价管理', 'file-text', '/app/quote', 10, 1),
  ('price', '价格库', 'database', '/app/price', 20, 1),
  ('drawing', '图纸分解', 'scan', '/app/drawing', 30, 0),
  ('quickquote', '快速报价', 'zap', '/app/quickquote', 40, 0);

-- 报价应用权限点
INSERT INTO app_permissions (app_id, perm_code, perm_name) VALUES
  (1, 'quote:view', '查看报价'),
  (1, 'quote:create', '新建报价'),
  (1, 'quote:edit', '编辑报价'),
  (1, 'quote:submit', '提交审批'),
  (1, 'quote:approve', '审批报价'),
  (1, 'quote:convert', '转订单'),
  (1, 'quote:delete', '删除报价');
-- 价格库应用权限点
INSERT INTO app_permissions (app_id, perm_code, perm_name) VALUES
  (2, 'price:view', '查看价格库'),
  (2, 'price:edit', '维护箱柜BOM'),
  (2, 'price:adjust', '材料调价');

-- 加工费用项字典（示例单价，投产前按实际核定）
INSERT INTO process_fees (code, name, charge_type, unit_price, unit, remark) VALUES
  ('laser_cut', '激光切割', 'per_meter', 8.00, '元/米', '按切割长度计'),
  ('bend', '折弯', 'per_meter', 3.50, '元/米', '按折弯长度计'),
  ('weld', '焊接', 'per_meter', 12.00, '元/米', '按焊缝长度计'),
  ('coat', '表面处理', 'per_area', 25.00, '元/m²', '喷塑/喷漆按面积计'),
  ('assemble', '组装', 'fixed', 150.00, '元/台', '整柜组装一口价');
