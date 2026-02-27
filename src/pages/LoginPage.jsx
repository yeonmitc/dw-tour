import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { useAuthStore } from '../store/authStore.js';

export default function LoginPage() {
  const nav = useNavigate();
  const setSession = useAuthStore((s) => s.setSession);
  const setProfile = useAuthStore((s) => s.setProfile);
  const session = useAuthStore((s) => s.session);

  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  // 이미 로그인 되어있으면 메인으로 이동
  useEffect(() => {
    if (session) {
      nav('/', { replace: true });
    }
  }, [session, nav]);

  async function onSubmit(e) {
    e.preventDefault();
    setErr('');
    setBusy(true);

    try {
      // 1. 로그인 (auth.users)
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: pw,
      });

      if (authError) throw authError;
      if (!authData.session) throw new Error('No session returned');

      // 2. 프로필 조회 (public.profiles)
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', authData.user.id)
        .single();

      if (profileError) {
        // 프로필이 없는 경우도 있을 수 있음 (하지만 로직상 있어야 함)
        console.warn('Profile fetch error:', profileError);
      }

      // 3. 상태 업데이트
      setSession(authData.session);
      setProfile(profileData || null);

      // 4. 이동
      nav('/', { replace: true });
    } catch (e2) {
      console.error(e2);
      setErr(e2.message || 'Login failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 420, margin: '80px auto', padding: 16 }}>
      <div className="card">
        <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 10 }}>DW Tour Login</div>
        <div style={{ color: 'var(--muted)', fontSize: 13, lineHeight: 1.4, marginBottom: 20 }}>
          지점별 계정으로 로그인하세요.
          <br />
          (master_office: 전체, office: 지점 전용)
        </div>

        <form className="form" onSubmit={onSubmit}>
          <div>
            <div className="label">Email</div>
            <input
              className="input"
              style={{ width: '100%' }}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
            />
          </div>
          <div>
            <div className="label">Password</div>
            <input
              className="input"
              style={{ width: '100%' }}
              type="password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              placeholder="password"
            />
          </div>

          {err && (
            <div
              style={{
                color: 'red',
                fontSize: 13,
                marginTop: 8,
                padding: 8,
                background: '#ffebee',
                borderRadius: 4,
              }}
            >
              {err}
            </div>
          )}

          <button
            className="btn primary"
            disabled={busy || !email || !pw}
            style={{ marginTop: 20 }}
          >
            {busy ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
