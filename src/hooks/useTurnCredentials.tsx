import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface TurnCredentials {
  url: string;
  username: string;
  credential: string;
}

export function useTurnCredentials() {
  const [turnServers, setTurnServers] = useState<RTCIceServer[]>([
    // Public STUN servers as fallback
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ]);

  useEffect(() => {
    const fetchTurnCredentials = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('get-turn-credentials');
        
        if (error) {
          console.warn('Could not fetch TURN credentials, using STUN only:', error);
          return;
        }

        if (data?.turnServers) {
          setTurnServers((prev) => [
            ...prev,
            ...data.turnServers,
          ]);
        }
      } catch (err) {
        console.warn('Error fetching TURN credentials:', err);
      }
    };

    fetchTurnCredentials();
  }, []);

  return turnServers;
}
