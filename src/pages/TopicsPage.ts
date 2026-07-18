import { expect, Page } from '@playwright/test';

export interface TopicSummary {
  id: string;
  title: string;
}

const IN_PROGRESS_STATUS_TEXT = 'In progress';

export class TopicsPage {
  constructor(private readonly page: Page) {}

  async open(): Promise<void> {
    await this.page.goto('/client/topics');
    await expect(this.page.getByRole('heading', { name: /Topics/ })).toBeVisible();
  }

  async openFirstInProgressTopic(): Promise<TopicSummary> {
    await expect(this.page.getByText('Processing...', { exact: true })).toBeHidden({ timeout: 20_000 });
    const inProgressRow = this.page.getByRole('row').filter({ hasText: IN_PROGRESS_STATUS_TEXT }).first();
    await expect(inProgressRow, `Không tìm thấy topic nào có trạng thái "${IN_PROGRESS_STATUS_TEXT}"`).toBeVisible({
      timeout: 20_000,
    });

    const link = inProgressRow.getByRole('link').first();
    const title = (await link.innerText()).trim();
    const href = await link.getAttribute('href');
    if (!href) throw new Error('Link topic không có href');

    const id = href.split('/').pop() ?? '';
    await link.click();
    await expect(this.page).toHaveURL(new RegExp(`/client/topics/${id}`));

    return { id, title };
  }
}
