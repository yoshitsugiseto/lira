# Lira - スプリント管理アプリ 仕様書

## 概要

JIRAライクなローカル動作スプリント管理アプリ。インターネット接続不要、シングルプロセスで起動する。

## 技術スタック

| レイヤー | 技術 |
|---------|------|
| バックエンド | Rust + Axum 0.8 |
| DB | SQLite + sqlx 0.8 |
| マイグレーション | sqlx `migrate!` マクロ（起動時自動実行） |
| フロントエンド | React 19 + Vite + TypeScript |
| スタイル | Tailwind CSS 4 |
| 状態管理 | TanStack Query 5 + Zustand 5 |
| ドラッグ&ドロップ | @hello-pangea/dnd |
| ユニットテスト | Vitest + React Testing Library |
| E2Eテスト | Playwright |

---

## ディレクトリ構成

```
lira/
├── backend/
│   ├── Cargo.toml
│   ├── src/
│   │   ├── main.rs             # エントリーポイント（CORS・サーバー起動）
│   │   ├── lib.rs              # ルーター公開（テストから利用）
│   │   ├── db.rs               # SQLiteプール生成・マイグレーション
│   │   ├── error.rs            # AppError / Result 型
│   │   ├── models/
│   │   │   ├── mod.rs
│   │   │   ├── project.rs
│   │   │   ├── sprint.rs
│   │   │   └── issue.rs
│   │   └── routes/
│   │       ├── mod.rs
│   │       ├── projects.rs
│   │       ├── sprints.rs
│   │       └── issues.rs
│   ├── migrations/
│   │   ├── 001_projects.sql
│   │   ├── 002_sprints.sql
│   │   ├── 003_issues.sql
│   │   ├── 004_comments.sql
│   │   ├── 005_activity_logs.sql
│   │   ├── 006_issue_parent.sql
│   │   └── 007_indexes.sql
│   └── tests/                  # 統合テスト（インメモリSQLite）
│       ├── common.rs
│       ├── projects.rs
│       ├── issues.rs
│       └── sprints.rs
├── frontend/
│   ├── package.json
│   ├── vite.config.ts
│   ├── vitest.config.ts
│   ├── playwright.config.ts
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── types/
│       │   └── index.ts
│       ├── api/
│       │   ├── client.ts       # Axiosインスタンス・extractErrorMessage
│       │   ├── projects.ts
│       │   ├── sprints.ts
│       │   └── issues.ts
│       ├── store/
│       │   └── index.ts        # Zustand（activeProjectId・activeSprint・boardFilters）
│       ├── components/
│       │   ├── Board/
│       │   │   ├── Board.tsx
│       │   │   ├── BoardFilters.tsx
│       │   │   ├── BurndownChart.tsx
│       │   │   ├── Column.tsx
│       │   │   └── IssueCard.tsx
│       │   ├── Issue/
│       │   │   ├── IssueDetail.tsx
│       │   │   └── IssueForm.tsx
│       │   └── common/
│       │       ├── Avatar.tsx
│       │       ├── Badge.tsx
│       │       ├── DetailPanel.tsx
│       │       ├── Modal.tsx
│       │       └── Toast.tsx
│       ├── pages/
│       │   ├── BoardPage.tsx
│       │   ├── BacklogPage.tsx
│       │   ├── DashboardPage.tsx
│       │   ├── SearchPage.tsx
│       │   ├── SprintPage.tsx
│       │   └── SprintHistoryPage.tsx
│       ├── test/               # Vitestユニットテスト
│       └── e2e/                # Playwright E2Eテスト（プロジェクトルート）
├── seed.sql                    # サンプルデータ（sqlite3 lira.db < seed.sql）
├── lira.db                     # 自動生成
└── SPEC.md
```

---

## データモデル

### Project

```sql
CREATE TABLE projects (
    id          TEXT PRIMARY KEY,  -- UUID
    name        TEXT NOT NULL,
    key         TEXT NOT NULL UNIQUE,  -- "LIRA", "PROJ" など（英数字のみ）
    description TEXT,
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

### Sprint

```sql
CREATE TABLE sprints (
    id          TEXT PRIMARY KEY,
    project_id  TEXT NOT NULL REFERENCES projects(id),
    name        TEXT NOT NULL,
    goal        TEXT,
    status      TEXT NOT NULL DEFAULT 'planning',  -- planning | active | completed
    start_date  DATE,
    end_date    DATE,
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

### Issue

```sql
CREATE TABLE issues (
    id           TEXT PRIMARY KEY,
    project_id   TEXT NOT NULL REFERENCES projects(id),
    sprint_id    TEXT REFERENCES sprints(id),   -- NULL = バックログ
    parent_id    TEXT REFERENCES issues(id) ON DELETE SET NULL,  -- サブタスク用
    number       INTEGER NOT NULL,              -- プロジェクト内連番
    title        TEXT NOT NULL,
    description  TEXT,
    type         TEXT NOT NULL DEFAULT 'task',   -- story | task | bug | spike
    status       TEXT NOT NULL DEFAULT 'todo',   -- todo | in_progress | in_review | done
    priority     TEXT NOT NULL DEFAULT 'medium', -- critical | high | medium | low
    points       INTEGER,                        -- 0〜999
    assignee     TEXT,
    labels       TEXT,                           -- JSON配列 ["frontend", "api"]
    position     INTEGER NOT NULL DEFAULT 0,
    created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(project_id, number)
);
```

### Comment

```sql
CREATE TABLE comments (
    id         TEXT PRIMARY KEY,
    issue_id   TEXT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
    author     TEXT NOT NULL,
    body       TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

### ActivityLog

```sql
CREATE TABLE activity_logs (
    id         TEXT PRIMARY KEY,
    issue_id   TEXT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
    field      TEXT NOT NULL,   -- "status" など
    old_value  TEXT,
    new_value  TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

---

## API 仕様

ベースURL: `http://localhost:8080/api`

### Projects

| メソッド | パス | 説明 |
|---------|------|------|
| GET | `/projects` | プロジェクト一覧 |
| POST | `/projects` | プロジェクト作成 |
| GET | `/projects/:id` | プロジェクト詳細 |
| PUT | `/projects/:id` | プロジェクト更新 |
| DELETE | `/projects/:id` | プロジェクト削除（Issue・Sprint を cascade 削除） |

### Sprints

| メソッド | パス | 説明 |
|---------|------|------|
| GET | `/projects/:id/sprints` | スプリント一覧 |
| POST | `/projects/:id/sprints` | スプリント作成 |
| GET | `/sprints/:id` | スプリント詳細 |
| PUT | `/sprints/:id` | スプリント更新 |
| DELETE | `/sprints/:id` | スプリント削除（Issueをバックログへ移動） |
| POST | `/sprints/:id/start` | スプリント開始（planning → active） |
| POST | `/sprints/:id/complete` | スプリント完了（未完了Issueをバックログまたは次スプリントへ移動） |
| GET | `/sprints/:id/burndown` | バーンダウンデータ取得 |

### Issues

| メソッド | パス | 説明 |
|---------|------|------|
| GET | `/projects/:id/issues` | Issue一覧（フィルター・ページネーション対応） |
| POST | `/projects/:id/issues` | Issue作成 |
| GET | `/issues/:id` | Issue詳細 |
| PUT | `/issues/:id` | Issue更新 |
| DELETE | `/issues/:id` | Issue削除（サブタスクも cascade 削除） |
| PATCH | `/issues/:id/status` | ステータス変更（activity_log 自動記録） |
| PATCH | `/issues/:id/sprint` | スプリント割当変更 |
| GET | `/issues/:id/children` | サブタスク一覧 |
| PUT | `/projects/:id/issues/reorder` | Issue並び順更新 |
| GET | `/issues/:id/comments` | コメント一覧 |
| POST | `/issues/:id/comments` | コメント追加 |
| GET | `/issues/:id/activity` | アクティビティログ |

#### Issue一覧のクエリパラメータ

```
sprint_id   : スプリントID（"backlog" でバックログのみ）
status      : todo | in_progress | in_review | done
type        : story | task | bug | spike
priority    : critical | high | medium | low
assignee    : ユーザー名
q           : タイトル・説明の全文検索（LIKE）
limit       : 取得件数（デフォルト 500、最大 1000）
offset      : オフセット（デフォルト 0）
```

#### レスポンスヘッダー

```
X-Total-Count : フィルター条件に一致する総件数（ページネーション用）
```

---

## 画面仕様

### 1. ダッシュボード画面

- アクティブスプリントの進捗サマリー（完了 / 総ポイント・Issue数）
- ステータス別Issue数の内訳
- バーンダウンチャート（アクティブスプリント）

### 2. ボード画面

- カンバン形式で4カラム表示：**Todo / In Progress / In Review / Done**
- カード要素：Issue番号・タイトル・タイプアイコン・優先度バッジ・ポイント・アサイニー
- @hello-pangea/dnd によるカード間ドラッグ&ドロップ（ステータス自動更新）
- ヘッダー：アクティブスプリント名・期間・進捗バー（完了ポイント / 合計ポイント）
- フィルター：アサイニー・優先度・タイプ
- Issue作成ボタン（モーダル）
- Issue行クリックで詳細モーダルを表示

### 3. バックログ画面

- スプリント別グループ表示（planning / active スプリント + バックログ）
- Issue作成・編集・削除
- ドラッグ&ドロップまたはドロップダウンでスプリント割当
- 各スプリントのポイント合計表示
- Issue行クリックで詳細モーダルを表示

### 4. スプリント管理画面

- スプリント一覧（planning / active / completed）
- スプリント作成・編集（名前・ゴール・開始日・終了日）
- アクティブスプリントの開始・完了操作
- 完了時に未完了Issueを次スプリントまたはバックログへ移動
- Sprint History 画面へのリンク

### 5. スプリント履歴画面

- 完了済みスプリントの一覧
- 各スプリントのベロシティ（完了ポイント）・Issue完了数

### 6. 検索画面

- サイドバーの検索ボックスに2文字以上入力すると表示（300ms デバウンス）
- タイトル・説明に対する全文検索（サーバーサイド LIKE）
- サーバーサイドページネーション（20件 / ページ）
- 検索結果クリックで詳細モーダルを表示

### Issue詳細（モーダル）

- 全フィールドの編集
- Markdown 対応の説明フィールド
- サブタスク一覧（type=story の場合）
- コメント投稿・一覧
- アクティビティログ（ステータス変更履歴）

---

## ステータス・優先度の定義

### ステータス

| 値 | 表示名 | 色 |
|----|--------|-----|
| `todo` | Todo | グレー |
| `in_progress` | In Progress | ブルー |
| `in_review` | In Review | パープル |
| `done` | Done | グリーン |

### 優先度

| 値 | 表示名 | 色 |
|----|--------|-----|
| `critical` | Critical | レッド |
| `high` | High | オレンジ |
| `medium` | Medium | イエロー |
| `low` | Low | グレー |

### タイプ

| 値 | 表示名 | アイコン |
|----|--------|---------|
| `story` | Story | 緑の本（BookOpen） |
| `task` | Task | 青のチェック（CheckSquare） |
| `bug` | Bug | 赤のバグ（Bug） |
| `spike` | Spike | 黄の稲妻（Zap） |

---

## バーンダウンチャート

- X軸：スプリント開始日〜終了日
- Y軸：残ストーリーポイント
- 理想線：均等に減少するガイドライン
- 実績線：各日時点での未完了ポイント合計（`activity_logs` のステータス変更履歴から算出）

> **注意**: 現在の実装はスプリント開始時点のポイントスナップショットを持たないため、スプリント途中でIssueが追加・削除された場合に理想線の始点がずれる場合がある。

---

## 非機能要件

- ローカル専用・認証なし
- データは `lira.db`（SQLite、`foreign_keys=ON`）に保存
- バックアップ：`lira.db` をコピーするだけ
- ポート：バックエンド `8080`、開発時フロント `3000`
- CORS：開発時は `localhost:3000` を許可、`X-Total-Count` ヘッダーを expose
