/**
 * Mock 数据：与 db/schema.sql 的数据模型一致
 * 后端（Codex）就绪后，把 .env 的 VITE_USE_MOCK 设为 false 即可切换
 */
import type {
  Approval,
  ApprovalRecord,
  Department,
  PageResult,
  Quote,
  QuoteComment,
  QuoteDetail,
  QuoteItem,
  User,
} from "../types";

const now = () => new Date().toISOString();
const daysAgo = (n: number) => new Date(Date.now() - n * 864e5).toISOString();

export const mockDepartments: Department[] = [
  { id: 1, parentId: null, name: "销售部", code: "SALES", sort: 1, leaderUserId: 2, status: 1, createdAt: daysAgo(400), updatedAt: daysAgo(10) },
  { id: 2, parentId: null, name: "技术部", code: "TECH", sort: 2, leaderUserId: 4, status: 1, createdAt: daysAgo(400), updatedAt: daysAgo(10) },
  { id: 3, parentId: null, name: "钣金车间", code: "SHEET", sort: 3, leaderUserId: 5, status: 1, createdAt: daysAgo(400), updatedAt: daysAgo(10) },
  { id: 4, parentId: null, name: "成套车间", code: "ASSEMBLY", sort: 4, leaderUserId: 6, status: 1, createdAt: daysAgo(400), updatedAt: daysAgo(10) },
  { id: 5, parentId: null, name: "质检部", code: "QC", sort: 5, leaderUserId: 7, status: 1, createdAt: daysAgo(400), updatedAt: daysAgo(10) },
  { id: 6, parentId: null, name: "行政部", code: "ADMIN", sort: 6, leaderUserId: 8, status: 1, createdAt: daysAgo(400), updatedAt: daysAgo(10) },
];

export const mockUsers: User[] = [
  { id: 1, username: "admin", realName: "系统管理员", deptId: 6, deptName: "行政部", phone: "13800000001", status: 1, createdAt: daysAgo(400) },
  { id: 2, username: "zhang", realName: "张伟", employeeNo: "JN001", deptId: 1, deptName: "销售部", phone: "13800000002", status: 1, createdAt: daysAgo(380) },
  { id: 3, username: "li", realName: "李娜", employeeNo: "JN002", deptId: 1, deptName: "销售部", phone: "13800000003", status: 1, createdAt: daysAgo(350) },
  { id: 4, username: "wang", realName: "王工", employeeNo: "JN003", deptId: 2, deptName: "技术部", phone: "13800000004", status: 1, createdAt: daysAgo(390) },
  { id: 5, username: "zhao", realName: "赵师傅", employeeNo: "JN004", deptId: 3, deptName: "钣金车间", phone: "13800000005", status: 1, createdAt: daysAgo(390) },
  { id: 6, username: "chen", realName: "陈师傅", employeeNo: "JN005", deptId: 4, deptName: "成套车间", phone: "13800000006", status: 1, createdAt: daysAgo(390) },
  { id: 7, username: "liu", realName: "刘质检", employeeNo: "JN006", deptId: 5, deptName: "质检部", phone: "13800000007", status: 1, createdAt: daysAgo(300) },
  { id: 8, username: "huang", realName: "黄总", employeeNo: "JN007", deptId: 6, deptName: "行政部", phone: "13800000008", status: 1, createdAt: daysAgo(400) },
];

const items1: QuoteItem[] = [
  { id: 1, quoteId: 1, lineNo: 1, productName: "GCS 低压抽出式开关柜", spec: "GCS 2200×1000×800", material: "镀锌板 2.0mm", quantity: 8, unitPrice: 12800, amount: 102400, cabinetId: 1, materialId: 2, remark: "含母线" },
  { id: 2, quoteId: 1, lineNo: 2, productName: "XL-21 动力配电柜", spec: "XL-21 1800×800×600", material: "冷轧板 1.5mm", quantity: 12, unitPrice: 6800, amount: 81600, cabinetId: 2, materialId: 1 },
  { id: 3, quoteId: 1, lineNo: 3, productName: "电缆分支箱", spec: "DFW 1200×1000×500", material: "不锈钢 304 1.5mm", quantity: 4, unitPrice: 9500, amount: 38000, cabinetId: 3, materialId: 3 },
];

const items2: QuoteItem[] = [
  { id: 4, quoteId: 2, lineNo: 1, productName: "GGD 低压固定式开关柜", spec: "GGD 2200×800×600", material: "冷轧板 2.0mm", quantity: 6, unitPrice: 8900, amount: 53400, cabinetId: null, materialId: 1 },
  { id: 5, quoteId: 2, lineNo: 2, productName: "控制箱", spec: "600×500×250", material: "冷轧板 1.2mm", quantity: 20, unitPrice: 1250, amount: 25000, cabinetId: null, materialId: 1 },
];

export const mockQuotes: Quote[] = [
  {
    id: 1, quoteNo: "Q2025100001", customerName: "杭州临安电力设备有限公司",
    contactName: "沈经理", contactPhone: "13900001111", projectName: "临安工业园配电改造",
    salesmanId: 2, salesmanName: "张伟", deliveryRequirement: "合同签订后 25 天交货",
    taxRate: 13, remark: "含安装调试", subtotal: 221999.99, taxAmount: 28860, totalAmount: 250859.99,
    docStatus: "pending", approvalStatus: "pending", createdBy: 2,
    createdAt: daysAgo(2), updatedAt: daysAgo(1),
  },
  {
    id: 2, quoteNo: "Q2025100002", customerName: "宁波镇海化工园区管委会",
    contactName: "周工", contactPhone: "13900002222", projectName: "化工园区二期配电",
    salesmanId: 3, salesmanName: "李娜", taxRate: 13,
    subtotal: 78400, taxAmount: 10192, totalAmount: 88592,
    docStatus: "approved", approvalStatus: "approved", createdBy: 3,
    createdAt: daysAgo(6), updatedAt: daysAgo(4),
  },
  {
    id: 3, quoteNo: "Q2025100003", customerName: "绍兴柯桥轻纺城置业",
    projectName: "轻纺城 C 区配电房", salesmanId: 2, salesmanName: "张伟",
    taxRate: 9, subtotal: 156000, taxAmount: 14040, totalAmount: 170040,
    docStatus: "draft", approvalStatus: "none", createdBy: 2,
    createdAt: daysAgo(1), updatedAt: now(),
  },
  {
    id: 4, quoteNo: "Q2025090018", customerName: "嘉兴秀洲工业投资集团",
    contactName: "钱总", projectName: "秀洲智造园一期", salesmanId: 3, salesmanName: "李娜",
    taxRate: 13, subtotal: 432500, taxAmount: 56225, totalAmount: 488725,
    docStatus: "ordered", approvalStatus: "approved", createdBy: 3,
    createdAt: daysAgo(28), updatedAt: daysAgo(20),
  },
  {
    id: 5, quoteNo: "Q2025090015", customerName: "湖州吴兴建设开发公司",
    projectName: "吴兴科创园配电", salesmanId: 2, salesmanName: "张伟",
    taxRate: 13, subtotal: 98700, taxAmount: 12831, totalAmount: 111531,
    docStatus: "rejected", approvalStatus: "rejected", createdBy: 2,
    createdAt: daysAgo(35), updatedAt: daysAgo(30),
  },
];

const timeline1: ApprovalRecord[] = [
  { id: 1, approvalId: 1, stepNo: 1, approverId: 2, approverName: "张伟", action: "submit", comment: "提交审批", createdAt: daysAgo(2) },
  { id: 2, approvalId: 1, stepNo: 2, approverId: 4, approverName: "王工", action: "approve", comment: "技术方案可行，BOM 已核对", createdAt: daysAgo(1) },
];

const comments1: QuoteComment[] = [
  { id: 1, quoteId: 1, userId: 4, userName: "王工", content: "GCS 柜的母线规格请和客户再确认一次，1600A 还是 2000A？", mentionUserIds: [2], createdAt: daysAgo(1) },
  { id: 2, quoteId: 1, userId: 2, userName: "张伟", content: "已和沈经理确认，2000A，明天更新到附件里", mentionUserIds: null, createdAt: daysAgo(1) },
];

export function mockQuoteDetail(id: number): QuoteDetail {
  const q = mockQuotes.find((x) => x.id === id) ?? mockQuotes[0];
  return {
    ...q,
    items: q.id === 1 ? items1 : q.id === 2 ? items2 : items1.slice(0, 2),
    approvalTimeline: q.id === 1 ? timeline1 : [],
    comments: q.id === 1 ? comments1 : [],
  };
}

export const mockApprovals: Approval[] = [
  { id: 1, bizType: "quote", bizId: 1, title: "报价单 Q2025100001（杭州临安电力）审批", applicantId: 2, applicantName: "张伟", currentStep: 2, totalSteps: 3, status: "pending", createdAt: daysAgo(2) },
  { id: 2, bizType: "quote", bizId: 3, title: "报价单 Q2025100003（绍兴柯桥轻纺城）审批", applicantId: 2, applicantName: "张伟", currentStep: 1, totalSteps: 3, status: "pending", createdAt: daysAgo(1) },
  { id: 3, bizType: "quote", bizId: 2, title: "报价单 Q2025100002（宁波镇海化工）审批", applicantId: 3, applicantName: "李娜", currentStep: 3, totalSteps: 3, status: "approved", createdAt: daysAgo(6) },
  { id: 4, bizType: "quote", bizId: 5, title: "报价单 Q2025090015（湖州吴兴建设）审批", applicantId: 2, applicantName: "张伟", currentStep: 2, totalSteps: 3, status: "rejected", createdAt: daysAgo(35) },
];

export function paginate<T>(list: T[], page = 1, pageSize = 10): PageResult<T> {
  const start = (page - 1) * pageSize;
  return { list: list.slice(start, start + pageSize), total: list.length };
}
