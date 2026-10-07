-- 001_init.sql — MVP の全テーブル（docs/03_DB設計.md v4.1 に対応）
-- 日時カラムはすべて UTC。文字コードは utf8mb4。
-- このファイルは適用済みになったら書き換えない。変更は 002_〜.sql を足す。

CREATE TABLE users (
  id            INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(30)  NOT NULL,
  login_id      VARCHAR(50)  NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role          ENUM('teacher','student') NOT NULL,
  icon_url      VARCHAR(255) NULL,
  created_at    DATETIME     NOT NULL DEFAULT (UTC_TIMESTAMP()),
  UNIQUE KEY uq_users_login_id (login_id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

CREATE TABLE classes (
  id         INT         NOT NULL AUTO_INCREMENT PRIMARY KEY,
  teacher_id INT         NOT NULL,
  name       VARCHAR(50) NOT NULL,
  join_code  VARCHAR(8)  NOT NULL,
  created_at DATETIME    NOT NULL DEFAULT (UTC_TIMESTAMP()),
  UNIQUE KEY uq_classes_join_code (join_code),
  CONSTRAINT fk_classes_teacher FOREIGN KEY (teacher_id) REFERENCES users (id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

CREATE TABLE class_members (
  class_id  INT      NOT NULL,
  user_id   INT      NOT NULL,
  joined_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
  PRIMARY KEY (class_id, user_id),
  CONSTRAINT fk_class_members_class FOREIGN KEY (class_id) REFERENCES classes (id) ON DELETE CASCADE,
  CONSTRAINT fk_class_members_user  FOREIGN KEY (user_id)  REFERENCES users (id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

CREATE TABLE lessons (
  id                     INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
  class_id               INT          NOT NULL,
  title                  VARCHAR(100) NOT NULL,
  room_name              VARCHAR(100) NOT NULL,                 -- LiveKit ルーム名
  status                 ENUM('preparing','live','ended') NOT NULL DEFAULT 'preparing',
  spotlight_user_id      INT          NULL,                     -- スポットライト中の生徒
  away_timeout_min       INT          NOT NULL DEFAULT 15,      -- 欠課判定の閾値（退出時間の累積と比べる）
  understanding_reset_at DATETIME     NULL,                     -- 理解リアクションを最後にリセットした時刻
  started_at             DATETIME     NULL,
  ended_at               DATETIME     NULL,
  created_at             DATETIME     NOT NULL DEFAULT (UTC_TIMESTAMP()),
  UNIQUE KEY uq_lessons_room_name (room_name),
  KEY idx_lessons_class_status (class_id, status),
  CONSTRAINT fk_lessons_class     FOREIGN KEY (class_id)          REFERENCES classes (id) ON DELETE CASCADE,
  CONSTRAINT fk_lessons_spotlight FOREIGN KEY (spotlight_user_id) REFERENCES users (id)   ON DELETE SET NULL
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

CREATE TABLE attendance (
  id             INT      NOT NULL AUTO_INCREMENT PRIMARY KEY,
  lesson_id      INT      NOT NULL,
  user_id        INT      NOT NULL,
  status         ENUM('present','away','absent') NOT NULL,
  joined_at      DATETIME NULL,                    -- 初回入室。未入室のまま終了した生徒は NULL
  away_since     DATETIME NULL,                    -- 現在の退出（切断）開始時刻。復帰で NULL
  away_total_sec INT      NOT NULL DEFAULT 0,      -- 累積退出秒数
  updated_at     DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
  note           VARCHAR(100) NULL,                -- 先生の手動修正メモ
  UNIQUE KEY uq_attendance_lesson_user (lesson_id, user_id),
  KEY idx_attendance_status (status),
  CONSTRAINT fk_attendance_lesson FOREIGN KEY (lesson_id) REFERENCES lessons (id) ON DELETE CASCADE,
  CONSTRAINT fk_attendance_user   FOREIGN KEY (user_id)   REFERENCES users (id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

CREATE TABLE attention_checks (
  id          INT      NOT NULL AUTO_INCREMENT PRIMARY KEY,
  lesson_id   INT      NOT NULL,
  issued_at   DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
  deadline_at DATETIME NOT NULL,
  KEY idx_attention_checks_lesson (lesson_id),
  CONSTRAINT fk_attention_checks_lesson FOREIGN KEY (lesson_id) REFERENCES lessons (id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

CREATE TABLE attention_responses (
  check_id     INT      NOT NULL,
  user_id      INT      NOT NULL,
  responded_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
  PRIMARY KEY (check_id, user_id),
  CONSTRAINT fk_attention_responses_check FOREIGN KEY (check_id) REFERENCES attention_checks (id) ON DELETE CASCADE,
  CONSTRAINT fk_attention_responses_user  FOREIGN KEY (user_id)  REFERENCES users (id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

CREATE TABLE understanding_reactions (
  id         BIGINT   NOT NULL AUTO_INCREMENT PRIMARY KEY,
  lesson_id  INT      NOT NULL,
  user_id    INT      NOT NULL,
  type       ENUM('understood','confused','again') NOT NULL,
  created_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
  KEY idx_understanding_lesson_created (lesson_id, created_at),
  CONSTRAINT fk_understanding_lesson FOREIGN KEY (lesson_id) REFERENCES lessons (id) ON DELETE CASCADE,
  CONSTRAINT fk_understanding_user   FOREIGN KEY (user_id)   REFERENCES users (id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

CREATE TABLE questions (
  id           INT      NOT NULL AUTO_INCREMENT PRIMARY KEY,
  lesson_id    INT      NOT NULL,
  user_id      INT      NOT NULL,                  -- 匿名でも保持する（先生のみ閲覧可）
  body         TEXT     NULL,                      -- 挙手のみ（質問ボタン）は NULL
  is_anonymous BOOLEAN  NOT NULL DEFAULT FALSE,
  status       ENUM('open','answered') NOT NULL DEFAULT 'open',
  created_at   DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
  KEY idx_questions_lesson (lesson_id, created_at),
  CONSTRAINT fk_questions_lesson FOREIGN KEY (lesson_id) REFERENCES lessons (id) ON DELETE CASCADE,
  CONSTRAINT fk_questions_user   FOREIGN KEY (user_id)   REFERENCES users (id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

-- 資料（material）とチャット添付（attachment）の共通テーブル
CREATE TABLE files (
  id          INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
  uploader_id INT          NOT NULL,
  lesson_id   INT          NOT NULL,
  kind        ENUM('material','attachment') NOT NULL,
  file_name   VARCHAR(255) NOT NULL,
  url         VARCHAR(255) NOT NULL,               -- Railway Volume 上のパス
  mime        VARCHAR(100) NOT NULL,
  size        INT          NOT NULL,
  created_at  DATETIME     NOT NULL DEFAULT (UTC_TIMESTAMP()),
  KEY idx_files_lesson_kind (lesson_id, kind),
  CONSTRAINT fk_files_uploader FOREIGN KEY (uploader_id) REFERENCES users (id),
  CONSTRAINT fk_files_lesson   FOREIGN KEY (lesson_id)   REFERENCES lessons (id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

CREATE TABLE chat_messages (
  id         BIGINT   NOT NULL AUTO_INCREMENT PRIMARY KEY,
  lesson_id  INT      NOT NULL,
  user_id    INT      NOT NULL,
  body       TEXT     NULL,                        -- 添付のみの投稿は NULL
  file_id    INT      NULL,
  created_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
  KEY idx_chat_lesson_created (lesson_id, created_at),
  CONSTRAINT fk_chat_lesson FOREIGN KEY (lesson_id) REFERENCES lessons (id) ON DELETE CASCADE,
  CONSTRAINT fk_chat_user   FOREIGN KEY (user_id)   REFERENCES users (id),
  CONSTRAINT fk_chat_file   FOREIGN KEY (file_id)   REFERENCES files (id) ON DELETE SET NULL
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

-- 授業タグ（クラスごとに管理）
CREATE TABLE tags (
  id       INT         NOT NULL AUTO_INCREMENT PRIMARY KEY,
  class_id INT         NOT NULL,
  name     VARCHAR(30) NOT NULL,
  UNIQUE KEY uq_tags_class_name (class_id, name),
  CONSTRAINT fk_tags_class FOREIGN KEY (class_id) REFERENCES classes (id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

CREATE TABLE lesson_tags (
  lesson_id INT NOT NULL,
  tag_id    INT NOT NULL,
  PRIMARY KEY (lesson_id, tag_id),
  CONSTRAINT fk_lesson_tags_lesson FOREIGN KEY (lesson_id) REFERENCES lessons (id) ON DELETE CASCADE,
  CONSTRAINT fk_lesson_tags_tag    FOREIGN KEY (tag_id)    REFERENCES tags (id)    ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;
