import fs from 'node:fs/promises';
import { requireEnv } from '../config/env';

const TELEGRAM_API_BASE_URL = 'https://api.telegram.org';
const CAPTION_MAX_LENGTH = 1024;

/** Gửi một ảnh kèm caption tới chat Telegram được cấu hình qua biến môi trường. */
export async function sendTelegramPhoto(caption: string, filePath: string): Promise<void> {
  const token = requireEnv('TELEGRAM_BOT_TOKEN');
  const chatId = requireEnv('TELEGRAM_CHAT_ID');

  const form = new FormData();
  form.append('chat_id', chatId);
  form.append('caption', caption.slice(0, CAPTION_MAX_LENGTH));
  form.append('photo', new Blob([await fs.readFile(filePath)], { type: 'image/png' }), 'dashboard.png');

  const response = await fetch(`${TELEGRAM_API_BASE_URL}/bot${token}/sendPhoto`, {
    method: 'POST',
    body: form,
  });

  if (!response.ok) {
    throw new Error(`Gửi ảnh Telegram thất bại: HTTP ${response.status}`);
  }
}
