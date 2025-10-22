import { useEffect } from 'preact/hooks';
import { route } from 'preact-router';
import { supabase } from '../../lib/supabase';

export default function AuthCallback() {
  useEffect(() => {
    // Handle OAuth callback
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        console.log('AuthCallback: session found, redirecting to home');
        route('/', true); // true = replace history
      } else {
        console.log('AuthCallback: no session found, redirecting to auth');
        route('/auth', true);
      }
    });
  }, []);

  return (
    <div class="min-h-screen flex items-center justify-center">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
    </div>
  );
}