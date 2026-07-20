import { test, expect, Page } from '@playwright/test';
import { TopicsPage, TopicSummary } from '../src/pages/TopicsPage';
import { TopicDashboardPage, DashboardIssue } from '../src/pages/TopicDashboardPage';
import { sendTelegramPhoto } from '../src/utils/telegram';

const VUETIFY_PAGINATION_WARNING_PATTERN = /\[Vuetify].*pagination.*removed.*options/i;

interface PageDiagnostics {
  apiFailures: ApiFailure[];
  consoleErrors: string[];
  pendingResponseChecks: Promise<void>[];
}

interface ApiFailure {
  status: number;
  url: string;
  reason?: string;
}

const API_REVIEWERS = '@aboyitdev @manhh98 @pedrideveloper01 @Tasha_Tran @Ca_Vien_Chien';

/** Lắng nghe response lỗi (4xx/5xx) và console error trong suốt vòng đời của page. */
function trackPageDiagnostics(page: Page): PageDiagnostics {
  const diagnostics: PageDiagnostics = { apiFailures: [], consoleErrors: [], pendingResponseChecks: [] };

  page.on('response', (response) => {
    if (response.status() >= 400 && response.status() <= 599) {
      diagnostics.apiFailures.push({ status: response.status(), url: response.url() });
      return;
    }

    diagnostics.pendingResponseChecks.push(checkSuccessfulApiResponse(response, diagnostics));
  });

  page.on('console', (message) => {
    if (message.type() === 'error' && !VUETIFY_PAGINATION_WARNING_PATTERN.test(message.text())) {
      diagnostics.consoleErrors.push(message.text());
    }
  });

  return diagnostics;
}

async function checkSuccessfulApiResponse(response: import('@playwright/test').Response, diagnostics: PageDiagnostics) {
  const contentType = response.headers()['content-type'] ?? '';
  if (!contentType.includes('application/json')) return;

  const body = (await response.text().catch(() => '')).toLowerCase();
  const semanticError = [
    'es_rejected_execution_exception',
    'search_phase_execution_exception',
    'index_not_found_exception',
    'cluster_block_exception',
    '"timed_out"\\s*:\\s*true',
    '"status"\\s*:\\s*"red"',
    '"success"\\s*:\\s*false',
  ].find((pattern) => new RegExp(pattern, 'i').test(body));

  if (semanticError) {
    diagnostics.apiFailures.push({
      status: response.status(),
      url: response.url(),
      reason: `Response 2xx chứa dấu hiệu lỗi Elasticsearch: ${semanticError}`,
    });
  }
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

  if (apiFailures.some(({ reason }) => reason?.includes('Elasticsearch'))) {
    reviewRequests.push(
      `${API_REVIEWERS} nhờ kiểm tra lại Elasticsearch/backend vì API 2xx vẫn chứa dấu hiệu lỗi.`,
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
  await Promise.allSettled(diagnostics.pendingResponseChecks);

  if (diagnostics.apiFailures.length) {
    const semanticFailures = diagnostics.apiFailures.filter(({ reason }) => reason?.includes('Elasticsearch'));
    const clientFailures = diagnostics.apiFailures.filter(({ status, reason }) => status >= 400 && status < 500 && !reason);
    const serverFailures = diagnostics.apiFailures.filter(({ status }) => status >= 500);

    if (semanticFailures.length) {
      issues.push({
        tab: 'API 2xx/Elasticsearch',
        reason: semanticFailures.map(({ status, url, reason }) => `${status} ${url} - ${reason}`).join(' | '),
      });
    }

    if (serverFailures.length) {
      issues.push({
        tab: 'API 5xx',
        reason: serverFailures.map(({ status, url, reason }) => `${status} ${url}${reason ? ` - ${reason}` : ''}`).join(' | '),
      });
    }

    if (clientFailures.length) {
      issues.push({
        tab: 'API 4xx',
        reason: clientFailures.map(({ status, url, reason }) => `${status} ${url}${reason ? ` - ${reason}` : ''}`).join(' | '),
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
