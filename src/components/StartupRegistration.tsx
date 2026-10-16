import { AccountPersistenceDiagnostic } from './AccountPersistenceDiagnostic';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { getAccountClient, initializeAccount, loginWithGoogle } from '../services/accountAuth';
import { inspectAdventurerProfile, readStartupAdventurerProfile, saveAdventurerProfile, validAdventurerName } from '../features/adventurerProfile';
import { requestFreshSearchPosition, locationFailureMessage, StartupLocationFailure } from '../services/startupLocation';
import { requestAccountPosition } from '../services/accountPosition';
import { AppIcon } from './AppIcon';
import './StartupRegistration.css';

export const ONBOARDING_RETURN = 'machiOnboarding.pending';
export function isOnboardingReturn() { try { return sessionStorage.getItem(ONBOARDING_RETURN) === '1'; } catch { return false; } }
type Fix = Awaited<ReturnType<typeof requestFreshSearchPosition>>;
export function StartupRegistration({ onStart, onRegistrationNeeded, onIdentity }: { recoveredName: string; onStart: (name: string, fix?: Fix) => void; onRegistrationNeeded?: () => void; onIdentity?: (uid: string | null) => void }) {
  const [profileDiagnostic,setProfileDiagnostic]=useState('');
  const [restoreDiagnostic, setRestoreDiagnostic] = useState('');
  const [authFailed, setAuthFailed] = useState(false);
  const [restoreIssue, setRestoreIssue] = useState(false), [resuming, setResuming] = useState(false), [savedDraft, setSavedDraft] = useState(false);
  const [name, setName] = useState(''), [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true), [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  const [gpsDiagnostic, setGpsDiagnostic] = useState(''), [gpsFailed, setGpsFailed] = useState(false), [copyMessage, setCopyMessage] = useState('');
  const gpsController = useRef<AbortController | null>(null);
  const [attempt, retry] = useState(0); const operation = useRef(0), started = useRef(false), saving = useRef(false);
  const onStartRef = useRef(onStart); onStartRef.current = onStart;
  const neededRef = useRef(onRegistrationNeeded); neededRef.current = onRegistrationNeeded;
  const identityRef = useRef(onIdentity); identityRef.current = onIdentity;
  function startRegisteredProfile(uid: string, playerName: string, fix?: Fix) {
    started.current = true; setResuming(true); identityRef.current?.(uid);
    // The OAuth landing flag is for MyPage. Do not reopen it on the next reload
    // after onboarding has successfully restored the account profile.
    const url = new URL(window.location.href);
    if (url.searchParams.get('account') === '1') {
      url.searchParams.delete('account');
      window.history.replaceState(null, '', url.pathname + url.search + url.hash);
    }
    if (fix) onStartRef.current(playerName, fix); else onStartRef.current(playerName);
  }
  useEffect(() => {
    let alive = true, ready = false, latestEvent: { session: Session | null } | undefined;
    let appliedIdentity: string | null | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const began = performance.now();
    let stage = '認証初期化', storageStatus = '未確認';
    try { storageStatus = localStorage.getItem('machiAccountAuth.v1') === null ? 'なし' : 'あり（内容は記録しません）'; } catch { storageStatus = '読み取り不可'; }
    const diagnosis = (outcome: string) => ['ログイン復元の診断（座標・氏名・UID・トークンなし）', '開始時の認証保存データ：' + storageStatus, '段階：' + stage, '状態：' + outcome, '経過：' + Math.round(performance.now() - began) + 'ms'].join('\n');
    setRestoreDiagnostic('');
    setChecking(true); setRestoreIssue(false); setAuthFailed(false); setResuming(false); setMessage('');
    const fail = (message: string, allowLogin = false) => {
      if (!alive) return;
      clearTimeout(timer); setRestoreDiagnostic(diagnosis(allowLogin ? '認証確認エラー' : stage === '保存名確認' ? '保存名確認エラー' : '復元待機中')); setChecking(true); setRestoreIssue(true); setAuthFailed(allowLogin); setResuming(false); setMessage(message);
    };
    const apply = (session: Session | null) => {
      if (!alive) return;
      const account = session && (!session.expires_at || session.expires_at * 1000 > Date.now()) && !session.user.is_anonymous ? session.user : null;
      const identity = account?.id ?? null;
      if (appliedIdentity === identity) return;
      // Read this UID only. A storage failure must never become a fresh registration.
      stage = '保存名確認';
      let profile;
      try { profile = account ? readStartupAdventurerProfile(localStorage, account.id) : null; }
      catch (error) { setUser(null); setName(''); fail(error instanceof Error ? error.message : '保存名を確認できません。再確認してください。'); return; }
      setRestoreDiagnostic(diagnosis(!account ? '有効なセッションなし' : profile ? profile.started ? '登録済み名の復元成功' : '保存済みの下書き名を復元' : 'このUIDの保存名なし'));
      appliedIdentity = identity; started.current = false;
      clearTimeout(timer); setRestoreIssue(false); setAuthFailed(false); setMessage('');
      setProfileDiagnostic(account ? inspectAdventurerProfile(localStorage, account.id) : '');
      gpsController.current?.abort(); setGpsFailed(false); setGpsDiagnostic(''); setCopyMessage('');
      setUser(account); operation.current++; saving.current = false; setBusy(false);
      const metadataName = account?.user_metadata?.adventurer_name;
      setName(profile?.name ?? (account && validAdventurerName(metadataName) ? metadataName : ''));
      setSavedDraft(Boolean(profile && !profile.started)); setChecking(false);
      if (account) { try { sessionStorage.removeItem(ONBOARDING_RETURN); } catch {} }
      if (account && profile?.started) {
        startRegisteredProfile(account.id, profile.name);
      } else { setResuming(false); neededRef.current?.(); }
    };
    let unsubscribe = () => {};
    try {
      const client = getAccountClient();
      const subscription = client.auth.onAuthStateChange((event, session) => {
        if (!alive || !['SIGNED_OUT', 'SIGNED_IN', 'TOKEN_REFRESHED'].includes(event)) return;
        latestEvent = { session };
        // SDK INITIAL_SESSION can precede the PKCE exchange. Wait for the callback
        // to finish before presenting any identity or registration screen.
        if (ready) apply(session);
      });
      unsubscribe = () => subscription.data.subscription.unsubscribe();
      timer = setTimeout(() => fail('ログイン状態の確認に時間がかかっています。登録やログインをやり直さず、ログイン状態を再確認してください。'), 8000);
      void (async () => {
        try {
          await initializeAccount();
          if (!alive) return;
          stage = 'セッション復元';
          const { data, error } = await client.auth.getSession();
          if (!alive) return;
          // A newer sign-in/out always wins over an older getSession response.
          if (error) throw error;
          ready = true;
          apply(latestEvent ? latestEvent.session : data.session);
          try { sessionStorage.removeItem(ONBOARDING_RETURN); } catch {}
        } catch {
          if (!alive) return;
          try { sessionStorage.removeItem(ONBOARDING_RETURN); } catch {}
          fail('ログイン状態を確認できません。保存データは変更していません。通信状態を確認して再確認してください。', true);
        }
      })();
    } catch { fail('Googleログインを利用できません。設定や通信状態を確認して再確認してください。', true); }
    return () => { alive = false; clearTimeout(timer); operation.current++; gpsController.current?.abort(); unsubscribe(); };
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
      const fix = await requestAccountPosition(() => requestFreshSearchPosition({ signal: controller.signal, onProgress: () => { if (id === operation.current) setMessage('古い位置情報を使わず、新しいGPS測位を待っています…'); } }), user.id); if (id !== operation.current) return;
      saveAdventurerProfile(localStorage, user?.id ?? null, { name, started: true });
      try { sessionStorage.removeItem(ONBOARDING_RETURN); } catch {}
      startRegisteredProfile(user.id, name.trim(), fix);
    } catch (error) { if (id === operation.current) { setMessage(locationFailureMessage(error)); if(error instanceof StartupLocationFailure && error.reason !== 'cancelled'){setGpsFailed(true);setGpsDiagnostic(error.report);} } }
    finally { if (id === operation.current) { saving.current = false; setBusy(false); } }
  }
  async function continueWithoutLocation() {
    if (!user || busy || checking || saving.current || !gpsFailed || !validAdventurerName(name)) return;
    saving.current = true; setBusy(true); const id=++operation.current;
    try {
      await requestAccountPosition(async()=>undefined,user.id); if(id!==operation.current)return;
      saveAdventurerProfile(localStorage,user.id,{name,started:true});
      startRegisteredProfile(user.id, name.trim());
    } catch(error){if(id===operation.current)setMessage(locationFailureMessage(error));}
    finally{if(id===operation.current){saving.current=false;setBusy(false);}}
  }
  return <div className="startup-registration">
    <p role="status">{checking ? 'ログイン状態と登録済みの名前を確認しています…' : resuming ? '登録済みの冒険者名でホームへ進んでいます…' : user ? 'Googleでログイン中。冒険者名を登録すると、次回から自動で始められます。' : '初回はGoogleログイン → 冒険者名 → 位置情報の順で準備します。ログイン完了まで位置情報は取得しません。'}</p>
    {(!checking || authFailed) && !resuming && !user && <button type="button" disabled={busy} onClick={() => void login()}>Googleでログインして始める</button>}
    {!checking && !resuming && user && <details className="startup-profile-diagnostic"><summary>冒険者名の保存・復元について</summary><p>{profileDiagnostic}</p><p>冒険者名は、このブラウザ・このサイトにGoogleアカウント別で保存しています。Googleアカウントへの同期はまだありません。ブラウザデータの削除や別の端末・サイトでは復元できない場合があります。</p></details>}
    {!checking && !resuming && user && <form className="name-form" onSubmit={event => void submit(event)}>
      <label htmlFor="player-name" className="name-label">{savedDraft ? '保存した冒険者名で再開' : '冒険者名を教えてね'}</label>
      <div className="name-input-wrap"><input id="player-name" name="player-name" value={name} onChange={e => setName(e.target.value)} maxLength={40} autoComplete="nickname" disabled={busy || checking} /></div>
      <p>位置情報は、近くの目的地検索と到着確認に使います。起動のたびには取得せず、冒険に必要な時だけ確認します。この登録で位置をサーバーへ保存することはありません。</p>
      <button type="submit" className="start-location-button" disabled={checking || busy || !validAdventurerName(name)}><AppIcon name="compass" />{busy ? '現在地を確認しています…' : '現在地を取得して始める'}</button>
    </form>}
    {message && <p role="alert">{message}</p>}
    <AccountPersistenceDiagnostic />
    {restoreDiagnostic && !resuming && <details><summary>ログイン復元の診断（個人情報なし）</summary><pre>{restoreDiagnostic}</pre></details>}
    {gpsDiagnostic && <details className="startup-gps-diagnostic" open><summary>現在地取得の診断（座標なし）</summary><pre>{gpsDiagnostic}</pre><button type="button" onClick={async()=>{try{await navigator.clipboard.writeText(gpsDiagnostic);setCopyMessage('座標や氏名を含まない診断をコピーしました。');}catch{setCopyMessage('下の欄を長押ししてコピーしてください。');}}}>診断結果をコピー（座標なし）</button><textarea aria-label="現在地取得診断の手動コピー" readOnly value={gpsDiagnostic}/><p role="status">{copyMessage}</p></details>}
    {gpsFailed && user && <><p>冒険者名はこのアカウントの下書きとして保存済みです。入力し直さず再取得できます。ホームへ進む場合も、目的地検索には新しい現在地が必要です。</p><button type="button" disabled={busy||checking} onClick={()=>void continueWithoutLocation()}>名前を保存してホームへ（位置情報は後で）</button></>}
    {(!checking || restoreIssue) && !resuming && !busy && <button type="button" onClick={() => { started.current = false; retry(n => n + 1); }}>ログイン状態を再確認する</button>}
  </div>;
}
