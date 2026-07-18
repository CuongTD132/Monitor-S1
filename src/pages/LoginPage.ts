import { expect, Page } from '@playwright/test';

const DASHBOARD_URL_PATTERN = /\/client\/dashboard/;

export class LoginPage {
  constructor(private readonly page: Page) {}

  async login(email: string, password: string): Promise<void> {
    await this.page.getByRole('textbox', { name: 'Email' }).fill(email);
    await this.page.getByRole('textbox', { name: 'Password' }).fill(password);

    const rememberMeCheckbox = this.page.getByRole('checkbox', { name: 'Remember Me' });
    if (!(await rememberMeCheckbox.isChecked())) {
      // Checkbox tùy biến (Vuetify) không luôn nhận click trực tiếp, click vào label để chắc chắn.
      await this.page.getByText('Remember Me', { exact: true }).click();
    }

    await this.page.getByRole('button', { name: 'Log In' }).click();
    await expect(this.page).toHaveURL(DASHBOARD_URL_PATTERN);
  }
}
