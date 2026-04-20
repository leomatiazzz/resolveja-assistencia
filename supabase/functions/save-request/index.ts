import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const {
      conversation_id,
      category,
      problem_description,
      location,
      urgency,
      preferred_time,
      contact_name,
      contact_phone,
    } = body;

    if (!category || !problem_description) {
      return new Response(
        JSON.stringify({ error: "Dados obrigatórios faltando" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { data, error } = await supabase
      .from("service_requests")
      .insert({
        conversation_id: conversation_id ?? null,
        category: String(category).slice(0, 50),
        problem_description: String(problem_description).slice(0, 1000),
        location: location ? String(location).slice(0, 200) : null,
        urgency: urgency ? String(urgency).slice(0, 50) : null,
        preferred_time: preferred_time
          ? String(preferred_time).slice(0, 200)
          : null,
        contact_name: contact_name ? String(contact_name).slice(0, 100) : null,
        contact_phone: contact_phone
          ? String(contact_phone).slice(0, 30)
          : null,
      })
      .select()
      .single();

    if (error) {
      console.error("DB insert error:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, id: data.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("save-request error:", e);
    return new Response(
      JSON.stringify({
        error: e instanceof Error ? e.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});