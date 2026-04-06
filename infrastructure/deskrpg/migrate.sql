-- DeskRPG 추가 테이블 (gateway 관련)
-- 기본 마이그레이션(0000_big_karnak.sql) 이후 실행
-- 사용법: PGPASSWORD=orbitron_db_pass psql -h localhost -p 3718 -U orbitron_user -d deskrpg -f migrate.sql

CREATE TABLE IF NOT EXISTS gateway_resources (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  display_name varchar(120) NOT NULL,
  base_url text NOT NULL,
  token_encrypted text NOT NULL,
  paired_device_id text,
  last_validated_at timestamptz,
  last_validation_status varchar(40),
  last_validation_error text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_gateway_resources_owner_user_id ON gateway_resources(owner_user_id);

CREATE TABLE IF NOT EXISTS gateway_shares (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  gateway_id uuid NOT NULL REFERENCES gateway_resources(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role varchar(32) NOT NULL DEFAULT 'use',
  created_at timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_gateway_shares_gateway_id ON gateway_shares(gateway_id);
CREATE INDEX IF NOT EXISTS idx_gateway_shares_user_id ON gateway_shares(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS gateway_shares_gateway_user_idx ON gateway_shares(gateway_id, user_id);

CREATE TABLE IF NOT EXISTS channel_gateway_bindings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  channel_id uuid NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  gateway_id uuid NOT NULL REFERENCES gateway_resources(id) ON DELETE CASCADE,
  bound_by_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  bound_at timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_channel_gateway_bindings_gateway_id ON channel_gateway_bindings(gateway_id);
CREATE UNIQUE INDEX IF NOT EXISTS channel_gateway_bindings_channel_idx ON channel_gateway_bindings(channel_id);
