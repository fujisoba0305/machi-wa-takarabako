import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { getAccountClient, initializeAccount, loginWithGoogle } from '../services/accountAuth';
import { inspectAdventurerProfile, readAdventurerProfile, saveAdventurerProfile, validAdventurerName } from '../features/adventurerProfile';
import { requestFreshSearchPosition, locationFailureMessage, StartupLocationFailure } from '../services/startupLocation';
import { requestAccountPosition } from '../services/accountPosition';
import { AppIcon } from './AppIcon';
import './StartupRegistration.css';

export const ONBOARDING_RETURN = 'machiOnboarding.pending';
export function isOnboardingReturn() { try { return sessionStorage.getItem(ONBOARDING_RETURN) === '1'; } catch { return false; } }
type Fix = Awaited<ReturnType<typeof requestFreshSearchPosition>>;
export function StartupRegistration({ onStart, onRegistrationNeeded, onIdentity }: { recoveredName: string; onStart: (name: string, fix?: Fix) => void; onRegistrationNeeded?: () => void; onIdentity?: (uid: string | null) => void }) {
  const [profileDiagnostic,setProfileDiagnostic]=useState('');
  const [name, setName] = useState(''), [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true), [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  const [gpsDiagnostic, setGpsDiagnostic] = useState(''), [gpsFailed, setGpsFailed] = useState(false), [copyMessage, setCopyMessage] = useState('');
  const gpsController = useRef<AbortController | null>(null);
  const [attempt, retry] = useState(0); const operation = useRef(0), started = useRef(false), saving = useRef(false);
  const onStartRef = useRef(onStart); onStartRef.current = onStart;
  const neededRef = useRef(onRegistrationNeeded); neededRef.current = onRegistrationNeeded;
  const identityRef = useRef(onIdentity); identityRef.current = onIdentity;
  useEffect(() => {
    let alive = true, generation = 0, appliedIdentity: string | null | undefined, timer: ReturnType<typeof setTimeout> | undefined;
    setChecking(true);
    const apply = (session: Session | null) => {
      if (!alive) return;
      const account = session && (!session.expires_at || session.expires_at * 1000 > Date.now()) && !session.user.is_anonymous ? session.user : null;
      const identity = account?.id ?? null;
      if (appliedIdentity === identity) return;
      appliedIdentity = identity;started.current=false; setMessage('');
      setProfileDiagnostic(account?inspectAdventurerProfile(localStorage,account.id):'');
      gpsController.current?.abort(); setGpsFailed(false); setGpsDiagnostic(''); setCopyMessage('');
      setUser(account); operation.current++; saving.current = false; setBusy(false);
      const profile = readAdventurerProfile(localStorage, account?.id ?? null);
      const metadataName = account?.user_metadata?.adventurer_name;
      // Old adventure names belong to the guest record, never another account.
      setName(profile?.name ?? (account ? (validAdventurerName(metadataName) ? metadataName : '') : ''));
      setChecking(false);
      if (account) { try { sessionStorage.removeItem(ONBOARDING_RETURN); } catch {} }
      if (account && profile?.started && !started.current) { started.current = true; identityRef.current?.(identity); onStartRef.current(profile.name); }
      else neededRef.current?.();
    };
    let unsubscribe = () => {};
    try {
      const client = getAccountClient();
      const subscription = client.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_OUT' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') { generation++; apply(session); }
      });
      unsubscribe = () => subscription.data.subscription.unsubscribe();
      const current = generation;
      timer = setTimeout(() => { if (alive && current === generation) { setChecking(false); neededRef.current?.(); setMessage('ログイン状態の確認に時間がかかっています。再確認またはGoogleログインをしてください。'); } }, 8000);
      void (async () => {
        try {
          await initializeAccount();
          const { data, error } = await client.auth.getSession(); if (error) throw error;
          if (!alive || current !== generation) return;
          clearTimeout(timer); apply(data.session);
          try { sessionStorage.removeItem(ONBOARDING_RETURN); } catch { /* optional return marker */ }
        } catch { if (alive && current === generation) { clearTimeout(timer); try { sessionStorage.removeItem(ONBOARDING_RETURN); } catch {} setChecking(false); neededRef.current?.(); setMessage('ログイン状態を確認できません。再確認またはGoogleログインをしてください。'); } }
      })();
    } catch { setChecking(false); neededRef.current?.(); setMessage('Googleログインを利用できません。設定や通信状態を確認して再試行してください。'); }
    return () => { alive = false; generation++; clearTimeout(timer); operation.current++; gpsController.current?.abort(); unsubscribe(); };
  }, [attempt]);
  async function login() {
    if (busy) return; setBusy(true); setMessage('');
    try { sessionStorage.setItem(ONBOARDING_RETURN, '1'); await loginWithGoogle(); }
    catch (error) { try { sessionStorage.removeItem(ONBOARDING_RETURN); } catch {} setMessage(error instanceof Error ? error.message : 'ログインを開始できません。'); setBusy(false); }
  }
  async function submit(event: FormEvent) {
    event.preventDefault(); if (checking || !user || saving.current || !validAdventurerName(name)) return;
    saving.current = true; setBusy(true); setGpsFailed(false); setGpsDiagnostic(''); setCopyMessage(''); setMessage('現在地を確認しています…'); const id = ++operation.current;
    const controller = new AbortController(); gpsController.current = controller;
    try {
      saveAdventurerProfile(localStorage, user?.id ?? null, { name, started: false });setProfileDiagnostic(inspectAdventurerProfile(localStorage,user.id));
      const fix = await requestAccountPosition(() => requestFreshSearchPosition({ signal: controller.signal }), user.id); if (id !== operation.current) return;
      saveAdventurerProfile(localStorage, user?.id ?? null, { name, started: true });
      try { sessionStorage.removeItem(ONBOARDING_RETURN); } catch {}
      started.current = true; identityRef.current?.(user?.id ?? null); onStartRef.current(name.trim(), fix);
    } catch (error) { if (id === operation.current) { setMessage(locationFailureMessage(error)); if(error instanceof StartupLocationFailure && error.reason !== 'cancelled'){setGpsFailed(true);setGpsDiagnostic(error.report);} } }
    finally { if (id === operation.current) { saving.current = false; setBusy(false); } }
  }
  async function continueWithoutLocation() {
    if (!user || busy || checking || saving.current || !gpsFailed || !validAdventurerName(name)) return;
    saving.current = true; setBusy(true); const id=++operation.current;
    try {
      await requestAccountPosition(async()=>undefined,user.id); if(id!==operation.current)return;
      saveAdventurerProfile(localStorage,user.id,{name,started:true});
      started.current=true;identityRef.current?.(user.id);onStartRef.current(name.trim());
    } catch(error){if(id===operation.current)setMessage(locationFailureMessage(error));}
    finally{if(id===operation.current){saving.current=false;setBusy(false);}}
  }
  return <div className="startup-registration">
    <p role="status">{checking ? 'ログイン状態と登録済みの名前を確認しています…' : user ? 'Googleでログイン中。冒険者名を登録すると、次回から自動で始められます。' : '初回はGoogleログイン → 冒険者名 → 位置情報の順で準備します。ログイン完了まで位置情報は取得しません。'}</p>
    {!user && <button type="button" disabled={checking || busy} onClick={() => void login()}>Googleでログインして始める</button>}
    {user && <details className="startup-profile-diagnostic"><summary>冒険者名の保存・復元について</summary><p>{profileDiagnostic}</p><p>冒険者名は、このブラウザ・このサイトにGoogleアカウント別で保存しています。Googleアカウントへの同期はまだありません。ブラウザデータの削除や別の端末・サイトでは復元できない場合があります。</p></details>}
    {user && <form className="name-form" onSubmit={event => void submit(event)}>
      <label htmlFor="player-name" className="name-label">冒険者名を教えてね</label>
      <div className="name-input-wrap"><input id="player-name" name="player-name" value={name} onChange={e => setName(e.target.value)} maxLength={40} autoComplete="nickname" disabled={busy || checking} /></div>
      <p>位置情報は、近くの目的地検索と到着確認に使います。起動のたびには取得せず、冒険に必要な時だけ確認します。この登録で位置をサーバーへ保存することはありません。</p>
      <button type="submit" className="start-location-button" disabled={checking || busy || !validAdventurerName(name)}><AppIcon name="compass" />{busy ? '現在地を確認しています…' : '現在地を取得して始める'}</button>
    </form>}
    {message && <p role="alert">{message}</p>}
    {gpsDiagnostic && <details className="startup-gps-diagnostic" open><summary>現在地取得の診断（座標なし）</summary><pre>{gpsDiagnostic}</pre><button type="button" onClick={async()=>{try{await navigator.clipboard.writeText(gpsDiagnostic);setCopyMessage('座標や氏名を含まない診断をコピーしました。');}catch{setCopyMessage('下の欄を長押ししてコピーしてください。');}}}>診断結果をコピー（座標なし）</button><textarea aria-label="現在地取得診断の手動コピー" readOnly value={gpsDiagnostic}/><p role="status">{copyMessage}</p></details>}
    {gpsFailed && user && <><p>冒険者名はこのアカウントの下書きとして保存済みです。入力し直さず再取得できます。ホームへ進む場合も、目的地検索には新しい現在地が必要です。</p><button type="button" disabled={busy||checking} onClick={()=>void continueWithoutLocation()}>名前を保存してホームへ（位置情報は後で）</button></>}
    {!checking && !busy && <button type="button" onClick={() => { started.current = false; retry(n => n + 1); }}>ログイン状態を再確認する</button>}
  </div>;
}
