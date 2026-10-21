import { mkdir, writeFile, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { pool, DATA_DIR } from '../backend/src/store.js';
import type { RowDataPacket } from 'mysql2/promise';
const stamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-');
const target = path.join(DATA_DIR, 'backups', stamp);
await mkdir(path.join(target, 'uploads'), { recursive: true });
const con = await pool.getConnection();
try {
  await con.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
  await con.query('START TRANSACTION WITH CONSISTENT SNAPSHOT');
  const data: Record<string, unknown> = {
    format: 'jingneng-workbench-backup-v1',
    createdAt: new Date().toISOString(),
  };
  for (const table of ['quotes', 'quote_versions', 'uploads', 'import_profiles']) {
    const [rows] = await con.query<RowDataPacket[]>(`SELECT * FROM ${table}`);
    data[table] = rows;
  }
  await writeFile(path.join(target, 'database.json'), JSON.stringify(data, null, 2));
  for (const upload of data.uploads as { id: string }[])
    await copyFile(
      path.join(DATA_DIR, 'uploads', `${upload.id}.xlsx`),
      path.join(target, 'uploads', `${upload.id}.xlsx`),
    );
  await con.commit();
  console.log(`备份完成：${target}（数据库快照和原始上传文件，不包含数据库密码）`);
} catch (e) {
  await con.rollback();
  throw e;
} finally {
  con.release();
  await pool.end();
}
