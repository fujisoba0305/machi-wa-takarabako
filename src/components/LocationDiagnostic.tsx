import {useState} from 'react';
export function LocationDiagnostic({report}:{report:string}){
 const [message,setMessage]=useState('');if(!report)return null;
 return <details className="startup-gps-diagnostic" open><summary>現在地取得の診断（座標なし）</summary><pre>{report}</pre><button type="button" onClick={async()=>{try{await navigator.clipboard.writeText(report);setMessage('座標・住所・氏名なしでコピーしました。');}catch{setMessage('下の欄を長押ししてコピーしてください。');}}}>診断結果をコピー（座標なし）</button><textarea aria-label="現在地取得診断の手動コピー" readOnly value={report}/><p role="status">{message}</p></details>;
}
