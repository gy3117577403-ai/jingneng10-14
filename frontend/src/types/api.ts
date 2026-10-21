/**
 * 京能协同平台 · 前端 TypeScript 类型定义
 * 与 schema.sql / 数据字典一一对应。后端接口返回结构建议参考《应用接入规范》第六章。
 */

// ============ 通用 ============

/** 分页请求 */
export interface PageQuery {
  page: number;
  pageSize: number;
}

/** 统一分页响应 */
export interface PageResult<T> {
  list: T[];
  total: number;
}

/** 统一 API 响应 */
export interface ApiResponse<T> {
  code: number; // 0=成功，非0=业务异常
  msg: string;
  data: T;
}

/** 通用状态：1=启用，0=停用 */
export type StatusFlag = 1 | 0;

// ============ 一、组织与权限 ============

export interface Department {
  id: number;
  parentId: number | null;
  name: string;
  code: string;
  sort: number;
  leaderUserId: number | null;
  status: StatusFlag;
  remark?: string;
  createdAt: string;
  updatedAt: string;
}

/** 部门树节点（前端组装） */
export interface DepartmentNode extends Department {
  children: DepartmentNode[];
}

export type UserStatus = 1 | 0 | 2; // 1=正常，0=停用，2=锁定

export interface User {
  id: number;
  username: string;
  realName: string;
  employeeNo?: string;
  deptId: number | null;
  deptName?: string;
  phone?: string;
  email?: string;
  avatarUrl?: string;
  status: UserStatus;
  lastLoginAt?: string;
  createdAt: string;
}

export interface Role {
  id: number;
  code: 'admin' | 'salesman' | 'approver' | string;
  name: string;
  remark?: string;
  status: StatusFlag;
}

export interface App {
  id: number;
  code: string; // quote / price / drawing / quickquote
  name: string;
  icon?: string;
  route: string; // 如 /app/quote
  sort: number;
  status: StatusFlag;
}

export interface AppPermission {
  id: number;
  appId: number;
  permCode: string; // 如 quote:approve
  permName: string;
}

// ============ 二、报价管理 ============

/** 报价单据状态 */
export type QuoteDocStatus = 'draft' | 'pending' | 'approved' | 'rejected' | 'ordered';
/** 报价审批状态 */
export type QuoteApprovalStatus = 'none' | 'pending' | 'approved' | 'rejected';

export const QUOTE_DOC_STATUS_LABEL: Record<QuoteDocStatus, string> = {
  draft: '草稿',
  pending: '待审批',
  approved: '已批准',
  rejected: '已驳回',
  ordered: '已转订单',
};

export interface Quote {
  id: number;
  quoteNo: string;
  customerName: string;
  contactName?: string;
  contactPhone?: string;
  projectName?: string;
  salesmanId: number | null;
  salesmanName?: string;
  deliveryRequirement?: string;
  taxRate: number; // 如 13.00
  remark?: string;
  subtotal: number; // 小计（未税）
  taxAmount: number; // 税额
  totalAmount: number; // 价税合计
  docStatus: QuoteDocStatus;
  approvalStatus: QuoteApprovalStatus;
  createdBy?: number;
  createdAt: string;
  updatedAt: string;
}

/** 报价详情（含明细/时间线/评论，前端组装） */
export interface QuoteDetail extends Quote {
  items: QuoteItem[];
  approvalTimeline: ApprovalRecord[];
  comments: QuoteComment[];
}

export interface QuoteItem {
  id: number;
  quoteId: number;
  lineNo: number;
  productName: string;
  spec?: string;
  material?: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  cabinetId: number | null; // 引用的箱柜ID（可空）
  materialId: number | null; // 引用的材料ID（可空）
  remark?: string;
}

/** 新建/编辑报价单请求 */
export interface QuoteForm {
  customerName: string;
  contactName?: string;
  contactPhone?: string;
  projectName?: string;
  salesmanId?: number;
  deliveryRequirement?: string;
  taxRate: number;
  remark?: string;
  items: Array<{
    productName: string;
    spec?: string;
    material?: string;
    quantity: number;
    unitPrice: number;
    cabinetId?: number;
    materialId?: number;
    remark?: string;
  }>;
}

// ============ 三、审批流 ============

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';
export type ApprovalAction = 'submit' | 'approve' | 'reject' | 'return' | 'cancel';

export const APPROVAL_ACTION_LABEL: Record<ApprovalAction, string> = {
  submit: '提交',
  approve: '通过',
  reject: '驳回',
  return: '退回',
  cancel: '撤回',
};

export interface Approval {
  id: number;
  bizType: string; // quote / app_drawing / …
  bizId: number;
  title: string;
  applicantId: number;
  applicantName?: string;
  currentStep: number;
  totalSteps: number;
  status: ApprovalStatus;
  createdAt: string;
}

export interface ApprovalRecord {
  id: number;
  approvalId: number;
  stepNo: number;
  approverId: number | null;
  approverName?: string;
  action: ApprovalAction;
  comment?: string;
  createdAt: string;
}

// ============ 四、协同与通知 ============

export interface QuoteComment {
  id: number;
  quoteId: number;
  userId: number;
  userName?: string;
  avatarUrl?: string;
  content: string;
  mentionUserIds: number[] | null;
  createdAt: string;
}

export interface Attachment {
  id: number;
  bizType: string;
  bizId: number;
  fileName: string;
  filePath: string;
  fileSize: number;
  mimeType?: string;
  uploaderId: number | null;
  uploaderName?: string;
  createdAt: string;
}

export type NotificationType = 'approval' | 'mention' | 'system';

export interface Notification {
  id: number;
  userId: number;
  type: NotificationType;
  title: string;
  content?: string;
  linkUrl?: string; // 前端路由，如 /app/quote/detail/12
  isRead: 0 | 1;
  readAt?: string;
  createdAt: string;
}

// ============ 五、价格库 ============

export type MaterialUnit = 'ton' | 'sheet' | 'meter'; // 吨 / 张 / 米

export interface Material {
  id: number;
  materialCode: string;
  name: string;
  grade: string; // 材质牌号：冷轧板 / 镀锌板 / 304不锈钢 / 铝板 / 紫铜板
  thicknessMm: number;
  density: number; // kg/(m²·mm)，钢=7.85
  unit: MaterialUnit;
  price: number; // 单价（按计价单位）
  taxIncluded: 0 | 1;
  source?: string;
  status: StatusFlag;
  remark?: string;
  updatedBy?: number;
  createdAt: string;
  updatedAt: string;
}

export interface MaterialPriceHistory {
  id: number;
  materialId: number;
  oldPrice: number;
  newPrice: number;
  operatorId: number | null;
  operatorName?: string;
  remark?: string;
  changedAt: string;
}

export interface Cabinet {
  id: number;
  cabinetNo: string; // 如 XG-2000
  name: string;
  widthMm?: number;
  depthMm?: number;
  heightMm?: number;
  specDesc?: string; // 箱规描述
  status: StatusFlag;
  remark?: string;
  createdAt: string;
}

export interface CabinetBom {
  id: number;
  cabinetId: number;
  partName: string;
  materialId: number;
  material?: Material;
  areaM2: number; // 展开面积(m²)
  thicknessMm: number;
  quantity: number; // 单台件数
  lossRate: number; // 损耗率，如 0.05
  sort: number;
}

/** 加工费用计价方式 */
export type ChargeType = 'per_area' | 'per_piece' | 'per_meter' | 'fixed';

export interface ProcessFee {
  id: number;
  code: string; // laser_cut / bend / weld / coat / assemble
  name: string;
  chargeType: ChargeType;
  unitPrice: number;
  unit?: string;
  status: StatusFlag;
  remark?: string;
}

export interface CabinetProcessFee {
  id: number;
  cabinetId: number;
  feeId: number;
  fee?: ProcessFee;
  chargeParam: number; // 计价参数（按计价方式理解）
  amount: number; // 金额（冗余）
  remark?: string;
}

/** 箱柜成本核算结果（前端按 BOM 实时计算） */
export interface CabinetCost {
  cabinetId: number;
  materialCost: number; // Σ部件材料成本
  processCost: number; // Σ加工费用
  totalCost: number; // 总成本
  lines: Array<{
    partName: string;
    weightKg: number; // 单重 = areaM2 × thicknessMm × density
    cost: number; // 部件材料成本
  }>;
}

// ============ 六、操作日志 ============

export interface OperationLog {
  id: number;
  userId: number | null;
  userName?: string;
  module: string;
  action: string;
  bizType?: string;
  bizId?: number;
  detail?: Record<string, unknown>;
  ip?: string;
  createdAt: string;
}
