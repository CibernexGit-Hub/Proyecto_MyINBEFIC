CREATE TABLE IF NOT EXISTS app_users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  google_sub VARCHAR(255) NOT NULL,
  email VARCHAR(320) NOT NULL,
  email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  full_name VARCHAR(200) NOT NULL,
  profile JSON NOT NULL,
  terms_accepted_at DATETIME NULL,
  role ENUM('directora', 'subdirectora', 'docente', 'estudiante', 'secretaria') NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY app_users_google_sub_unique (google_sub),
  UNIQUE KEY app_users_email_unique (email),
  KEY app_users_role_idx (role)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS app_sessions (
  session_id VARCHAR(128) COLLATE utf8mb4_bin NOT NULL,
  expires INT UNSIGNED NOT NULL,
  data MEDIUMTEXT COLLATE utf8mb4_bin,
  PRIMARY KEY (session_id),
  KEY app_sessions_expires_idx (expires)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS auth_rate_limits (
  bucket CHAR(64) NOT NULL,
  window_started_at INT UNSIGNED NOT NULL,
  attempts INT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket),
  KEY auth_rate_limits_window_idx (window_started_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS app_php_sessions (
  session_id VARCHAR(128) COLLATE utf8mb4_bin NOT NULL,
  expires INT UNSIGNED NOT NULL,
  data MEDIUMTEXT COLLATE utf8mb4_bin,
  PRIMARY KEY (session_id),
  KEY app_php_sessions_expires_idx (expires)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS school_data (
  data_key VARCHAR(120) NOT NULL,
  data_value JSON NOT NULL,
  updated_by BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (data_key),
  KEY school_data_updated_by_idx (updated_by),
  CONSTRAINT school_data_user_fk
    FOREIGN KEY (updated_by) REFERENCES app_users (id)
    ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS academic_grades (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  student_user_id BIGINT UNSIGNED NOT NULL,
  teacher_user_id BIGINT UNSIGNED NOT NULL,
  subject VARCHAR(100) NOT NULL,
  period VARCHAR(60) NOT NULL,
  score DECIMAL(4,2) NOT NULL,
  comment VARCHAR(500) NOT NULL DEFAULT '',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY academic_grades_student_subject_period_unique (student_user_id, subject, period),
  KEY academic_grades_teacher_idx (teacher_user_id),
  CONSTRAINT academic_grades_student_fk
    FOREIGN KEY (student_user_id) REFERENCES app_users (id)
    ON DELETE CASCADE,
  CONSTRAINT academic_grades_teacher_fk
    FOREIGN KEY (teacher_user_id) REFERENCES app_users (id)
    ON DELETE RESTRICT,
  CONSTRAINT academic_grades_score_check CHECK (score >= 0 AND score <= 10)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS announcements (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  source_id VARCHAR(120) NULL,
  created_by BIGINT UNSIGNED NOT NULL,
  title VARCHAR(180) NOT NULL,
  body TEXT NOT NULL,
  payload JSON NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY announcements_author_source_unique (created_by, source_id),
  KEY announcements_created_at_idx (created_at),
  CONSTRAINT announcements_author_fk
    FOREIGN KEY (created_by) REFERENCES app_users (id)
    ON DELETE CASCADE
) ENGINE=InnoDB;
