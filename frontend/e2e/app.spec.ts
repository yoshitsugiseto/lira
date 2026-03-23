import { test, expect, type Page } from '@playwright/test'

const PROJECT = {
  id: 'proj-1',
  name: 'Test Project',
  key: 'TP',
  description: null,
  created_at: '2026-01-01T00:00:00',
  updated_at: '2026-01-01T00:00:00',
}

const SPRINT = {
  id: 'sprint-1',
  project_id: 'proj-1',
  name: 'Sprint 1',
  goal: null,
  status: 'active',
  start_date: '2026-01-01',
  end_date: '2026-01-14',
  created_at: '2026-01-01T00:00:00',
  updated_at: '2026-01-01T00:00:00',
}

async function clearStorage(page: Page) {
  await page.addInitScript(() => {
    localStorage.removeItem('lira-app-state')
  })
}

async function mockEmptyApi(page: Page) {
  await page.route('**/api/projects', route => route.fulfill({ json: [] }))
}

async function mockProjectApi(page: Page) {
  await page.route('**/api/projects', route => route.fulfill({ json: [PROJECT] }))
  await page.route('**/api/projects/proj-1/sprints', route => route.fulfill({ json: [SPRINT] }))
  await page.route('**/api/projects/proj-1/issues**', route =>
    route.fulfill({ json: [], headers: { 'x-total-count': '0' } })
  )
  await page.route('**/api/sprints/sprint-1/burndown', route => route.fulfill({ json: [] }))
}

function withProject(page: Page) {
  return page.addInitScript(() => {
    localStorage.setItem(
      'lira-app-state',
      JSON.stringify({
        state: { activeProjectId: 'proj-1', activeSprint: null, boardFilters: {} },
        version: 0,
      })
    )
  })
}

// ---------------------------------------------------------------
// App shell
// ---------------------------------------------------------------

test('shows app title and sidebar on load', async ({ page }) => {
  await clearStorage(page)
  await mockEmptyApi(page)
  await page.goto('/')

  await expect(page.getByText('Lira')).toBeVisible()
  await expect(page.getByText('Sprint Manager')).toBeVisible()
  await expect(page.getByPlaceholder('イシューを検索...')).toBeVisible()
})

test('shows "No projects yet" when project list is empty', async ({ page }) => {
  await clearStorage(page)
  await mockEmptyApi(page)
  await page.goto('/')

  await expect(page.getByText('No projects yet')).toBeVisible()
})

test('shows project in sidebar when API returns a project', async ({ page }) => {
  await clearStorage(page)
  await mockProjectApi(page)
  await page.goto('/')

  // Project key appears in sidebar
  await expect(page.getByText('TP')).toBeVisible()
  // Project name appears in sidebar button
  await expect(page.getByRole('button', { name: /Test Project/ })).toBeVisible()
})

// ---------------------------------------------------------------
// Project selection
// ---------------------------------------------------------------

test('selecting a project shows navigation items', async ({ page }) => {
  await clearStorage(page)
  await mockProjectApi(page)
  await page.goto('/')

  await page.getByRole('button', { name: /Test Project/ }).click()

  // Navigation items visible
  await expect(page.getByRole('button', { name: 'Dashboard', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Board', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Backlog', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Sprints', exact: true })).toBeVisible()
})

test('clicking Board nav renders main content', async ({ page }) => {
  await clearStorage(page)
  await mockProjectApi(page)
  await withProject(page)
  await page.goto('/')

  await page.getByRole('button', { name: 'Board', exact: true }).click()

  await expect(page.locator('main')).toBeVisible()
})

// ---------------------------------------------------------------
// Search
// ---------------------------------------------------------------

test('typing in search box triggers search page', async ({ page }) => {
  await clearStorage(page)
  await mockProjectApi(page)
  await withProject(page)
  await page.route('**/api/projects/proj-1/issues**', route =>
    route.fulfill({ json: [], headers: { 'x-total-count': '0' } })
  )
  await page.goto('/')

  const searchInput = page.getByPlaceholder('イシューを検索...')
  await searchInput.fill('login')

  // Search page header should appear (debounce 300ms)
  await expect(page.getByText(/"login" の検索結果/)).toBeVisible({ timeout: 1000 })
})

test('pressing Escape clears search', async ({ page }) => {
  await clearStorage(page)
  await mockProjectApi(page)
  await withProject(page)
  await page.route('**/api/projects/proj-1/issues**', route =>
    route.fulfill({ json: [], headers: { 'x-total-count': '0' } })
  )
  await page.goto('/')

  const searchInput = page.getByPlaceholder('イシューを検索...')
  await searchInput.fill('login')
  await expect(page.getByText(/"login" の検索結果/)).toBeVisible({ timeout: 1000 })

  await searchInput.press('Escape')
  await expect(searchInput).toHaveValue('')
  await expect(page.getByText(/"login" の検索結果/)).not.toBeVisible()
})

// ---------------------------------------------------------------
// New project modal
// ---------------------------------------------------------------

test('clicking + opens New Project modal', async ({ page }) => {
  await clearStorage(page)
  await mockEmptyApi(page)
  await page.goto('/')

  await page.getByRole('button', { name: 'プロジェクトを作成' }).click()
  await expect(page.getByText('New Project')).toBeVisible()
  await expect(page.getByPlaceholder('My Project')).toBeVisible()
})

test('closing modal with Escape hides the modal', async ({ page }) => {
  await clearStorage(page)
  await mockEmptyApi(page)
  await page.goto('/')

  await page.getByRole('button', { name: 'プロジェクトを作成' }).click()
  await expect(page.getByText('New Project')).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(page.getByText('New Project')).not.toBeVisible()
})
