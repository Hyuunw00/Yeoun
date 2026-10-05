import 'react-native-url-polyfill/auto';

import { createClient } from '@supabase/supabase-js';
import Storage from 'expo-sqlite/kv-store';
import * as WebBrowser from 'expo-web-browser';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

// Must match a Redirect URL allowed in the Supabase dashboard (yeoun://**)
const AUTH_REDIRECT = 'yeoun://auth/callback';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: Storage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    flowType: 'pkce',
  },
});

// Google sign-in in an in-app browser session; resolves false if the user cancels
export async function signInWithGoogle() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: AUTH_REDIRECT, skipBrowserRedirect: true },
  });
  if (error) throw error;

  const result = await WebBrowser.openAuthSessionAsync(data.url, AUTH_REDIRECT);
  if (result.type !== 'success') return false;

  const params = new URL(result.url).searchParams;
  const providerError = params.get('error_description') ?? params.get('error');
  if (providerError) throw new Error(providerError);
  const code = params.get('code');
  if (!code) throw new Error('No auth code in redirect');
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) throw exchangeError;
  return true;
}

export function signOut() {
  return supabase.auth.signOut();
}
