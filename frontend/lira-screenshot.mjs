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

// 1. 初期画面
await page.goto('http://localhost:3000');
await page.waitForTimeout(1500);
await shot('01_initial');

// 2. プロジェクト作成
await page.click('button[title=""], aside button:has(svg)');  // + ボタン
await page.waitForTimeout(500);
// モーダルが開いたら
const modal = page.locator('.fixed.inset-0');
if (await modal.isVisible()) {
  await page.fill('input[placeholder="My Project"]', 'Lira Demo');
  await page.fill('input[placeholder="PROJ"]', 'DEMO');
  await shot('02_create_project_form');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(1000);
}
await shot('03_after_project_created');

// 3. スプリント作成
await page.click('text=Sprints');
await page.waitForTimeout(500);
await shot('04_sprints_page_empty');

await page.click('button:has-text("New Sprint")');
await page.waitForTimeout(500);
await page.fill('input[placeholder="Sprint 1"]', 'Sprint 1');
await page.fill('input[type="date"]:first-of-type', '2026-03-01');
await page.fill('input[type="date"]:last-of-type', '2026-03-14');
await shot('05_create_sprint_form');
await page.click('button[type="submit"]');
await page.waitForTimeout(800);
await shot('06_sprint_created');

// スプリント開始
await page.click('button:has-text("Start")');
await page.waitForTimeout(800);
await shot('07_sprint_started');

// 4. Issue作成（Board）
await page.click('text=Board');
await page.waitForTimeout(500);
await shot('08_board_no_issues');

await page.click('button:has-text("New Issue")');
await page.waitForTimeout(500);
await page.fill('input[placeholder="Issue title"]', 'ユーザーログイン機能の実装');
await page.selectOption('select:first-of-type', 'story');
await page.selectOption('select:nth-of-type(2)', 'high');
await page.fill('input[placeholder="0"]', '5');
await page.fill('input[placeholder="Name"]', 'Alice');
await shot('09_create_issue_form');
await page.click('button[type="submit"]');
await page.waitForTimeout(800);
await shot('10_board_with_issue');

// Issue追加
for (const [title, type, pts] of [
  ['API設計とドキュメント作成', 'spike', '2'],
  ['ログイン画面のUI実装', 'task', '3'],
  ['バグ: セッションが切れる', 'bug', '1'],
]) {
  await page.click('button:has-text("New Issue")');
  await page.waitForTimeout(400);
  await page.fill('input[placeholder="Issue title"]', title);
  await page.selectOption('select:first-of-type', type);
  await page.fill('input[placeholder="0"]', pts);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(600);
}
await shot('11_board_multiple_issues');

// 5. バックログ画面
await page.click('text=Backlog');
await page.waitForTimeout(500);
await shot('12_backlog_page');

// 6. ボードに戻ってドラッグ確認（スクリーンショットのみ）
await page.click('text=Board');
await page.waitForTimeout(500);
await shot('13_board_final');

await browser.close();
console.log('\n✅ 全スクリーンショット完了');
