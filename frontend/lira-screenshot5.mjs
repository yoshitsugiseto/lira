import { chromium } from '@playwright/test';
import { mkdir } from 'fs/promises';

const OUT = '/tmp/lira-screenshots4';
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.setDefaultTimeout(10000);
await page.setViewportSize({ width: 1440, height: 900 });

async function shot(name) {
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log(`📸 ${name}`);
}

await page.goto('http://localhost:3000');
await page.waitForTimeout(1500);
await shot('00_loaded');

// サイドバーのプロジェクト一覧からクリック
await page.locator('aside button', { hasText: 'Test Project' }).click();
await page.waitForTimeout(800);

await page.locator('nav button', { hasText: 'Board' }).click();
await page.waitForTimeout(800);
await shot('01_board_before_drag');

// ドラッグ: Todo列の最初のカード → In Progress列へ
const cards = page.locator('.cursor-pointer');
const count = await cards.count();
console.log(`Cards found: ${count}`);

if (count > 0) {
  const card = cards.first();
  const inProgressHeader = page.locator('text=In Progress').first();

  const cardBox = await card.boundingBox();
  const headerBox = await inProgressHeader.boundingBox();

  if (cardBox && headerBox) {
    // ドラッグ開始
    await page.mouse.move(cardBox.x + cardBox.width / 2, cardBox.y + cardBox.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(500);
    await shot('02_drag_start');

    // ゆっくりIn Progressカラムに移動
    const targetX = headerBox.x + headerBox.width / 2;
    const targetY = headerBox.y + 150;
    const steps = 25;
    const startX = cardBox.x + cardBox.width / 2;
    const startY = cardBox.y + cardBox.height / 2;

    for (let i = 1; i <= steps; i++) {
      await page.mouse.move(
        startX + (targetX - startX) * i / steps,
        startY + (targetY - startY) * i / steps,
      );
      await page.waitForTimeout(20);
    }

    await shot('03_during_drag');
    await page.mouse.up();
    await page.waitForTimeout(1200);
    await shot('04_after_drag');
  }
}

await browser.close();
console.log('\n✅ 完了');
