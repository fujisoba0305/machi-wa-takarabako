import { useState } from 'react';
import { accountPersistenceReport } from '../services/accountSessionStorage';
export function AccountPersistenceDiagnostic() {
  const [report, setReport] = useState(''), [message, setMessage] = useState('');
  return <details onToggle={event=>{if(event.currentTarget.open)setReport(accountPersistenceReport());}}>
    <summary>認証保存の診断（個人情報なし）</summary>
    {report && <><pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{report}</pre>
    <button type="button" onClick={()=>{setReport(accountPersistenceReport());setMessage('現在の保存状態を確認しました。');}}>保存状態を再確認</button>
    <button type="button" onClick={async()=>{const value=accountPersistenceReport();setReport(value);try{await navigator.clipboard.writeText(value);setMessage('個人情報を含まない診断をコピーしました。');}catch{setMessage('下の欄を長押ししてコピーしてください。');}}}>認証保存の診断をコピー</button>
    <textarea aria-label="認証保存診断の手動コピー" readOnly value={report}/><p role="status">{message}</p></>}
  </details>;
}
