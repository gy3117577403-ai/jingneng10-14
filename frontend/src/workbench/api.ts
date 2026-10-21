import type { Cabinet, QuoteDocument } from '@jingneng/quote-core';
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
const BASE = '/api/workbench';
export async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(BASE + url, {
    ...init,
    headers:
      init?.body instanceof FormData
        ? init.headers
        : { 'Content-Type': 'application/json', ...init?.headers },
  });
  if (!r.ok) {
    const body = await r.json().catch(() => ({ error: '服务暂不可用，请检查工作台服务是否启动' }));
    throw new ApiError(r.status, body.error || '操作失败');
  }
  return r.json();
}
export type QuoteSummary = {
  id: string;
  quoteNo: string;
  revision: number;
  customerName: string;
  projectName: string;
  quotationDate: string;
  total: string;
  pending: number;
  unassigned: number;
  cabinetCount: string;
  updatedAt: string;
};
export type Version = { revision: number; savedAt: string; total: string };
export type Mapping = Record<
  | 'name'
  | 'model'
  | 'brand'
  | 'quantity'
  | 'unit'
  | 'unitPrice'
  | 'remark'
  | 'leadTime'
  | 'cabinet',
  number
>;
export type ImportConfig = {
  sheet: string;
  headerRow: number;
  startRow: number;
  endRow: number;
  mapping: Mapping;
  excludedRows: number[];
  includeHidden: boolean;
  cabinetName: string;
  cabinetQuantity: string;
  quantityBasis: Cabinet['quantityBasis'];
  usePrices: boolean;
};
export type SheetPreview = {
  name: string;
  hidden: boolean;
  signature: string;
  rows: { row: number; hidden: boolean; cells: string[] }[];
  suggestedHeader: number;
  suggestedMapping: Mapping;
  savedMapping: Mapping | null;
};
export type ImportPreview = {
  fileId: string;
  filename: string;
  sheets: SheetPreview[];
  template: {
    cabinetNames: string[];
    materialCount: number;
    calculation: { total: string; hours: string; pending: number };
  } | null;
};
export const workbenchApi = {
  list: () => request<QuoteSummary[]>('/quotes'),
  get: (id: string) => request<QuoteDocument>(`/quotes/${id}`),
  save: (quote: QuoteDocument, mutationId: string) =>
    request<QuoteDocument>('/quotes', {
      method: 'POST',
      body: JSON.stringify({ quote, mutationId }),
    }),
  remove: (id: string, revision: number) =>
    request(`/quotes/${id}?revision=${revision}`, { method: 'DELETE' }),
  versions: (id: string) => request<Version[]>(`/quotes/${id}/versions`),
  version: (id: string, revision: number) =>
    request<QuoteDocument>(`/quotes/${id}/versions/${revision}`),
  upload: (file: File) => {
    const body = new FormData();
    body.set('file', file);
    return request<ImportPreview>('/imports', { method: 'POST', body });
  },
  apply: (id: string, mode: 'template' | 'custom', configs: ImportConfig[]) =>
    request<{ quote?: QuoteDocument; cabinets: Cabinet[] }>(`/imports/${id}/apply`, {
      method: 'POST',
      body: JSON.stringify({ mode, configs }),
    }),
};
export async function downloadQuote(q: QuoteDocument) {
  const r = await fetch(`${BASE}/quotes/${q.id}/export?revision=${q.revision}`);
  if (!r.ok) {
    const b = await r.json();
    throw new Error(b.error || '导出失败');
  }
  const match = r.headers.get('Content-Disposition')?.match(/filename\*=UTF-8''(.+)/);
  const url = URL.createObjectURL(await r.blob());
  const a = document.createElement('a');
  a.href = url;
  a.download = match ? decodeURIComponent(match[1]) : `${q.quoteNo}.xlsx`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
