import { createClient } from '@supabase/supabase-js';

// Resolve Supabase URL
const supabaseUrl = 
  (typeof import.meta !== 'undefined' && (
    import.meta.env?.VITE_SUPABASE_URL ||
    import.meta.env?.NEXT_PUBLIC_SUPABASE_URL ||
    import.meta.env?.SUPABASE_URL
  )) ||
  (typeof process !== 'undefined' && (
    process.env?.VITE_SUPABASE_URL ||
    process.env?.NEXT_PUBLIC_SUPABASE_URL ||
    process.env?.SUPABASE_URL
  )) || '';

// Resolve Supabase Publishable / Anon Key (VITE_SUPABASE_PUBLISHABLE_KEY primary, VITE_SUPABASE_ANON_KEY fallback)
const supabasePublishableKey = 
  (typeof import.meta !== 'undefined' && (
    import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY ||
    import.meta.env?.VITE_SUPABASE_ANON_KEY ||
    import.meta.env?.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    import.meta.env?.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    import.meta.env?.SUPABASE_PUBLISHABLE_KEY ||
    import.meta.env?.SUPABASE_ANON_KEY
  )) ||
  (typeof process !== 'undefined' && (
    process.env?.VITE_SUPABASE_PUBLISHABLE_KEY ||
    process.env?.VITE_SUPABASE_ANON_KEY ||
    process.env?.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env?.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env?.SUPABASE_PUBLISHABLE_KEY ||
    process.env?.SUPABASE_ANON_KEY
  )) || '';

/**
 * Resolves the environment-aware application base URL:
 * - Production browser: window.location.origin (current Vercel / deployed domain)
 * - Vercel serverless / build: https://${process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL}
 * - Local development: http://localhost:5173
 */
export const getAppBaseUrl = (path = '') => {
  let base = '';
  if (typeof window !== 'undefined' && window.location?.origin && window.location.origin !== 'null') {
    base = window.location.origin;
  } else if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SITE_URL) {
    base = import.meta.env.VITE_SITE_URL;
  } else if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
    base = 'http://localhost:5173';
  }

  if (!path) return base;
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return base ? `${base}${cleanPath}` : cleanPath;
};

if (!supabaseUrl || !supabasePublishableKey) {
  console.warn(
    '[Supabase Client] Missing environment variables. Please ensure VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY (or VITE_SUPABASE_ANON_KEY) are configured.'
  );
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabasePublishableKey || 'placeholder',
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
    },
  }
);

