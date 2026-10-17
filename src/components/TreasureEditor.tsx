import {useRef,useState} from 'react';
import {registrationCategories} from '../features/treasureCategories';
import {treasurePhotoUrls} from '../features/treasurePhotos';
import {PhotoThumbnails} from './PhotoThumbnails';
import {validateTreasureEdit,type TreasureEdit,type TreasureManagement} from '../services/treasureManagement';
export function TreasureEditor({id,initial,service,onDone,onCancel}:{id:number;initial:TreasureEdit;service:TreasureManagement;onDone:(removed:boolean)=>void;onCancel:()=>void}){
 const [value,setValue]=useState(initial),[files,setFiles]=useState<(File|null)[]>([null,null]),[error,setError]=useState(''),[busy,setBusy]=useState(false),[confirm,setConfirm]=useState(false);const lock=useRef(false);
 const change=(key:keyof TreasureEdit,v:unknown)=>setValue(old=>({...old,[key]:v}));
 async function run(remove=false){if(lock.current)return;try{if(!remove)validateTreasureEdit(value);if(!remove&&files[1]&&!files[0]&&!value.image_url)throw Error('代表画像を選んでから追加画像を指定してください。');lock.current=true;setBusy(true);setError('');if(remove)await service.remove(id,initial.version);else await service.save(id,value,files);onDone(remove);}catch(e){setError(e instanceof Error?e.message:'変更できませんでした。入力を保持しています。');}finally{lock.current=false;setBusy(false);}}
 return <section className="treasure-editor"><h3>自分が登録した宝物を編集</h3><p>位置の変更は今後の案内先に反映されます。進行中の冒険や獲得済みEXPは変更しません。</p><form onSubmit={e=>{e.preventDefault();void run();}}>
 <label>名前<input required maxLength={60} value={value.name} onChange={e=>change('name',e.target.value)} disabled={busy}/></label>
 <label>説明<textarea maxLength={160} value={value.comment} onChange={e=>change('comment',e.target.value)} disabled={busy}/></label>
 <label>カテゴリー<select value={value.category} onChange={e=>change('category',e.target.value)} disabled={busy}>{registrationCategories.map(c=><option key={c}>{c}</option>)}</select></label>
 <label>緯度<input type="number" step="any" min={-90} max={90} required value={value.latitude} onChange={e=>change('latitude',e.target.value===''?NaN:Number(e.target.value))} disabled={busy}/></label>
 <label>経度<input type="number" step="any" min={-180} max={180} required value={value.longitude} onChange={e=>change('longitude',e.target.value===''?NaN:Number(e.target.value))} disabled={busy}/></label>
 <PhotoThumbnails photos={treasurePhotoUrls(value).map((url,i)=>({url,label:i?'追加画像':'代表画像'}))}/>
 {[0,1].map(i=><label key={i}>写真{i+1}を差し替える<input type="file" accept="image/*" disabled={busy} onChange={e=>setFiles(old=>old.map((f,n)=>i===n?e.target.files?.[0]??null:f))}/>{files[i]&&<span>{files[i]!.name}（保存時に圧縮）</span>}</label>)}
 <button type="button" disabled={busy} onClick={()=>{setFiles([null,null]);change('image_url',null);change('additional_image_url',null);}}>写真の掲載を外す（原本は削除しません）</button>
 {error&&<p role="alert">{error}</p>}<div><button type="submit" disabled={busy}>{busy?'処理中…':'変更を保存する'}</button><button type="button" disabled={busy} onClick={onCancel}>編集をやめる</button></div></form>
 <button type="button" disabled={busy} onClick={()=>setConfirm(true)}>この宝物を削除する</button>{confirm&&<div role="alertdialog" aria-label="宝物の削除確認"><p>図鑑と今後の抽選から取り下げます。原本画像・評価・他の人の冒険記録・EXPは削除しません。</p><button type="button" disabled={busy} onClick={()=>void run(true)}>公開を取り下げる</button><button type="button" disabled={busy} onClick={()=>setConfirm(false)}>削除しない</button></div>}
 </section>;
}
