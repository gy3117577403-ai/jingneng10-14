/**
 * Mock 请求路由器：拦截 api/client 的请求，返回本地模拟数据
 * 路径约定与《应用接入规范》第六章一致
 */
import type { Quote, QuoteDetail, QuoteForm } from "../types";
import {
  mockApprovals,
  mockDepartments,
  mockQuoteDetail,
  mockQuotes,
  mockUsers,
  paginate,
} from "../mocks/data";

let quoteSeq = 100;
const quotes: Quote[] = [...mockQuotes];

function calcTotals(items: { quantity: number; unitPrice: number }[], taxRate: number) {
  const subtotal = items.reduce((s, it) => s + it.quantity * it.unitPrice, 0);
  const taxAmount = +(subtotal * (taxRate / 100)).toFixed(2);
  return { subtotal: +subtotal.toFixed(2), taxAmount, totalAmount: +(subtotal + taxAmount).toFixed(2) };
}

export async function mockRequest<T>(path: string, options: RequestInit & { params?: Record<string, any> }): Promise<T> {
  // 模拟网络延迟
  await new Promise((r) => setTimeout(r, 180 + Math.random() * 220));
  const params = options.params ?? {};
  const method = (options.method ?? "GET").toUpperCase();

  // —— 报价单 ——
  if (path === "/quotes" && method === "GET") {
    let list = [...quotes];
    if (params.keyword) {
      const kw = String(params.keyword);
      list = list.filter((q) => q.quoteNo.includes(kw) || q.customerName.includes(kw) || (q.projectName ?? "").includes(kw));
    }
    if (params.docStatus) list = list.filter((q) => q.docStatus === params.docStatus);
    const { list: page, total } = paginate(list, Number(params.page ?? 1), Number(params.pageSize ?? 10));
    return { list: page, total } as unknown as T;
  }
  const detailMatch = path.match(/^\/quotes\/(\d+)$/);
  if (detailMatch && method === "GET") {
    return mockQuoteDetail(Number(detailMatch[1])) as unknown as T;
  }
  if (path === "/quotes" && method === "POST") {
    const form = JSON.parse(options.body as string) as QuoteForm;
    const totals = calcTotals(form.items, form.taxRate);
    const q: Quote = {
      id: ++quoteSeq,
      quoteNo: `Q202510${String(quoteSeq).padStart(4, "0")}`,
      customerName: form.customerName,
      contactName: form.contactName,
      contactPhone: form.contactPhone,
      projectName: form.projectName,
      salesmanId: form.salesmanId ?? 2,
      salesmanName: "张伟",
      deliveryRequirement: form.deliveryRequirement,
      taxRate: form.taxRate,
      remark: form.remark,
      ...totals,
      docStatus: "draft",
      approvalStatus: "none",
      createdBy: 2,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    quotes.unshift(q);
    return q as unknown as T;
  }
  const actionMatch = path.match(/^\/quotes\/(\d+)\/(submit|approve|reject|convert)$/);
  if (actionMatch && method === "POST") {
    const id = Number(actionMatch[1]);
    const action = actionMatch[2];
    const q = quotes.find((x) => x.id === id);
    if (!q) throw new Error("报价单不存在");
    if (action === "submit") { q.docStatus = "pending"; q.approvalStatus = "pending"; }
    if (action === "approve") { q.docStatus = "approved"; q.approvalStatus = "approved"; }
    if (action === "reject") { q.docStatus = "rejected"; q.approvalStatus = "rejected"; }
    if (action === "convert") { q.docStatus = "ordered"; }
    q.updatedAt = new Date().toISOString();
    return q as unknown as T;
  }
  const commentMatch = path.match(/^\/quotes\/(\d+)\/comments$/);
  if (commentMatch && method === "POST") {
    const body = JSON.parse(options.body as string);
    return {
      id: Date.now(), quoteId: Number(commentMatch[1]), userId: 1,
      userName: "系统管理员", content: body.content,
      mentionUserIds: null, createdAt: new Date().toISOString(),
    } as unknown as T;
  }

  // —— 审批 ——
  if (path === "/approvals" && method === "GET") {
    let list = [...mockApprovals];
    if (params.tab === "todo") list = list.filter((a) => a.status === "pending");
    if (params.tab === "done") list = list.filter((a) => a.status !== "pending");
    if (params.keyword) list = list.filter((a) => a.title.includes(String(params.keyword)));
    const { list: page, total } = paginate(list, Number(params.page ?? 1), Number(params.pageSize ?? 10));
    return { list: page, total } as unknown as T;
  }

  // —— 组织 ——
  if (path === "/departments" && method === "GET") return mockDepartments as unknown as T;
  if (path === "/users" && method === "GET") {
    let list = [...mockUsers];
    if (params.keyword) {
      const kw = String(params.keyword);
      list = list.filter((u) => u.realName.includes(kw) || u.username.includes(kw));
    }
    if (params.deptId) list = list.filter((u) => u.deptId === Number(params.deptId));
    const { list: page, total } = paginate(list, Number(params.page ?? 1), Number(params.pageSize ?? 20));
    return { list: page, total } as unknown as T;
  }

  // —— 当前用户 ——
  if (path === "/me" && method === "GET") {
    return { id: 1, username: "admin", realName: "系统管理员", deptName: "行政部", roles: ["admin"] } as unknown as T;
  }

  throw new Error(`Mock 未覆盖的接口：${method} ${path}`);
}

export type { QuoteDetail };
