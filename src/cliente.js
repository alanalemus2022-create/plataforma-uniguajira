import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jryichjstzaecijjhzia.supabase.co'; 
const supabaseKey = 'sb_publishable_kQblU6AELCzYRCfPJnRTTQ_Sw54Uv0r';

export const supabase = createClient(supabaseUrl, supabaseKey);