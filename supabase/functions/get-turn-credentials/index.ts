import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const turnUrl = Deno.env.get('TURN_SERVER_URL');
    const turnUsername = Deno.env.get('TURN_SERVER_USERNAME');
    const turnCredential = Deno.env.get('TURN_SERVER_CREDENTIAL');

    if (!turnUrl || !turnUsername || !turnCredential) {
      return new Response(
        JSON.stringify({ turnServers: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const turnServers = [
      {
        urls: turnUrl,
        username: turnUsername,
        credential: turnCredential,
      },
    ];

    return new Response(
      JSON.stringify({ turnServers }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
