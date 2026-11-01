-- 003_code_mode.sql — F-10 プログラミングモード（docs/03_DB設計.md v4.5、docs/04 §7 に対応）
-- 日時カラムはすべて UTC。文字コードは utf8mb4。
-- 実行は npm run migrate（トーンさんのみ）。このファイルは適用済みになったら書き換えない。
-- lessons.active_task_id が code_tasks を参照するため、code_tasks を先に作ってから lessons に列を足す。

-- 課題（1授業に複数。先生が「タイトル＋テンプレートコード」で追加する）
CREATE TABLE code_tasks (
  id         INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
  lesson_id  INT          NOT NULL,
  title      VARCHAR(100) NOT NULL,                      -- 例「課題1 FizzBuzz」
  language   ENUM('java') NOT NULL DEFAULT 'java',       -- 対応言語は java のみ（欄だけ持つ）
  template   TEXT         NOT NULL,                      -- 初期コード。空なら既定の Main 雛形（shared の CODE_DEFAULT_TEMPLATE）
  sort_order INT          NOT NULL,                      -- 表示順（追加した順）
  created_at DATETIME     NOT NULL DEFAULT (UTC_TIMESTAMP()),
  KEY idx_code_tasks_lesson (lesson_id, sort_order),
  CONSTRAINT fk_code_tasks_lesson FOREIGN KEY (lesson_id) REFERENCES lessons (id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

-- lessons に 3 列追加（現在のモード／今の課題／コードスポットライト中の生徒）
ALTER TABLE lessons
  ADD COLUMN mode                   ENUM('video','coding') NOT NULL DEFAULT 'video' AFTER status,
  ADD COLUMN active_task_id         INT NULL AFTER mode,
  ADD COLUMN code_spotlight_user_id INT NULL AFTER active_task_id,
  ADD CONSTRAINT fk_lessons_active_task    FOREIGN KEY (active_task_id)         REFERENCES code_tasks (id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_lessons_code_spotlight FOREIGN KEY (code_spotlight_user_id) REFERENCES users (id)      ON DELETE SET NULL;

-- 生徒×課題のコード本体（Yjs の永続化先。5 秒おき＋保存時に書き戻す）
CREATE TABLE code_documents (
  task_id    INT        NOT NULL,
  user_id    INT        NOT NULL,
  source     MEDIUMTEXT NOT NULL,                        -- 現在のコード
  ydoc_state MEDIUMBLOB NULL,                            -- Yjs のバイナリ状態（再接続時の復元用）
  updated_at DATETIME   NOT NULL DEFAULT (UTC_TIMESTAMP()),
  PRIMARY KEY (task_id, user_id),
  CONSTRAINT fk_code_documents_task FOREIGN KEY (task_id) REFERENCES code_tasks (id) ON DELETE CASCADE,
  CONSTRAINT fk_code_documents_user FOREIGN KEY (user_id) REFERENCES users (id)      ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

-- 保存履歴（Ctrl+S ごとに 1 行。先生が編集して保存したものは edited_by_teacher で区別）
CREATE TABLE code_snapshots (
  id                BIGINT     NOT NULL AUTO_INCREMENT PRIMARY KEY,
  task_id           INT        NOT NULL,
  user_id           INT        NOT NULL,
  source            MEDIUMTEXT NOT NULL,                 -- 保存時点のコード
  compile_ok        BOOLEAN    NOT NULL,                 -- 保存時のコンパイル結果
  edited_by_teacher BOOLEAN    NOT NULL DEFAULT FALSE,
  saved_at          DATETIME   NOT NULL DEFAULT (UTC_TIMESTAMP()),
  KEY idx_code_snapshots_task_user_saved (task_id, user_id, saved_at),
  CONSTRAINT fk_code_snapshots_task FOREIGN KEY (task_id) REFERENCES code_tasks (id) ON DELETE CASCADE,
  CONSTRAINT fk_code_snapshots_user FOREIGN KEY (user_id) REFERENCES users (id)      ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

-- コンパイル・実行ログ
CREATE TABLE code_runs (
  id          BIGINT   NOT NULL AUTO_INCREMENT PRIMARY KEY,
  task_id     INT      NOT NULL,
  user_id     INT      NOT NULL,
  kind        ENUM('compile','run') NOT NULL,
  status      ENUM('ok','compile_error','runtime_error','timeout','runner_unavailable') NOT NULL,
  stdout      TEXT     NULL,                             -- 64KB で切り詰め（shared の CODE_LIMITS.OUTPUT_MAX_BYTES）
  stderr      TEXT     NULL,
  exit_code   INT      NULL,
  duration_ms INT      NULL,
  created_at  DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
  KEY idx_code_runs_task_user_created (task_id, user_id, created_at),
  CONSTRAINT fk_code_runs_task FOREIGN KEY (task_id) REFERENCES code_tasks (id) ON DELETE CASCADE,
  CONSTRAINT fk_code_runs_user FOREIGN KEY (user_id) REFERENCES users (id)      ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;
