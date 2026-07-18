# Trendyze Dashboard Monitor

Bộ kiểm thử Playwright TypeScript dùng mô hình Page Object Model (POM) để:

- Đăng nhập và lưu trạng thái đăng nhập.
- Tự đăng nhập lại nếu session hết hạn và bị chuyển về trang `/login`.
- Chọn Topic đầu tiên có trạng thái `In progress`.
- Kiểm tra toàn bộ tab dashboard.
- Phát hiện dashboard toàn số `0`, thông báo không tải được dữ liệu và API `4xx/5xx`.
- Ghi nhận lỗi console làm ngữ cảnh khi đã có lỗi dashboard/API, nhưng không tự đánh fail chỉ vì console error.
- Bỏ qua riêng cảnh báo Vuetify về `pagination` đã bị loại bỏ.
- Chụp màn hình và gửi thông báo lỗi bằng tiếng Việt qua Telegram.

## Yêu cầu

- Node.js 20 trở lên.
- npm.
- Chromium dành cho Playwright.

## Cài đặt

```bash
npm ci
npx playwright install chromium
```

Trên Linux hoặc môi trường CI, cài thêm dependency hệ thống:

```bash
npx playwright install --with-deps chromium
```

## Cấu hình môi trường

Tạo file `.env` tại thư mục gốc project:

```env
BASE_URL=https://example.com/login
EMAIL=your-email@example.com
PASSWORD=your-password
TELEGRAM_BOT_TOKEN=your-telegram-bot-token
TELEGRAM_CHAT_ID=your-telegram-chat-id
```

Không commit `.env`, mật khẩu hoặc Telegram token lên Git.

## Chạy test

Chạy toàn bộ test ở máy local:

```bash
npm test
```

Ở máy local, Chromium sẽ mở ở chế độ headed và full-screen. Lệnh này chạy lần lượt:

1. Setup đăng nhập và lưu session vào `playwright/.auth/user.json`.
2. Kiểm tra Topic đầu tiên có trạng thái `In progress`.
3. Kiểm tra tất cả tab dashboard.
4. Chụp ảnh và gửi Telegram nếu phát hiện lỗi.

Có thể chạy rõ ràng ở chế độ headed bằng:

```bash
npm run test:headed
```

Chạy headless giống môi trường CI:

```bash
CI=true npm test
```

Chỉ kiểm tra TypeScript:

```bash
npm run typecheck
```

Liệt kê test mà không thực thi:

```bash
npx playwright test --list
```

## Chạy một test cụ thể

Chỉ chạy bước xác thực:

```bash
npx playwright test --project=setup
```

Chạy test dashboard cùng dependency xác thực:

```bash
npx playwright test --project=chromium
```

## Kết quả và báo cáo

Sau khi chạy, báo cáo HTML được tạo tại:

```text
playwright-report/index.html
```

Mở báo cáo bằng:

```bash
npx playwright show-report
```

Screenshot, trace và thông tin lỗi nằm trong:

```text
test-results/
```

Mở một trace cụ thể:

```bash
npx playwright show-trace test-results/<test-name>/trace.zip
```

Test trả về exit code khác `0` khi phát hiện lỗi dashboard, API hoặc console. Đây là hành vi mong đợi để CI đánh dấu lần giám sát bị lỗi.

## Session đăng nhập

Trạng thái đăng nhập được lưu tại:

```text
playwright/.auth/user.json
```

Mỗi lần chạy, bước setup mở `BASE_URL`. Nếu session đã hết hạn và ứng dụng chuyển về `/login`, test sẽ dùng `EMAIL` và `PASSWORD` để đăng nhập lại rồi cập nhật file session.

Không commit file session vì nó có thể chứa cookie xác thực.

## GitHub Actions

Workflow nằm tại `.github/workflows/monitor.yml` và chạy hằng ngày vào các giờ:

```text
08:00, 10:00, 12:00, 14:00, 16:00, 18:00, 20:00, 22:00
```

Múi giờ: `Asia/Ho_Chi_Minh`.

Tạo các GitHub Actions secrets sau trong repository:

- `BASE_URL`
- `EMAIL`
- `PASSWORD`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`

Đường dẫn cấu hình secrets:

```text
Repository Settings → Secrets and variables → Actions → New repository secret
```

Ngoài lịch tự động, có thể chạy thủ công tại:

```text
GitHub → Actions → Trendyze dashboard monitor → Run workflow
```

## Cấu trúc chính

```text
src/
├── config/env.ts
├── pages/
│   ├── LoginPage.ts
│   ├── TopicsPage.ts
│   └── TopicDashboardPage.ts
└── utils/telegram.ts
tests/
├── auth.setup.ts
└── topic-dashboard.spec.ts
playwright.config.ts
.github/workflows/monitor.yml
```
