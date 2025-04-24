import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://gyxsqjlksbupbulhzopi.supabase.co";
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseKey) {
  console.error("ERROR: SUPABASE_KEY is not defined in environment variables");
  console.error(
    "Make sure your .env file contains SUPABASE_KEY and is being loaded"
  );
}

export const supabase = createClient(supabaseUrl, supabaseKey);
