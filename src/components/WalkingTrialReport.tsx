import { useState } from 'react';
export function WalkingTrialReport({ report }: {report:string}) {
 const [message,setMessage]=useState(''),[fallback,setFallback]=useState(false);
 async function copy(){try{await navigator.clipboard.writeText(report);setMessage('座標・施設名なしでコピーしました。');}catch{setFallback(true);setMessage('下の内容を長押ししてコピーしてください。');}}
 return <details className="walking-trial-report"><summary>徒歩検索・試験版の測定結果</summary><pre>{report}</pre><button type="button" onClick={()=>void copy()}>測定結果をコピー（座標・施設名なし）</button><p role="status">{message}</p>{fallback&&<textarea aria-label="測定結果の手動コピー" readOnly value={report} onFocus={e=>e.currentTarget.select()}/>}</details>;
}
