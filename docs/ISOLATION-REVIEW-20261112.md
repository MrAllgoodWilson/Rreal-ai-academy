# Isolated candidate, not deployment approval

Base: 922f7fce61e51d07d84cc118ce136cecc02348e8.

Sandbox checkout/webhook must use STRIPE_CHECKOUT_MODE=test and a test API key. The webhook requires STRIPE_TEST_WEBHOOK_SECRET, never falls back to STRIPE_WEBHOOK_SECRET, and refuses equality with a configured production signing secret. Missing/nonboolean event.livemode is rejected before event reservations or membership writes.

Configure SUPABASE_TEST_PROJECT_REF and SUPABASE_PRODUCTION_PROJECT_REF as distinct 20-character refs from verified operator records. SUPABASE_TEST_URL and NEXT_PUBLIC_SUPABASE_URL must both equal https://<test-ref>.supabase.co exactly. NEXT_PUBLIC_SUPABASE_ANON_KEY must equal SUPABASE_TEST_ANON_KEY; SUPABASE_SERVICE_ROLE_KEY must equal SUPABASE_TEST_SERVICE_ROLE_KEY. Dedicated anon/admin credentials must differ. User and admin factories refuse unsafe sandbox configuration, including portal/progress callers. Keep actual keys outside source and review artifacts.

This validates configuration consistency, not provider ownership of credentials. Independent deployment review must compare real project identities and verify credentials belong to the approved sandbox. Browser public variables must be built for that isolated deployment; do not flip production runtime mode. Real UUID test users must exist in that project's profiles table. IDs are no longer prefixed.

Tests were adapted to the stronger contract: explicit isolated project fixture, UUID test identity, boolean livemode in positive webhook fixtures, and support for restricted test keys. Original Claude files remain on the base commit and copied originals outside this checkout. Adapted tests are developer checks, not new Claude approval. No provider-originated test payment, persisted entitlement, cancellation/refund/replay acceptance, or deployed build was run.
