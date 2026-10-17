import {useState} from 'react';
import {inspectLegacyPreservation} from '../features/adventureHistory';
export function LegacyHistoryDiagnostic({storage=localStorage,currentCount}:{storage?:Pick<Storage,'getItem'>;currentCount?:number}){
 const [message,setMessage]=useState('');const audit=inspectLegacyPreservation(storage);
 const state=(s:string)=>({absent:'保存キーなし',readable:'読み取り可能',partial:'一部の行は検証不能',invalid:'形式を確認できない',unavailable:'保存領域を読み取り不能'}[s]??'未確認');
 const count=(n:number|null)=>n===null?'未確認':String(n);
 const text=['旧履歴・保全診断 v1','元履歴：'+state(audit.original.state),'元履歴の行数：'+count(audit.original.rows),'元履歴の有効な宝物数：'+count(audit.original.validUnique),'元履歴の検証不能行：'+count(audit.original.invalid),'元履歴の重複行：'+count(audit.original.duplicates),'バックアップ：'+state(audit.backup.state),'バックアップの行数：'+count(audit.backup.rows),'バックアップの有効な宝物数：'+count(audit.backup.validUnique),'原文一致：'+(audit.sameRaw===null?'比較不可':audit.sameRaw?'一致':'異なる（追記後など）'),'新図鑑の表示件数：'+(currentCount===undefined?'未確認':currentCount),'読み取り専用・自動移行なし'].join(String.fromCharCode(10));
 return <details className="my-page-card"><summary>旧履歴の読み取り診断（個人情報なし）</summary><p>この確認では保存・初期化・移行を行いません。バックアップは旧履歴へ最初に追記する前に作成するため、未作成でも消失の証拠にはなりません。キーが見つからなくても別の保存領域や未保存の可能性があり、削除されたとは断定しません。</p><textarea aria-label="旧履歴の診断結果" readOnly rows={14} value={text}/><button type="button" onClick={()=>{void(async()=>{try{if(!navigator.clipboard?.writeText)throw Error();await navigator.clipboard.writeText(text);setMessage('診断をコピーしました。');}catch{setMessage('コピーできませんでした。診断欄を選択してコピーしてください。');}})();}}>座標・名前なしで診断をコピー</button>{message&&<p role="status">{message}</p>}</details>;
}
