import { test, expect, Page } from '@playwright/test';
import { TopicsPage, TopicSummary } from '../src/pages/TopicsPage';
import { TopicDashboardPage, DashboardIssue } from '../src/pages/TopicDashboardPage';
import { sendTelegramPhoto } from '../src/utils/telegram';

const VUETIFY_PAGINATION_WARNING_PATTERN = /\[Vuetify].*pagination.*removed.*options/i;

interface PageDiagnostics {
  apiFailures: string[];
  consoleErrors: string[];
}

/** Lắng nghe response lỗi (4xx/5xx) và console error trong suốt vòng đời của page. */
function trackPageDiagnostics(page: Page): PageDiagnostics {
  const diagnostics: PageDiagnostics = { apiFailures: [], consoleErrors: [] };

  page.on('response', (response) => {
    if (response.status() >= 400 && response.status() <= 599) {
      diagnostics.apiFailures.push(`${response.status()} ${response.url()}`);
    }
  });

  page.on('console', (message) => {
    if (message.type() === 'error' && !VUETIFY_PAGINATION_WARNING_PATTERN.test(message.text())) {
      diagnostics.consoleErrors.push(message.text());
    }
  });

  return diagnostics;
}

function buildTelegramCaption(topic: TopicSummary, issues: DashboardIssue[]): string {
  const details = issues.map((issue) => `- ${issue.tab}: ${issue.reason}`).join('\n');
  return [
    'Kết quả kiểm thử Trendyze',
    `Topic #${topic.id} - ${topic.title}`,
    'Đã đăng nhập và kiểm tra toàn bộ tab.',
    'Lỗi phát hiện:',
    details,
  ].join('\n');
}

test('kiểm tra dashboard topic In progress', async ({ page }, testInfo) => {
  const diagnostics = trackPageDiagnostics(page);

  const topicsPage = new TopicsPage(page);
  await topicsPage.open();
  const topic = await topicsPage.openFirstInProgressTopic();

  const dashboardPage = new TopicDashboardPage(page);
  const issues = await dashboardPage.inspectAllTabs();

  if (diagnostics.apiFailures.length) {
    issues.push({ tab: 'API', reason: `API trả về lỗi: ${diagnostics.apiFailures.join(' | ')}` });
  }
  if (diagnostics.consoleErrors.length) {
    issues.push({ tab: 'Console', reason: diagnostics.consoleErrors.join(' | ') });
  }

  if (issues.length === 0) return;

  const screenshotPath = testInfo.outputPath(`topic-${topic.id}-dashboard.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true });

  const caption = buildTelegramCaption(topic, issues);
  await sendTelegramPhoto(caption, screenshotPath);

  expect(issues, caption).toEqual([]);
});
