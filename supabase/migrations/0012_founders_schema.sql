-- Migration 0012: Founders Beta tables, in their own schema.
--
-- The table definitions below are the accepted Founders library schema (schema.sql of library snapshot
-- fc07bca / de78bc5) unchanged. They live in schema `founders`, which is NOT exposed through the REST API and to
-- which anon/authenticated have no access; the app reaches them over a direct Postgres connection whose
-- search_path is pinned to this schema (src/lib/founders-engine.ts).
-- Safe to re-run. Rollback: `drop schema founders cascade` (destroys Founders eligibility/enrollment/audit/cost data).
create schema if not exists founders;
revoke all on schema founders from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then revoke all on schema founders from anon; end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then revoke all on schema founders from authenticated; end if;
end $$;

set search_path = founders;

-- Founders Beta Database Schema (PostgreSQL 17)
-- Hardened for single-transaction idempotency, row locking, audit immutability, and 5-ever portfolio cap

CREATE TABLE IF NOT EXISTS founders_offers (
  id VARCHAR(64) PRIMARY KEY,
  company_id VARCHAR(32) NOT NULL,
  merchant_context VARCHAR(128) NOT NULL,
  offer_version INT NOT NULL DEFAULT 1,
  currency VARCHAR(8) NOT NULL DEFAULT 'usd',
  unit_amount INT NOT NULL DEFAULT 499,
  billing_interval VARCHAR(16) NOT NULL DEFAULT 'month',
  state VARCHAR(16) NOT NULL DEFAULT 'active' CHECK (state IN ('active', 'archived', 'draft')),
  deliverables JSONB NOT NULL,
  beta_terms_version VARCHAR(32) NOT NULL,
  enrollment_window JSONB,
  terms_hash VARCHAR(64) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS founders_pilot_counter (
  id VARCHAR(32) PRIMARY KEY,
  total_ever_admitted INT NOT NULL DEFAULT 0,
  max_cap INT NOT NULL DEFAULT 5,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO founders_pilot_counter (id, total_ever_admitted, max_cap)
VALUES ('portfolio_cap', 0, 5)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS founders_eligibilities (
  id VARCHAR(64) PRIMARY KEY,
  company_id VARCHAR(32) NOT NULL,
  immutable_account_id UUID NOT NULL,
  original_registered_at TIMESTAMP WITH TIME ZONE,
  qualified_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  founder_offer_id VARCHAR(64) NOT NULL REFERENCES founders_offers(id),
  eligibility_status VARCHAR(32) NOT NULL CHECK (eligibility_status IN ('eligible', 'enrolled', 'forfeited', 'revoked')),
  immutable_source_evidence JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_company_account UNIQUE (company_id, immutable_account_id)
);

CREATE TABLE IF NOT EXISTS founders_enrollments (
  id VARCHAR(64) PRIMARY KEY,
  eligibility_id VARCHAR(64) NOT NULL REFERENCES founders_eligibilities(id),
  immutable_account_id UUID NOT NULL,
  company_id VARCHAR(32) NOT NULL,
  provider_customer_id VARCHAR(64) NOT NULL,
  provider_subscription_id VARCHAR(64) NOT NULL,
  provider_price_id VARCHAR(64) NOT NULL,
  subscription_status VARCHAR(32) NOT NULL CHECK (subscription_status IN ('active', 'trialing', 'past_due', 'unpaid', 'canceled', 'incomplete', 'incomplete_expired')),
  started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  current_period_end BIGINT NOT NULL,
  canceled_at TIMESTAMP WITH TIME ZONE,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  last_event_created BIGINT,
  provider_livemode BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_enrollment_provider_sub UNIQUE (provider_subscription_id),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Partial unique index ensuring at most ONE active or trialing subscription per account
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_enrollment_per_account
ON founders_enrollments (company_id, immutable_account_id)
WHERE subscription_status IN ('active', 'trialing');

CREATE TABLE IF NOT EXISTS founders_processed_events (
  event_id VARCHAR(128) PRIMARY KEY,
  company_id VARCHAR(32) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'completed' CHECK (status IN ('processing', 'completed', 'failed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS founders_identity_signals (
  id VARCHAR(64) PRIMARY KEY,
  company_id VARCHAR(32) NOT NULL,
  immutable_account_id UUID NOT NULL,
  signal_type VARCHAR(64) NOT NULL,
  signal_hash VARCHAR(128) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_signal_company UNIQUE (company_id, signal_type, signal_hash)
);

CREATE TABLE IF NOT EXISTS founders_cost_reservations (
  id VARCHAR(64) PRIMARY KEY,
  company_id VARCHAR(32) NOT NULL,
  immutable_account_id UUID NOT NULL,
  month_window VARCHAR(16) NOT NULL,
  model_key VARCHAR(64) NOT NULL,
  estimated_units INT NOT NULL,
  reserved_cost_usd NUMERIC(10, 6) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved', 'settled', 'released')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS founders_cost_ledger (
  id VARCHAR(64) PRIMARY KEY,
  company_id VARCHAR(32) NOT NULL,
  immutable_account_id UUID NOT NULL,
  month_window VARCHAR(16) NOT NULL,
  total_settled_cost_usd NUMERIC(10, 6) NOT NULL DEFAULT 0,
  total_reserved_cost_usd NUMERIC(10, 6) NOT NULL DEFAULT 0,
  total_units_consumed INT NOT NULL DEFAULT 0,
  total_units_reserved INT NOT NULL DEFAULT 0,
  active_concurrency INT NOT NULL DEFAULT 0,
  overage_flag BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_ledger_account_month UNIQUE (company_id, immutable_account_id, month_window)
);

CREATE TABLE IF NOT EXISTS founders_audit_trail (
  id VARCHAR(64) PRIMARY KEY,
  company_id VARCHAR(32) NOT NULL,
  immutable_account_id UUID NOT NULL,
  actor_id VARCHAR(64) NOT NULL,
  event_type VARCHAR(64) NOT NULL,
  event_id VARCHAR(128),
  price_id VARCHAR(64),
  mode VARCHAR(16) NOT NULL CHECK (mode IN ('test', 'live')),
  details JSONB NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Rules to ensure audit trail immutability
CREATE OR REPLACE RULE no_update_audit AS ON UPDATE TO founders_audit_trail DO INSTEAD NOTHING;
CREATE OR REPLACE RULE no_delete_audit AS ON DELETE TO founders_audit_trail DO INSTEAD NOTHING;


-- ── App-level additions (NOT part of the library schema above) ─────────────────────────────────────────────
-- The library reads state and writes it back inside a READ COMMITTED transaction without locking the rows, so two
-- events for the same account processed at the same instant can overwrite each other (observed: a renewal that
-- read "active" before a cancellation committed wrote "active" back over "canceled").
-- These guards make the terminal states terminal in the database itself. A violating write raises, the engine
-- transaction rolls back, the webhook answers 500 and the provider retry then sees the committed terminal state.
CREATE OR REPLACE FUNCTION guard_enrollment_terminal() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.subscription_status = 'canceled' AND NEW.subscription_status <> 'canceled'
     AND NEW.provider_subscription_id = OLD.provider_subscription_id THEN
    RAISE EXCEPTION 'founders: a canceled enrollment cannot be reactivated' USING ERRCODE = 'P0001';
  END IF;
  IF NEW.provider_subscription_id = OLD.provider_subscription_id
     AND COALESCE(NEW.last_event_created, 0) < COALESCE(OLD.last_event_created, 0) THEN
    RAISE EXCEPTION 'founders: enrollment event clock cannot move backwards' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_guard_enrollment_terminal ON founders_enrollments;
CREATE TRIGGER trg_guard_enrollment_terminal BEFORE UPDATE ON founders_enrollments
  FOR EACH ROW EXECUTE FUNCTION guard_enrollment_terminal();

CREATE OR REPLACE FUNCTION guard_eligibility_terminal() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.eligibility_status IN ('forfeited', 'revoked') AND NEW.eligibility_status NOT IN ('forfeited', 'revoked') THEN
    RAISE EXCEPTION 'founders: a forfeited eligibility cannot be restored' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_guard_eligibility_terminal ON founders_eligibilities;
CREATE TRIGGER trg_guard_eligibility_terminal BEFORE UPDATE ON founders_eligibilities
  FOR EACH ROW EXECUTE FUNCTION guard_eligibility_terminal();

reset search_path;
