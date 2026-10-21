import express from 'express';
import multer from 'multer';
import { z } from 'zod';
import { randomUUID, createHash } from 'node:crypto';
import { readFile, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import type { RowDataPacket } from 'mysql2/promise';
import {
  quoteSchema,
  calculateQuote,
  CALCULATION_VERSION,
  validationMessage,
} from '@jingneng/quote-core';
import {
  DATA_DIR,
  ROOT,
  pool,
  initialize,
  HttpError,
  getQuote,
  listQuotes,
  saveQuote,
  jsonValue,
} from './store.js';
import {
  loadExcel,
  previewSheets,
  parseTemplate,
  mapImport,
  exportQuote,
  type ImportConfig,
} from './excel.js';

const app = express();
app.disable('x-powered-by');
app.use('/api/workbench', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  const origin = req.get('origin');
  if (
    origin &&
    ![
      'http://127.0.0.1:5271',
      'http://localhost:5271',
      'http://127.0.0.1:5273',
      'http://localhost:5273',
    ].includes(origin)
  ) {
    res.status(403).json({ error: '此工作台只接受本机页面的请求' });
    return;
  }
  next();
});
app.use(express.json({ limit: '15mb' }));
const api = express.Router();
app.use('/api/workbench', api);
const uuid = z.string().uuid();
const paramId = (value: unknown) => uuid.parse(value);
api.get('/health', async (_req, res) => {
  await pool.query('SELECT 1');
  res.json({
    service: 'jingneng-quote-workbench',
    database: 'connected',
    calculationVersion: CALCULATION_VERSION,
  });
});
api.get('/quotes', async (_req, res) => res.json(await listQuotes()));
api.get('/quotes/:id', async (req, res) => res.json(await getQuote(paramId(req.params.id))));
api.post('/quotes', async (req, res) => {
  const { quote, mutationId } = z.object({ quote: quoteSchema, mutationId: uuid }).parse(req.body);
  res.json(await saveQuote(quote, mutationId));
});
api.delete('/quotes/:id', async (req, res) => {
  const id = paramId(req.params.id);
  const revision = z.coerce.number().int().positive().parse(req.query.revision);
  const [result] = await pool.execute<import('mysql2').ResultSetHeader>(
    'UPDATE quotes SET deleted=TRUE WHERE id=? AND revision=? AND deleted=FALSE',
    [id, revision],
  );
  if (!result.affectedRows) throw new HttpError(409, '报价版本已变化，请刷新后再删除');
  res.json({ ok: true });
});
api.get('/quotes/:id/versions', async (req, res) => {
  const id = paramId(req.params.id);
  await getQuote(id);
  const [rows] = await pool.execute<RowDataPacket[]>(
    'SELECT revision,saved_at,calculation FROM quote_versions WHERE quote_id=? ORDER BY revision DESC LIMIT 100',
    [id],
  );
  res.json(
    rows.map((r) => ({
      revision: r.revision,
      savedAt: r.saved_at,
      total: jsonValue(r.calculation).total,
    })),
  );
});
api.get('/quotes/:id/versions/:revision', async (req, res) => {
  const id = paramId(req.params.id);
  await getQuote(id);
  const revision = z.coerce.number().int().positive().parse(req.params.revision);
  const [rows] = await pool.execute<RowDataPacket[]>(
    'SELECT payload FROM quote_versions WHERE quote_id=? AND revision=?',
    [id, revision],
  );
  if (!rows[0]) throw new HttpError(404, '找不到此版本');
  res.json(jsonValue(rows[0].payload));
});
api.get('/quotes/:id/export', async (req, res) => {
  const q = await getQuote(paramId(req.params.id));
  const expected = z.coerce.number().int().positive().parse(req.query.revision);
  if (q.revision !== expected) throw new HttpError(409, '报价版本已变化，请刷新后导出');
  const calc = calculateQuote(q);
  const filename =
    `${q.quoteNo}-${q.customerName || '报价'}-v${q.revision}${calc.pending || calc.unassigned ? '（草稿）' : ''}.xlsx`.replace(
      /[<>:"/\\|?*\r\n]/g,
      '_',
    );
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  );
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="quote.xlsx"; filename*=UTF-8''${encodeURIComponent(filename)}`,
  );
  res.send(await exportQuote(q));
});
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024, files: 1 },
});
api.post('/imports', upload.single('file'), async (req, res) => {
  if (!req.file) throw new HttpError(400, '请选择 Excel 文件');
  const filename = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
  if (!/\.xlsx$/i.test(filename))
    throw new HttpError(400, '本版支持 .xlsx 文件，请将 .xls 或 .xlsm 另存为 .xlsx 后导入');
  let wb;
  try {
    wb = await loadExcel(req.file.buffer);
  } catch (e) {
    throw new HttpError(
      400,
      e instanceof Error && e.message.includes('处理范围')
        ? e.message
        : '无法读取此 Excel，请确认文件未加密且为有效的 .xlsx',
    );
  }
  const fileId = randomUUID();
  const sheets = previewSheets(wb);
  const template = parseTemplate(wb, filename, fileId);
  await writeFile(path.join(DATA_DIR, 'uploads', `${fileId}.xlsx`), req.file.buffer, {
    flag: 'wx',
  });
  await pool.execute('INSERT INTO uploads (id,filename,sha256) VALUES (?,?,?)', [
    fileId,
    filename,
    createHash('sha256').update(req.file.buffer).digest('hex'),
  ]);
  const [profiles] = await pool.query<RowDataPacket[]>(
    'SELECT signature,mapping FROM import_profiles',
  );
  res.json({
    fileId,
    filename,
    sheets: sheets.map((s) => ({
      ...s,
      savedMapping: jsonValue(profiles.find((p) => p.signature === s.signature)?.mapping ?? null),
    })),
    template: template
      ? {
          cabinetNames: template.cabinets.map((c) => c.name),
          materialCount: template.cabinets.reduce((n, c) => n + c.materials.length, 0),
          calculation: calculateQuote(template),
        }
      : null,
  });
});
const column = z.number().int().min(-1).max(199);
const importConfig = z.object({
  sheet: z.string().max(100),
  headerRow: z.number().int().min(1).max(10000),
  startRow: z.number().int().min(1).max(10000),
  endRow: z.number().int().min(1).max(10000),
  mapping: z.object({
    name: column,
    model: column,
    brand: column,
    quantity: column,
    unit: column,
    unitPrice: column,
    remark: column,
    leadTime: column,
    cabinet: column,
  }),
  excludedRows: z.array(z.number().int()).max(10000),
  includeHidden: z.boolean(),
  cabinetName: z.string().max(8000),
  cabinetQuantity: z
    .string()
    .max(40)
    .regex(/^\d+(\.\d+)?$/)
    .refine((n) => Number(n) > 0 && Number(n) < 1e10),
  quantityBasis: z.enum(['perCabinet', 'project', 'unassigned']),
  usePrices: z.boolean(),
});
api.post('/imports/:id/apply', async (req, res) => {
  const id = paramId(req.params.id);
  const body = z
    .object({
      mode: z.enum(['template', 'custom']),
      configs: z.array(importConfig).max(50).default([]),
      rememberMapping: z.boolean().default(true),
    })
    .parse(req.body);
  const [rows] = await pool.execute<RowDataPacket[]>('SELECT filename FROM uploads WHERE id=?', [
    id,
  ]);
  if (!rows[0]) throw new HttpError(404, '找不到导入文件，请重新上传');
  const wb = await loadExcel(await readFile(path.join(DATA_DIR, 'uploads', `${id}.xlsx`)));
  if (body.mode === 'template') {
    const quote = parseTemplate(wb, rows[0].filename, id);
    if (!quote) throw new HttpError(400, '此文件不是原报价模板');
    res.json({ quote: quoteSchema.parse(quote), cabinets: quote.cabinets });
    return;
  }
  const sheets = previewSheets(wb);
  let cabinets: ReturnType<typeof mapImport>;
  try {
    cabinets = mapImport(sheets, body.configs as ImportConfig[], rows[0].filename, id);
  } catch (error) {
    throw new HttpError(400, error instanceof Error ? error.message : '清单识别失败，请检查列对应');
  }
  if (body.rememberMapping)
    for (const cfg of body.configs) {
      const signature = sheets.find((s) => s.name === cfg.sheet)!.signature;
      await pool.execute(
        'INSERT INTO import_profiles (signature,mapping) VALUES (?,?) ON DUPLICATE KEY UPDATE mapping=VALUES(mapping)',
        [signature, JSON.stringify(cfg.mapping)],
      );
    }
  res.json({ cabinets });
});
api.use((_req, res) => res.status(404).json({ error: '接口不存在' }));
app.use(express.static(path.join(ROOT, 'frontend/dist')));
app.get('/{*path}', async (_req, res) => {
  const index = path.join(ROOT, 'frontend/dist/index.html');
  try {
    await access(index);
    res.sendFile(index);
  } catch {
    res.status(503).send('请先运行 npm run build，或使用开发地址 http://127.0.0.1:5273');
  }
});
app.use(
  (error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: `数据未保存：${error.issues.slice(0, 3).map(validationMessage).join('；')}`,
      });
      return;
    }
    if (error instanceof HttpError) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    if (error instanceof multer.MulterError) {
      res.status(400).json({ error: '文件上传失败：请使用不超过 12 MB 的 .xlsx 文件' });
      return;
    }
    console.error('请求失败', error instanceof Error ? error.message : 'unknown error');
    res.status(500).json({ error: '操作未完成，请重试。编辑内容仍保留在当前页。' });
  },
);
await initialize();
const server = app.listen(5271, '127.0.0.1', () =>
  console.log('报价工作台 http://127.0.0.1:5271/quotes · 数据库已连接'),
);
for (const signal of ['SIGINT', 'SIGTERM'] as const)
  process.on(signal, () => server.close(() => void pool.end().finally(() => process.exit(0))));
