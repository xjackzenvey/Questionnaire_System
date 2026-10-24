CREATE TABLE IF NOT EXISTS qs_users (
 id uuid PRIMARY KEY, email text NOT NULL UNIQUE, name text NOT NULL,
 password_hash text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS qs_surveys (
 id uuid PRIMARY KEY, owner_id uuid NOT NULL REFERENCES qs_users(id),
 title text NOT NULL, document jsonb NOT NULL, revision integer NOT NULL DEFAULT 1,
 status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','review','final')),
 review_token text UNIQUE, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS qs_surveys_owner_idx ON qs_surveys(owner_id, updated_at DESC);
ALTER TABLE qs_surveys ADD COLUMN IF NOT EXISTS source_id uuid REFERENCES qs_surveys(id) ON DELETE SET NULL;
ALTER TABLE qs_surveys ADD COLUMN IF NOT EXISTS source_revision integer;
CREATE TABLE IF NOT EXISTS qs_versions (
 id uuid PRIMARY KEY, survey_id uuid NOT NULL REFERENCES qs_surveys(id) ON DELETE CASCADE,
 number integer NOT NULL, document jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(survey_id, number)
);
CREATE TABLE IF NOT EXISTS qs_comments (
 id uuid PRIMARY KEY, survey_id uuid NOT NULL REFERENCES qs_surveys(id) ON DELETE CASCADE,
 parent_id uuid REFERENCES qs_comments(id), target_id text NOT NULL, quote text NOT NULL,
 revision integer NOT NULL, author text NOT NULL, body text NOT NULL,
 resolved boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS qs_comments_survey_idx ON qs_comments(survey_id, created_at);
CREATE TABLE IF NOT EXISTS qs_exports (
 id uuid PRIMARY KEY, version_id uuid NOT NULL REFERENCES qs_versions(id) ON DELETE CASCADE,
 platform text NOT NULL CHECK(platform IN ('wjx','tencent')), external_url text,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS qs_exports_version_idx ON qs_exports(version_id);
CREATE TABLE IF NOT EXISTS qs_sessions (sid varchar PRIMARY KEY, sess json NOT NULL, expire timestamp(6) NOT NULL);
CREATE INDEX IF NOT EXISTS qs_sessions_expire_idx ON qs_sessions(expire);
