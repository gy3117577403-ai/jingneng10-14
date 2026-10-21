/**
 * 统一 API 客户端
 * - 基地址取环境变量 VITE_API_BASE（默认 /api）
 * - VITE_USE_MOCK=true 时走本地 mock（见 ./mock.ts），后端就绪后切 false 即可联调
 */
import type { ApiResponse } from "../types";
import { mockRequest } from "./mock";

const BASE = import.meta.env.VITE_API_BASE ?? "/api";
const USE_MOCK = (import.meta.env.VITE_USE_MOCK ?? "true") === "true";

export class ApiError extends Error {
  code: number;
  constructor(code: number, msg: string) {
    super(msg);
    this.code = code;
  }
}

interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
}

function buildUrl(path: string, params?: RequestOptions["params"]) {
  const url = new URL(path, window.location.origin);
  // 相对路径拼到 BASE 下
  const full = new URL(BASE.replace(/\/$/, "") + "/" + path.replace(/^\//, ""), window.location.origin);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined) full.searchParams.set(k, String(v));
    }
  }
  return full.toString().replace(window.location.origin, "") || url.toString();
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  if (USE_MOCK) {
    return mockRequest<T>(path, options);
  }
  const { params, ...init } = options;
  const res = await fetch(buildUrl(path, params), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
    credentials: "include",
  });
  if (!res.ok) {
    throw new ApiError(res.status, `网络请求失败（${res.status}）`);
  }
  const json = (await res.json()) as ApiResponse<T>;
  if (json.code !== 0) {
    throw new ApiError(json.code, json.msg || "业务处理失败");
  }
  return json.data;
}

export const api = {
  get: <T>(path: string, params?: RequestOptions["params"]) =>
    request<T>(path, { method: "GET", params }),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body ?? {}) }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PUT", body: JSON.stringify(body ?? {}) }),
  del: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
