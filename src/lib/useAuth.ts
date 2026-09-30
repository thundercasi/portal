import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase, type Me } from './supabase';

// Invite and password-recovery links land here with `type=invite|recovery`
// in the URL hash. Capture it at module load, before supabase-js consumes
// and clears the hash, so the app knows to ask for a new password.
const initialLinkType = (() => {
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const type = params.get('type') ?? new URLSearchParams(window.location.search).get('type');
  return type === 'invite' || type === 'recovery' ? type : null;
})();

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsPassword, setNeedsPassword] = useState<'invite' | 'recovery' | null>(initialLinkType);

  const loadMe = async () => {
    const { data } = await supabase.rpc('portal_me');
    setMe(((data as Me[] | null) ?? [])[0] ?? null);
  };

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      if (data.session) await loadMe();
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      if (event === 'PASSWORD_RECOVERY') setNeedsPassword('recovery');
      if (newSession) {
        // Don't await inside the callback (supabase-js deadlock caveat).
        setTimeout(loadMe, 0);
      } else {
        setMe(null);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const signOut = () => supabase.auth.signOut();

  return {
    session, me, loading, signOut,
    needsPassword, clearNeedsPassword: () => setNeedsPassword(null),
    refreshMe: loadMe,
  };
}
