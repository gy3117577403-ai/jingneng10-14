import mysql, { type RowDataPacket } from 'mysql2/promise';
import { readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parse } from 'dotenv';
import { calculateQuote, type QuoteDocument } from '@jingneng/quote-core';

export const ROOT = fileURLToPath(new URL('../../', import.meta.url));
export const DATA_DIR = path.join(ROOT, '.local/workbench');
mkdirSync(path.join(DATA_DIR, 'uploads'), { recursive: true });
const env = parse(readFileSync(path.join(DATA_DIR, 'mysql.env')));
export const pool = mysql.createPool({
  host: '127.0.0.1',
  port: 33371,
  user: env.MYSQL_USER,
  password: env.MYSQL_PASSWORD,
  database: env.MYSQL_DATABASE,
  connectionLimit: 5,
  charset: 'utf8mb4',
  timezone: 'Z',
});
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
// MySQL returns native JSON values; MariaDB exposes its JSON alias as text.
export function jsonValue<T = any>(value: T | string): T {
  return typeof value === 'string' ? JSON.parse(value) : value;
}
export async function initialize() {
  await pool.query(`CREATE TABLE IF NOT EXISTS quotes (
    id CHAR(36) PRIMARY KEY, quote_no VARCHAR(80) NOT NULL UNIQUE, revision INT NOT NULL,
    payload JSON NOT NULL, calculation JSON NOT NULL, deleted BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3))`);
  await pool.query(`CREATE TABLE IF NOT EXISTS quote_versions (
    quote_id CHAR(36) NOT NULL, revision INT NOT NULL, mutation_id CHAR(36) NOT NULL UNIQUE,
    payload JSON NOT NULL, calculation JSON NOT NULL, saved_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY(quote_id,revision), FOREIGN KEY (quote_id) REFERENCES quotes(id))`);
  await pool.query(`CREATE TABLE IF NOT EXISTS uploads (
    id CHAR(36) PRIMARY KEY, filename VARCHAR(1000) NOT NULL, sha256 CHAR(64) NOT NULL,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3))`);
  await pool.query(`CREATE TABLE IF NOT EXISTS import_profiles (
    signature CHAR(64) PRIMARY KEY, mapping JSON NOT NULL, updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3))`);
}
export async function getQuote(id: string): Promise<QuoteDocument> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    'SELECT payload FROM quotes WHERE id=? AND deleted=FALSE',
    [id],
  );
  if (!rows[0]) throw new HttpError(404, '报价不存在或已移至回收站');
  return jsonValue<QuoteDocument>(rows[0].payload);
}
export async function listQuotes() {
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT id, quote_no, revision, payload, calculation, updated_at, created_at FROM quotes WHERE deleted=FALSE ORDER BY updated_at DESC LIMIT 500',
  );
  return rows.map((r) => {
    const payload = jsonValue<QuoteDocument>(r.payload),
      calculation = jsonValue<ReturnType<typeof calculateQuote>>(r.calculation);
    return {
      id: r.id,
      quoteNo: r.quote_no,
      revision: r.revision,
      customerName: payload.customerName,
      projectName: payload.projectName,
      quotationDate: payload.quotationDate,
      total: calculation.total,
      pending: calculation.pending,
      unassigned: calculation.unassigned,
      cabinetCount: calculation.cabinetCount,
      updatedAt: r.updated_at,
    };
  });
}
export async function saveQuote(input: QuoteDocument, mutationId: string) {
  const con = await pool.getConnection();
  try {
    await con.beginTransaction();
    const [retry] = await con.execute<RowDataPacket[]>(
      'SELECT payload FROM quote_versions WHERE mutation_id=?',
      [mutationId],
    );
    if (retry[0]) {
      const previous = jsonValue<QuoteDocument>(retry[0].payload);
      if (previous.id !== input.id) throw new HttpError(409, '保存请求标识重复，请重新保存');
      await con.commit();
      return previous;
    }
    const [rows] = await con.execute<RowDataPacket[]>(
      'SELECT revision, quote_no, deleted FROM quotes WHERE id=? FOR UPDATE',
      [input.id],
    );
    if (rows[0]?.deleted) throw new HttpError(409, '这份报价已经删除，请另存为新报价');
    if ((rows[0]?.revision ?? 0) !== input.revision)
      throw new HttpError(
        409,
        '报价已在另一窗口更新。你的编辑仍保留在当前页，请另存副本，或重新打开最新版后合并。',
      );
    const q = structuredClone(input);
    q.revision++;
    q.quoteNo =
      rows[0]?.quote_no ??
      `JN${q.quotationDate.replaceAll('-', '')}-${q.id.slice(0, 8).toUpperCase()}`;
    const payload = JSON.stringify(q);
    const calculation = JSON.stringify(calculateQuote(q));
    if (rows[0])
      await con.execute('UPDATE quotes SET revision=?, payload=?, calculation=? WHERE id=?', [
        q.revision,
        payload,
        calculation,
        q.id,
      ]);
    else
      await con.execute(
        'INSERT INTO quotes (id,quote_no,revision,payload,calculation) VALUES (?,?,?,?,?)',
        [q.id, q.quoteNo, q.revision, payload, calculation],
      );
    await con.execute(
      'INSERT INTO quote_versions (quote_id,revision,mutation_id,payload,calculation) VALUES (?,?,?,?,?)',
      [q.id, q.revision, mutationId, payload, calculation],
    );
    await con.commit();
    return q;
  } catch (error) {
    await con.rollback();
    throw error;
  } finally {
    con.release();
  }
}
