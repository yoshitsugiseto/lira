import { chromium } from '@playwright/test';
import { mkdir } from 'fs/promises';

const OUT = '/tmp/lira-screenshots2';
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.setDefaultTimeout(8000);
await page.setViewportSize({ width: 1440, height: 900 });

async function shot(name) {
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log(`📸 ${name}`);
}

await page.goto('http://localhost:3000');
await page.waitForTimeout(1000);
await page.click('text=Test Project');
await page.waitForTimeout(600);

// Board
await page.click('text=Board');
await page.waitForTimeout(800);
await shot('01_board_header');

// Issue詳細モーダル
const cards = page.locator('.bg-white.rounded-lg.border.border-gray--200');
const firstCard = page.locator('.cursor-grab').first();
if (await firstCard.isVisible()) {
  await firstCard.click();
  await page.waitForTimeout(800);
  await shot('02_issue_detail_modal');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
}

// Backlog
await page.click('text=Backlog');
await page.waitForTimeout(800);
await shot('03_backlog_improved');

// コメント追加テスト
await page.locator('text=ユーザーログイン機能').first().click();
await page.waitForTimeout(600);
await shot('04_issue_detail_from_backlog');
await page.fill('input[placeholder="Your name"]', 'Alice');
await page.fill('textarea[placeholder="Add a comment..."]', 'このIssueはログイン機能のコアです。JWTで実装予定です。');
await page.click('button:has-text("Comment")');
await page.waitForTimeout(600);
await shot('05_issue_with_comment');
await page.keyboard.press('Escape');

await browser.close();
console.log('\n✅ 完了');
