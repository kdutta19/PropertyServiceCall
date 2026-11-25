import { DemoRepository } from './demo/DemoRepository';
import type { Repository } from './repository';
import { SupabaseRepository } from './supabase/SupabaseRepository';

/** Chooses the backend from environment variables. No credentials => offline demo data. */
export function createRepository(): Repository {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
  const anon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (url && anon) return new SupabaseRepository(url, anon);
  return new DemoRepository();
}
