import { useEffect, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { getAccountClient, googleAvatar, initializeAccount, loginWithGoogle, logoutAccount } from '../services/accountAuth';
import { AppIcon } from './AppIcon';
import './MyPage.css';

export function MyPage({ onBack, adventureInProgress }: { onBack: () => void; adventureInProgress: boolean }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [brokenImage, setBrokenImage] = useState('');
  const actionPending = useRef(false);
  useEffect(() => {
    let alive = true;
    let changed = false;
    let unsubscribe = () => {};
    try {
      const client = getAccountClient();
      const { data } = client.auth.onAuthStateChange((_event, session) => {
        if (!alive) return;
        changed = true;
        setUser(session?.user ?? null);
      });
      unsubscribe = () => data.subscription.unsubscribe();
      void (async () => {
        try {
          await initializeAccount();
          const { data, error } = await client.auth.getSession();
          if (error) throw error;
          if (alive && !changed) setUser(data.session?.user ?? null);
        } catch {
          if (alive) setMessage('ログイン状態を確認できませんでした。キャンセル・期限切れの場合は、同じブラウザでもう一度ログインしてください。');
        } finally { if (alive) setLoading(false); }
      })();
    } catch { setMessage('ログイン設定を確認できません。ゲストの冒険は引き続き利用できます。'); setLoading(false); }
    return () => { alive = false; unsubscribe(); };
  }, []);
  async function perform(signOut: boolean) {
    if (actionPending.current || adventureInProgress) return;
    actionPending.current = true; setBusy(true); setMessage('');
    try {
      if (signOut) { await logoutAccount(); setUser(null); setMessage('この端末からログアウトしました。ゲストの記録はそのままです。'); }
      else await loginWithGoogle();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '操作を完了できませんでした。もう一度お試しください。');
    } finally { actionPending.current = false; setBusy(false); }
  }
  const avatar = googleAvatar(user?.user_metadata?.avatar_url);
  const displayName = typeof user?.user_metadata?.full_name === 'string' ? user.user_metadata.full_name : 'Googleアカウント';
  return <section className="my-page" aria-labelledby="my-page-title">
    <header className="my-page-hero"><span>街は宝箱</span><h1 id="my-page-title">マイページ</h1><p>次の冒険も、あなたらしく。</p></header>
    <div className="my-page-card">
      <div className="my-page-avatar">{avatar && brokenImage !== avatar ? <img src={avatar} alt="Googleのプロフィール画像" referrerPolicy="no-referrer" onError={() => setBrokenImage(avatar)} /> : <AppIcon name="user" />}</div>
      <p className="my-page-status">{loading ? 'ログイン状態を確認中…' : user ? 'Googleでログイン中' : 'ゲストで利用中'}</p>
      <h2>{user ? displayName : 'ようこそ、冒険者さん'}</h2>
      <p>ログインは任意です。ゲストでも、これまでどおり冒険できます。</p>
      {message && <p className="my-page-message" role="status">{message}</p>}
      <button className="my-page-login" disabled={loading || busy || adventureInProgress} onClick={() => void perform(Boolean(user))}>
        <AppIcon name="user" />{busy ? '処理中…' : user ? 'この端末からログアウト' : 'Googleでログイン'}
      </button>
      {adventureInProgress && <p className="my-page-message">冒険の記録を守るため、ログイン・ログアウトは冒険が終わってから行えます。</p>}
    </div>
    <div className="my-page-card my-page-records"><AppIcon name="book" /><h2>冒険の記録について</h2>
      <p>現在のEXP・冒険回数・発見履歴は、このブラウザのゲスト記録です。ログイン中もアカウントの記録とは分けて扱います。</p>
      <p><strong>アカウントへの引き継ぎ・端末間の同期は、まだ利用できません。</strong>ログインしても、既存の記録や投稿が自動で紐づくことはありません。</p>
      <p>機種変更の前に、元の端末のブラウザデータを消さずに保管してください。</p>
    </div>
    <button className="my-page-back" onClick={onBack}><AppIcon name="back" />冒険に戻る</button>
  </section>;
}
