import {LegacyHistoryNotice} from './LegacyHistoryNotice';
import {readPersonalDiscoveries} from '../features/personalDiscoveries';
import {MyTreasureManager} from './MyTreasureManager';
import { AccountPersistenceDiagnostic } from './AccountPersistenceDiagnostic';
import { useEffect, useRef, useState } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { getAccountClient, googleAvatar, initializeAccount, loginWithGoogle, logoutAccount } from '../services/accountAuth';
import { AppIcon } from './AppIcon';
import './MyPage.css';
import { readAdventurerProfile, saveAdventurerProfile } from '../features/adventurerProfile';

export function MyPage({ onBack, adventureInProgress, onNameChange, onAccountChanged }: { onBack: () => void; adventureInProgress: boolean; adventurerName?: string; onNameChange?: (name: string) => void; onAccountChanged?: () => void }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [brokenImage, setBrokenImage] = useState('');
  const actionPending = useRef(false);
  const identity = useRef<string | null | undefined>(undefined);
  const accountChanged = useRef(onAccountChanged); accountChanged.current = onAccountChanged;
  const [savedName, setSavedName] = useState('');
  const [draftName, setDraftName] = useState('');
  function applyUser(next: User | null) {
    const profileName = readAdventurerProfile(localStorage, next?.id ?? null)?.name ?? '';
    setDraftName(profileName);
    setSavedName(profileName);
    setUser(next);
  }
  useEffect(() => {
    let alive = true;
    let ready = false;
    let pending: {session: Session | null} | undefined;
    let unsubscribe = () => {};
    try {
      const client = getAccountClient();
      const { data } = client.auth.onAuthStateChange((event, session) => {
        if (!alive || event === 'INITIAL_SESSION') return;
        if (!ready) { pending = {session}; return; }
        const nextIdentity = session?.user?.id ?? null;
        if (identity.current !== undefined && identity.current !== nextIdentity) accountChanged.current?.();
        identity.current = nextIdentity;
        applyUser(session?.user ?? null);
      });
      unsubscribe = () => data.subscription.unsubscribe();
      void (async () => {
        try {
          await initializeAccount();
          const { data, error } = await client.auth.getSession();
          if (error) throw error;
          if (alive) { ready = true; const restored = pending ? pending.session : data.session; identity.current = restored?.user?.id ?? null; applyUser(restored?.user ?? null); }
        } catch {
          if (alive) { applyUser(null); setMessage('ログイン状態を確認できませんでした。保存確認が完了していないため、登録名は変更していません。同じブラウザで認証保存の診断を確認してください。'); }
        } finally { if (alive) setLoading(false); }
      })();
    } catch { setMessage('ログイン設定を確認できません。通信状態を確認して再試行してください。'); setLoading(false); }
    return () => { alive = false; unsubscribe(); };
  }, []);
  async function perform(signOut: boolean) {
    if (actionPending.current || adventureInProgress) return;
    actionPending.current = true; setBusy(true); setMessage('');
    try {
      if (signOut) { await logoutAccount(); applyUser(null); setMessage('この端末からログアウトしました。ゲストの記録はそのままです。'); }
      else await loginWithGoogle();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '操作を完了できませんでした。もう一度お試しください。');
    } finally { actionPending.current = false; setBusy(false); }
  }
  const avatar = googleAvatar(user?.user_metadata?.avatar_url);
  const displayName = loading ? '確認中…' : user ? savedName || '冒険者名は未登録です' : 'ようこそ、冒険者さん';
  return <section className="my-page" aria-labelledby="my-page-title">
    <header className="my-page-hero"><span>街は宝箱</span><h1 id="my-page-title">マイページ</h1><p>次の冒険も、あなたらしく。</p></header>
    <div className="my-page-card">
      <div className="my-page-avatar">{avatar && brokenImage !== avatar ? <img src={avatar} alt="Googleのプロフィール画像" referrerPolicy="no-referrer" onError={() => setBrokenImage(avatar)} /> : <AppIcon name="user" />}</div>
      <p className="my-page-status">{loading ? 'ログイン状態を確認中…' : user ? 'Googleでログイン中' : 'ゲストで利用中'}</p>
      <h2>{displayName}</h2>
      <p>現在地を使う冒険の前にGoogleログインをしてください。端末に保存済みの記録は削除しません。</p>
      {message && <p className="my-page-message" role="status">{message}</p>}
    <AccountPersistenceDiagnostic />
      <button className="my-page-login" disabled={loading || busy || adventureInProgress} onClick={() => void perform(Boolean(user))}>
        <AppIcon name="user" />{busy ? '処理中…' : user ? 'この端末からログアウト' : 'Googleでログイン'}
      </button>
      {adventureInProgress && <p className="my-page-message">冒険の記録を守るため、ログイン・ログアウトは冒険が終わってから行えます。</p>}
      {onNameChange && <form className="profile-name-editor" onSubmit={event => {
        event.preventDefault(); if (loading || busy || adventureInProgress) return;
        try { const profile = readAdventurerProfile(localStorage, user?.id ?? null); saveAdventurerProfile(localStorage, user?.id ?? null, { name: draftName, started: profile?.started ?? false }); setSavedName(draftName.trim()); onNameChange(draftName.trim()); setMessage('冒険者名をこの端末に保存しました。次回の起動にも使います。'); }
        catch { setMessage('冒険者名を保存できませんでした。1〜40文字とブラウザの保存設定を確認してください。'); }
      }}><label htmlFor="adventurer-name-edit">冒険者名（この端末・アカウント別）</label><input id="adventurer-name-edit" value={draftName} maxLength={40} disabled={loading || busy || adventureInProgress} onChange={event => setDraftName(event.target.value)} /><button disabled={loading || busy || adventureInProgress} type="submit">冒険者名を保存</button></form>}
    </div>
    <div className="my-page-card my-page-records"><AppIcon name="book" /><h2>冒険の記録について</h2>
      <p>現在のEXP・冒険回数・旧形式の発見履歴は、このブラウザのゲスト記録です。新しい図鑑の発見記録は、この端末のGoogleアカウント別に保存します。</p>
      <p><strong>アカウントへの引き継ぎ・端末間の同期は、まだ利用できません。</strong>ログインしても、既存の記録や投稿が自動で紐づくことはありません。図鑑も別端末へは自動同期されません。</p>
      <p>機種変更の前に、元の端末のブラウザデータを消さずに保管してください。</p>
    </div>
    <LegacyHistoryNotice discoveries={user&&!loading?readPersonalDiscoveries(localStorage,user.id).records:undefined}/>
    {user&&!loading&&<MyTreasureManager/>}
    <button className="my-page-back" onClick={onBack}><AppIcon name="back" />冒険に戻る</button>
  </section>;
}
