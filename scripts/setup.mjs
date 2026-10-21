import { randomBytes } from 'node:crypto';
import { mkdir, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(root, '.local/workbench');
await mkdir(dir, { recursive: true });
try {
  await access(path.join(dir, 'mysql.env'));
  console.log('本地数据库配置已存在，保持原配置。');
} catch {
  const password = randomBytes(24).toString('hex');
  await writeFile(
    path.join(dir, 'mysql.env'),
    `MYSQL_DATABASE=jingneng_workbench\nMYSQL_USER=quote_app\nMYSQL_PASSWORD=${password}\nMYSQL_ROOT_PASSWORD=${randomBytes(24).toString('hex')}\n`,
    { flag: 'wx' },
  );
  console.log('已生成独立数据库配置（保存在 .local/workbench，不进入 Git）。');
}
