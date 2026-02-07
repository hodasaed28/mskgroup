import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Create client with user's token to get their ID
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Verify the user's token
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = user.id;

    // Delete user's data from all tables (order matters due to foreign keys)
    // The cascade should handle most of this, but let's be explicit
    
    // Delete user's messages
    await supabaseClient.from('messages').delete().or(`sender_id.eq.${userId},receiver_id.eq.${userId}`);
    
    // Delete user's notifications
    await supabaseClient.from('notifications').delete().eq('user_id', userId);
    
    // Delete user's comments
    await supabaseClient.from('comments').delete().eq('user_id', userId);
    
    // Delete user's likes
    await supabaseClient.from('likes').delete().eq('user_id', userId);
    
    // Delete user's reel likes
    await supabaseClient.from('reels_likes').delete().eq('user_id', userId);
    
    // Delete user's saved posts
    await supabaseClient.from('saved_posts').delete().eq('user_id', userId);
    
    // Delete user's saved collections
    await supabaseClient.from('saved_collections').delete().eq('user_id', userId);
    
    // Delete user's friendships
    await supabaseClient.from('friendships').delete().or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);
    
    // Delete user's stories
    await supabaseClient.from('stories').delete().eq('user_id', userId);
    
    // Delete user's story views
    await supabaseClient.from('story_views').delete().eq('viewer_id', userId);
    
    // Delete user's typing indicators
    await supabaseClient.from('typing_indicators').delete().or(`user_id.eq.${userId},chat_with_id.eq.${userId}`);
    
    // Delete user's WebRTC signals
    await supabaseClient.from('webrtc_signals').delete().or(`caller_id.eq.${userId},callee_id.eq.${userId}`);
    
    // Delete user's reels
    await supabaseClient.from('reels').delete().eq('user_id', userId);
    
    // Delete user's posts
    await supabaseClient.from('posts').delete().eq('user_id', userId);
    
    // Delete user's profile
    await supabaseClient.from('profiles').delete().eq('id', userId);

    // Delete the user from auth
    const { error: deleteError } = await supabaseClient.auth.admin.deleteUser(userId);

    if (deleteError) {
      console.error('Error deleting user from auth:', deleteError);
      return new Response(
        JSON.stringify({ error: 'Failed to delete account' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in delete-account:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
