import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient("https://uwlejnaduyhoprjzlwuh.supabase.co/", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3bGVqbmFkdXlob3Byanpsd3VoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI1NjU0NzUsImV4cCI6MjA3ODE0MTQ3NX0.XJbEZGsAk4ysepePNa_U9TkpDMxZquMaBBYB3vsI5yk");
