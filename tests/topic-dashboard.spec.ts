import { test, expect, Page } from '@playwright/test';
import { TopicsPage, TopicSummary } from '../src/pages/TopicsPage';
import { TopicDashboardPage, DashboardIssue } from '../src/pages/TopicDashboardPage';
import { sendTelegramPhoto } from '../src/utils/telegram';

const VUETIFY_PAGINATION_WARNING_PATTERN = /\[Vuetify].*pagination.*removed.*options/i;

interface PageDiagnostics {
  apiFailures: ApiFailure[];
  consoleErrors: string[];
}

interface ApiFailure {
  status: number;
  url: string;
}

const API_REVIEWERS = '@aboyitdev @manhh98 @pedrideveloper01 @Tasha_Tran @Ca_Vien_Chien';

/** Lắng nghe response lỗi (4xx/5xx) và console error trong suốt vòng đời của page. */
function trackPageDiagnostics(page: Page): PageDiagnostics {
  const diagnostics: PageDiagnostics = { apiFailures: [], consoleErrors: [] };

  page.on('response', (response) => {
    if (response.status() >= 400 && response.status() <= 599) {
      diagnostics.apiFailures.push({ status: response.status(), url: response.url() });
    }
  });

  page.on('console', (message) => {
    if (message.type() === 'error' && !VUETIFY_PAGINATION_WARNING_PATTERN.test(message.text())) {
      diagnostics.consoleErrors.push(message.text());
    }
  });

  return diagnostics;
}

function buildTelegramCaption(
  topic: TopicSummary,
  issues: DashboardIssue[],
  apiFailures: ApiFailure[],
): string {
  const details = issues.map((issue) => `- ${issue.tab}: ${issue.reason}`).join('\n');
  const reviewRequests: string[] = [];

  if (apiFailures.some(({ status }) => status >= 500)) {
    reviewRequests.push(
      `${API_REVIEWERS} nhờ kiểm tra lại phía server/backend của API bị lỗi 5xx được liệt kê bên dưới.`,
    );
  }

  if (apiFailures.some(({ status }) => status >= 400 && status < 500)) {
    reviewRequests.push(
      `${API_REVIEWERS} nhờ kiểm tra lại request, quyền truy cập hoặc xác thực của API bị lỗi 4xx được liệt kê bên dưới.`,
    );
  }

  return [
    'Kết quả kiểm thử Trendyze',
    `Topic #${topic.id} - ${topic.title}`,
    ...reviewRequests,
    'Lỗi phát hiện:',
    details,
  ].join('\n');
}

function buildStableTelegramCaption(): string {
  return [
    ' Xác nhận hệ thống Trendyze đang hoạt động ổn định',
  ].join('\n');
}

test('kiểm tra dashboard topic In progress', async ({ page }, testInfo) => {
  const diagnostics = trackPageDiagnostics(page);

  const topicsPage = new TopicsPage(page);
  await topicsPage.open();
  const topic = await topicsPage.openFirstInProgressTopic();

  const dashboardPage = new TopicDashboardPage(page);
  await dashboardPage.closeFilterResults();
  const issues = await dashboardPage.inspectAllTabs();

  if (diagnostics.apiFailures.length) {
    const clientFailures = diagnostics.apiFailures.filter(({ status }) => status < 500);
    const serverFailures = diagnostics.apiFailures.filter(({ status }) => status >= 500);

    if (serverFailures.length) {
      issues.push({
        tab: 'API 5xx',
        reason: serverFailures.map(({ status, url }) => `${status} ${url}`).join(' | '),
      });
    }

    if (clientFailures.length) {
      issues.push({
        tab: 'API 4xx',
        reason: clientFailures.map(({ status, url }) => `${status} ${url}`).join(' | '),
      });
    }
  }
  // Console error không thuộc điều kiện cảnh báo chính. Chỉ đính kèm làm
  // ngữ cảnh khi đã có lỗi dashboard/API cần báo Telegram.
  if (issues.length > 0 && diagnostics.consoleErrors.length) {
    issues.push({ tab: 'Console', reason: diagnostics.consoleErrors.join(' | ') });
  }

  if (issues.length === 0) {
    const overviewTab = page.getByRole('tab', { name: 'Discussion Overview', exact: true });
    await overviewTab.click();
    await page.waitForTimeout(2_000);
    const screenshotPath = testInfo.outputPath(`topic-${topic.id}-discussion-overview-stable.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    await sendTelegramPhoto(buildStableTelegramCaption(), screenshotPath);
    return;
  }

  const screenshotPath = testInfo.outputPath(`topic-${topic.id}-dashboard.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true });

  const caption = buildTelegramCaption(topic, issues, diagnostics.apiFailures);
  await sendTelegramPhoto(caption, screenshotPath);

  expect(issues, caption).toEqual([]);
});
