import {useEffect,useState} from 'react';
import {readPublicCardProfile,verifiedCardRequest,verifiedGrowthEnabled} from '../services/verifiedGrowth';
export function PublicCardProfile({uid,onSaved}:{uid:string;onSaved?:()=>void}){
 const [name,setName]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{if(!verifiedGrowthEnabled())return;const c=new AbortController();setName('');void readPublicCardProfile(uid,c.signal).then(d=>{if(!c.signal.aborted)setName(d.nickname);}).catch(()=>{if(!c.signal.aborted)setMessage('公開名を読み込めませんでした。');});return()=>c.abort();},[uid]);
 if(!verifiedGrowthEnabled())return null;
 return <section aria-label="投稿者の公開ニックネーム"><label>公開ニックネーム（任意・32文字以内）<input value={name} maxLength={32} onChange={e=>setName(e.target.value)}/></label><p>保存すると宝物カードに公開されます。Googleの名前や冒険者名は自動公開しません。空欄で公開名を解除できます。</p><button type="button" disabled={busy} onClick={async()=>{setBusy(true);try{await verifiedCardRequest({action:'nickname',nickname:name},uid);setMessage('公開名を保存しました。');onSaved?.();}catch{setMessage('保存できませんでした。入力内容は保持しています。');}finally{setBusy(false);}}}>この名前を公開保存する</button><p role="status">{message}</p></section>;
}
