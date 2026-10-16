// Diagnostic-only metadata. Never used for identity, authorization or restoration.
export const STORAGE_PROBE_KEY = 'machiStorageProbe.v1';
export const STORAGE_CONTEXT_KEY = 'machiStorageContext.v1';
const fields = [['認証','machiAccountAuth.v1'],['保存診断履歴','machiAccountPersistenceAudit.v1'],['冒険者名','machiAdventurerProfiles.v1'],['EXP','machiTakarabakoExp'],['発見履歴','machiTakarabakoDiscoveredTreasures'],['確認コード',STORAGE_PROBE_KEY]] as const;
let baseline: string | undefined;
function presence(key:string) { try{return localStorage.getItem(key)===null?'なし':'あり';}catch{return '読み取り不可';} }
function originCode(){let hash=2166136261;for(const c of window.location.origin){hash=Math.imul(hash^c.charCodeAt(0),16777619);}return (hash>>>0).toString(16).padStart(8,'0').toUpperCase();}
function displayMode(){return (navigator as Navigator&{standalone?:boolean}).standalone===true||Boolean(window.matchMedia?.('(display-mode: standalone)').matches)?'standalone':'browser';}
function context(){return {origin:originCode(),mode:displayMode(),formal:window.location.origin==='https://machi-wa-takarabako.vercel.app'};}
type Context=ReturnType<typeof context>;
function safeContext(value:unknown):Context|null{if(!value||typeof value!=='object')return null;const v=value as Context;return typeof v.origin==='string'&&/^[A-F0-9]{8}$/.test(v.origin)&&['standalone','browser'].includes(v.mode)&&typeof v.formal==='boolean'?{origin:v.origin,mode:v.mode,formal:v.formal}:null;}
function describe(c:Context|null){return c?(c.formal?'正式origin':'正式以外のorigin')+'／比較値 '+c.origin+'／'+(c.mode==='standalone'?'ホーム画面形式':'ブラウザ形式'):'未記録（領域変更・未計測・消去を区別できません）';}
export function captureAccountStorageBaseline(){if(baseline!==undefined)return;baseline=fields.map(([label,key])=>label+'：'+presence(key)).join('／');}
export function recordOAuthStorageContext(stage:'start'|'return'){
 try{const value=JSON.parse(localStorage.getItem(STORAGE_CONTEXT_KEY)||'null');const prior=safeContext(value?.start);const next=stage==='start'?{version:1,start:context()}:{version:1,start:prior,returned:context()};localStorage.setItem(STORAGE_CONTEXT_KEY,JSON.stringify(next));}catch{/* Does not modify authentication behavior. */}
}
function probe(){try{const raw=localStorage.getItem(STORAGE_PROBE_KEY);if(raw===null)return {status:'なし',code:null};const v=JSON.parse(raw);if(v?.version!==1||typeof v.code!=='string'||!/^([A-F0-9]{4}-){1}[A-F0-9]{4}$/.test(v.code)||!Number.isFinite(v.expiresAt))return{status:'形式不明（変更していません）',code:null};if(v.expiresAt<=Date.now())return{status:'失効（24時間経過・自動削除はしません）',code:null};return{status:v.code+'（24時間以内のみ有効）',code:v.code};}catch{return{status:'読み取り不可',code:null};}}
export function createStorageProbe(){const existing=probe();if(existing.code)return existing.code;const bytes=crypto.getRandomValues(new Uint8Array(4));const hex=Array.from(bytes,n=>n.toString(16).padStart(2,'0')).join('').toUpperCase();const value=JSON.stringify({version:1,code:hex.slice(0,4)+'-'+hex.slice(4),expiresAt:Date.now()+24*60*60*1000});try{localStorage.setItem(STORAGE_PROBE_KEY,value);if(localStorage.getItem(STORAGE_PROBE_KEY)!==value)throw Error();}catch{throw Error('診断用確認コードを保存できません。既存の認証情報は変更していません。');}return hex.slice(0,4)+'-'+hex.slice(4);}
export function removeStorageProbe(){try{localStorage.removeItem(STORAGE_PROBE_KEY);}catch{throw Error('診断用確認コードを削除できません。');}}
export function accountStorageContextReport(){
 let start:Context|null=null,returned:Context|null=null;try{const v=JSON.parse(localStorage.getItem(STORAGE_CONTEXT_KEY)||'null');if(v?.version===1){start=safeContext(v.start);returned=safeContext(v.returned);}}catch{}
 return ['保存領域の比較（確認コードはアカウントID・認証情報ではありません）',
 '認証クライアント作成前の保存状況：'+(baseline??'未計測'),
 '現在の保存状況：'+fields.map(([label,key])=>label+'：'+presence(key)).join('／'),
 'Google認証開始時：'+describe(start),'Google認証から戻った時：'+describe(returned),'現在：'+describe(context()),
 '診断用確認コード：'+probe().status,
 'origin比較値が同じでも、通常タブ・プライベート・ホーム画面・アプリ内ブラウザの保存領域が同じとは限りません。',
 'プライベートブラウズ：Web側では判定しません。Safariのタブ一覧で確認してください。',
 '確認コードも履歴も消えた場合、別領域とデータ消去をこの画面だけで区別することはできません。'].join('\n');
}
