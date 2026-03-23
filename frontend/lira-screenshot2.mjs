import { chromium } from '@playwright/test';
import { mkdir } from 'fs/promises';

const OUT = '/tmp/lira-screenshots';
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.setDefaultTimeout(8000);
await page.setViewportSize({ width: 1440, height: 900 });

async function shot(name) {
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });
  console.log(`📸 ${name}`);
}

await page.goto('http://localhost:3000');
await page.waitForTimeout(1000);

// プロジェクト TEST が既にある状態でクリック
await page.click('text=Test Project');
await page.waitForTimeout(500);

// Boardページへ
await page.click('text=Board');
await page.waitForTimeout(800);
await shot('08_board_no_issues');

// New Issue ボタンクリック
await page.click('button:has-text("New Issue")');
await page.waitForTimeout(600);
await shot('09a_issue_modal_open');

// モーダル内のフォームに入力
await page.locator('div.fixed input[placeholder="Issue title"]').fill('ユーザーログイン機能の実装');

// モーダル内の select を使う
const selects = page.locator('div.fixed select');
await selects.nth(0).selectOption('story');
await selects.nth(1).selectOption('high');
await page.locator('div.fixed input[placeholder="0"]').fill('5');
await page.locator('div.fixed input[placeholder="Name"]').fill('Alice');
await shot('09_create_issue_form');
await page.locator('div.fixed button[type="submit"]').click();
await page.waitForTimeout(1000);
await shot('10_board_with_issue');

// さらにIssue追加
const issues = [
  { title: 'API設計とドキュメント作成', type: 'spike', pts: '2', assignee: 'Bob' },
  { title: 'ログイン画面のUI実装', type: 'task', pts: '3', assignee: 'Alice' },
  { title: 'バグ: セッションが切れる', type: 'bug', pts: '1', assignee: 'Carol' },
  { title: 'テストコード整備', type: 'task', pts: '2', assignee: 'Bob' },
];

for (const issue of issues) {
  await page.click('button:has-text("New Issue")');
  await page.waitForTimeout(400);
  await page.locator('div.fixed input[placeholder="Issue title"]').fill(issue.title);
  await page.locator('div.fixed select').nth(0).selectOption(issue.type);
  await page.locator('div.fixed input[placeholder="0"]').fill(issue.pts);
  await page.locator('div.fixed input[placeholder="Name"]').fill(issue.assignee);
  await page.locator('div.fixed button[type="submit"]').click();
  await page.waitForTimeout(700);
}
await shot('11_board_multiple_issues');

// バックログページ
await page.click('text=Backlog');
await page.waitForTimeout(800);
await shot('12_backlog_page');

// スプリントページ
await page.click('text=Sprints');
await page.waitForTimeout(800);
await shot('13_sprint_page_active');

// 戻ってボード確認
await page.click('text=Board');
await page.waitForTimeout(800);
await shot('14_board_final');

await browser.close();
console.log('\n✅ 完了');
