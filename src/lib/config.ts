/** Feature flags derived from env. Safe for client + server (only NEXT_PUBLIC values on client). */
export const supabaseConfigured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
export const isDemoMode = !supabaseConfigured;

export const serverFlags = () => ({
  claude: Boolean(process.env.ANTHROPIC_API_KEY),
  elevenlabs: Boolean(process.env.ELEVENLABS_API_KEY),
  stripe: Boolean(process.env.STRIPE_SECRET_KEY),
  resend: Boolean(process.env.RESEND_API_KEY),
  supabaseAdmin: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.NEXT_PUBLIC_SUPABASE_URL),
});
