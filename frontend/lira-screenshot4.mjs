import { chromium } from '@playwright/test';
import { mkdir } from 'fs/promises';

const OUT = '/tmp/lira-screenshots3';
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
await page.waitForTimeout(800);
await page.click('text=Test Project');
await page.waitForTimeout(600);

// フィルターボタン表示
await page.click('text=Board');
await page.waitForTimeout(600);
await page.click('button:has-text("Filter")');
await page.waitForTimeout(400);
await shot('01_board_with_filter_panel');

// フィルター適用（High優先度）
await page.click('button:has-text("high")');
await page.waitForTimeout(500);
await shot('02_board_filtered_high');

// 優先度ソート
await page.click('button:has-text("high")'); // フィルタ解除
await page.click('button:has-text("Filter")'); // フィルタ閉じる
await page.click('button:has-text("Priority")');
await page.waitForTimeout(400);
await shot('03_board_sorted_priority');

// バーンダウンチャート
await page.click('button:has-text("Burndown")');
await page.waitForTimeout(800);
await shot('04_board_with_burndown');

// Sprint ページのバーンダウン
await page.click('text=Sprints');
await page.waitForTimeout(600);
await page.click('button:has-text("Burndown")');
await page.waitForTimeout(800);
await shot('05_sprint_burndown');

await browser.close();
console.log('\n✅ 完了');
