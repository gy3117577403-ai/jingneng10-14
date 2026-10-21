/** 报价模块接口 */
import { api } from "./client";
import type {
  PageResult,
  Quote,
  QuoteComment,
  QuoteDetail,
  QuoteFilter,
  QuoteForm,
} from "../types";

export const quoteApi = {
  list: (filter: QuoteFilter) =>
    api.get<PageResult<Quote>>("/quotes", filter as Record<string, string | number>),

  detail: (id: number) => api.get<QuoteDetail>(`/quotes/${id}`),

  create: (form: QuoteForm) => api.post<Quote>("/quotes", form),

  submit: (id: number) => api.post<Quote>(`/quotes/${id}/submit`),
  approve: (id: number, comment?: string) => api.post<Quote>(`/quotes/${id}/approve`, { comment }),
  reject: (id: number, comment?: string) => api.post<Quote>(`/quotes/${id}/reject`, { comment }),
  convertToOrder: (id: number) => api.post<Quote>(`/quotes/${id}/convert`),

  addComment: (id: number, content: string) =>
    api.post<QuoteComment>(`/quotes/${id}/comments`, { content }),
};

export const approvalApi = {
  list: (tab: "todo" | "done" | "mine", keyword?: string, page = 1, pageSize = 10) =>
    api.get<PageResult<import("../types").Approval>>("/approvals", { tab, keyword, page, pageSize }),
};

export const orgApi = {
  departments: () => api.get<import("../types").Department[]>("/departments"),
  users: (keyword?: string, deptId?: number) =>
    api.get<PageResult<import("../types").User>>("/users", { keyword, deptId, pageSize: 100 }),
  me: () => api.get<import("../types").SessionUser>("/me"),
};
