import { expect, Locator, Page } from '@playwright/test';

export const DASHBOARD_TABS = [
  'Discussion Overview',
  'Sentiment',
  'Demographic',
  'Top Sources',
  'Top Threads',
  'Attributes',
  'Media & Tags',
  'Mentions',
  'Competitor Comparison',
] as const;

export const REVERSE_DASHBOARD_TABS: readonly string[] = [...DASHBOARD_TABS].reverse();

export type DashboardIssue = { tab: string; reason: string };

const UNABLE_TO_LOAD_MESSAGE_PATTERN = /unable to load (?:reaction|sentiment) data/i;
const NUMBER_PATTERN = /(?<![\d,.])-?\d[\d,.]*/g;
const ZERO_VALUE_PATTERN = /^0(?:[,.]0+)?$/;
const MIN_ZEROS_TO_FLAG_AS_BROKEN = 8;
const MIN_PANEL_LOAD_WAIT_MS = 2_000;

// Panel không có tín hiệu network-idle đáng tin cậy (SPA có polling nền), nên
// thay vì một waitForTimeout cố định, ta chờ nội dung text của panel "đứng yên"
// giữa các lần đọc liên tiếp, với số lần thử giới hạn để tránh treo test.
const PANEL_STABILITY_CHECKS = 5;
const PANEL_STABILITY_INTERVAL_MS = 200;

export class TopicDashboardPage {
  constructor(private readonly page: Page) {}

  async closeFilterResults(): Promise<void> {
    const closeButton = this.page.locator('button.filter-section-close');
    // Trên một số viewport/CI, panel đã tự đóng và nút vẫn tồn tại nhưng bị ẩn.
    if (!(await closeButton.isVisible())) return;
    await closeButton.click();
    await expect(closeButton).toBeHidden();
  }

  async inspectAllTabs(tabOrder: readonly string[] = REVERSE_DASHBOARD_TABS): Promise<DashboardIssue[]> {
    const issues: DashboardIssue[] = [];

    for (const tabName of tabOrder) {
      const tab = this.page.getByRole('tab', { name: tabName, exact: true });
      await expect(tab).toBeVisible();
      await tab.click();

      const panel = this.page.getByRole('tabpanel');
      await expect(panel).toBeVisible();
      // Các card ban đầu render giá trị 0 trước khi API hoàn tất; cần cho dữ liệu
      // tối thiểu một khoảng thời gian để hydrate rồi mới đánh giá độ ổn định.
      await this.page.waitForTimeout(MIN_PANEL_LOAD_WAIT_MS);
      await this.waitForPanelToStabilize(panel);

      const text = await panel.innerText().catch(() => '');
      const issue = this.detectIssue(tabName, text);
      if (issue) issues.push(issue);
    }

    return issues;
  }

  private async waitForPanelToStabilize(panel: Locator): Promise<void> {
    let previousText: string | null = null;

    for (let attempt = 0; attempt < PANEL_STABILITY_CHECKS; attempt += 1) {
      const currentText = await panel.innerText().catch(() => '');
      if (currentText !== '' && currentText === previousText) return;
      previousText = currentText;
      await this.page.waitForTimeout(PANEL_STABILITY_INTERVAL_MS);
    }
  }

  private detectIssue(tabName: string, panelText: string): DashboardIssue | null {
    if (UNABLE_TO_LOAD_MESSAGE_PATTERN.test(panelText)) {
      return { tab: tabName, reason: 'Hiển thị thông báo Unable to load reaction/sentiment data' };
    }

    const numbers = [...panelText.matchAll(NUMBER_PATTERN)].map((match) => match[0]);
    const zeroCount = numbers.filter((n) => ZERO_VALUE_PATTERN.test(n)).length;
    const hasNonZeroValue = numbers.some((n) => !ZERO_VALUE_PATTERN.test(n));

    if (zeroCount >= MIN_ZEROS_TO_FLAG_AS_BROKEN && !hasNonZeroValue) {
      return { tab: tabName, reason: 'Dashboard hiển thị toàn bộ số 0' };
    }

    return null;
  }
}
