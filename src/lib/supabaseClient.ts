// src/lib/supabaseClient.ts
console.log('DEBUG: Entering supabaseClient.ts');
import { createClient } from '@supabase/supabase-js';



const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Add these new console.log statements
console.log('SupabaseClient: Attempting to initialize client.');
console.log('SupabaseClient: VITE_SUPABASE_URL value:', supabaseUrl ? 'Loaded' : 'NOT LOADED', supabaseUrl);
console.log('SupabaseClient: VITE_SUPABASE_ANON_KEY value:', supabaseAnonKey ? 'Loaded' : 'NOT LOADED', supabaseAnonKey);

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('SupabaseClient: Missing Supabase environment variables. VITE_SUPABASE_URL:', supabaseUrl, 'VITE_SUPABASE_ANON_KEY:', supabaseAnonKey);
  throw new Error('Missing Supabase environment variables. Please add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file.');
}

console.log('SupabaseClient: Initializing client with VITE_SUPABASE_URL:', supabaseUrl ? 'Found' : 'Not Found');
console.log('SupabaseClient: Initializing client with VITE_SUPABASE_ANON_KEY:', supabaseAnonKey ? 'Found' : 'Not Found');

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
});

console.log('SupabaseClient: Supabase client initialized successfully.');

// Database types for better TypeScript support - Updated for new table structure
interface Database {
  public: {
    Tables: {
      user_profiles: {
        Row: {
          id: string;
          full_name: string;
          email_address: string;
          is_active: boolean;
          profile_created_at: string;
          profile_updated_at: string;
        };
        Insert: {
          id: string;
          full_name: string;
          email_address: string;
          is_active?: boolean;
          profile_created_at?: string;
          profile_updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string;
          email_address?: string;
          is_active?: boolean;
          profile_created_at?: string;
          profile_updated_at?: string;
        };
      };
    };
  };
}
