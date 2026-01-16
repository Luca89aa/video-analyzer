// supabase/functions/on_user_created/index.ts

import { serve } from "https://deno.land/x/sift@0.6.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  const payload = await req.json();
  const user = payload.record; // contiene id dell’utente appena registrato

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")! // permessi totali, necessario
  );

  const { error } = await supabase
    .from("analisi_video")
    .insert({
      user_id: user.id,
      credits: 1,       // crediti iniziali
      created_at: new Date(),
    });

  if (error) {
    console.error("Errore inserimento:", error);
    return new Response(JSON.stringify({ success: false }), { status: 400 });
  }

  return new Response(JSON.stringify({ success: true }), { status: 200 });
});
