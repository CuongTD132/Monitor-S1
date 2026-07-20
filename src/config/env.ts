import fs from 'node:fs';
import path from 'node:path';

/**
 * Nạp file .env ở thư mục gốc project (nếu có) vào process.env.
 * Không ghi đè biến môi trường đã được set sẵn từ bên ngoài (ví dụ trên CI).
 */
function loadDotEnv(): void {
  const file = path.resolve('.env');
  if (!fs.existsSync(file)) return;

  for (const rawLine of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const separatorIndex = line.indexOf('=');
    if (separatorIndex < 0) continue;

    const key = line.slice(0, separatorIndex).trim();
    const value = line
      .slice(separatorIndex + 1)
      .trim()
      .replace(/^(['"])(.*)\1$/, '$2');

    if (!process.env[key]) process.env[key] = value;
  }
}

loadDotEnv();

/** Đọc một biến môi trường bắt buộc, ném lỗi rõ ràng nếu thiếu. */
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Thiếu biến môi trường bắt buộc: ${name}`);
  return value
    .trim()
    .replace(/^(['"])(.*)\1$/, '$2');
}

/** Các biến môi trường không bắt buộc, dùng trực tiếp trong cấu hình Playwright. */
export const env = {
  baseUrl: process.env.BASE_URL,
  isHeaded: process.env.HEADED === 'true' || !process.env.CI,
} as const;

/** Đường dẫn lưu trạng thái đăng nhập (storage state) dùng chung toàn project. */
export const AUTH_STATE_PATH = path.resolve('playwright/.auth/user.json');
