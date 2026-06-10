import { createClient } from '@supabase/supabase-js';

// Lazy initialized Supabase client
let supabaseClient: ReturnType<typeof createClient> | null = null;

export function getSupabase() {
  if (!supabaseClient) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    
    // We don't crash here so that the UI can gracefully show a setup screen 
    // instead of crashing the Next.js static renderer/preview.
    if (!supabaseUrl || !supabaseKey) {
      console.warn("Missing Supabase credentials. Ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set.");
    }
    
    supabaseClient = createClient(
      supabaseUrl || 'https://placeholder.supabase.co', 
      supabaseKey || 'placeholder-key'
    );
  }
  
  return supabaseClient;
}
