import { createStorageProbe, removeStorageProbe } from '../services/accountStorageContext';
import { useState } from 'react';
import { accountPersistenceReport } from '../services/accountSessionStorage';
export function AccountPersistenceDiagnostic() {
  const [report, setReport] = useState(''), [message, setMessage] = useState('');
  return <details onToggle={event=>{if(event.currentTarget.open)setReport(accountPersistenceReport());}}>
    <summary>認証保存の診断（個人情報なし）</summary>
    {report && <><pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{report}</pre>
    <button type="button" onClick={()=>{setReport(accountPersistenceReport());setMessage('現在の保存状態を確認しました。');}}>保存状態を再確認</button>
    <button type="button" onClick={async()=>{const value=accountPersistenceReport();setReport(value);try{await navigator.clipboard.writeText(value);setMessage('個人情報を含まない診断をコピーしました。');}catch{setMessage('下の欄を長押ししてコピーしてください。');}}}>認証保存の診断をコピー</button>
    <p>領域を比較する場合だけ確認コードを作成してください。認証には使わず、端末内に保存し、24時間で失効します。自動送信はしません。</p>
    <button type="button" onClick={()=>{try{createStorageProbe();setReport(accountPersistenceReport());setMessage('診断用確認コードを保存しました。再読み込み・再起動後と比較してください。');}catch(error){setMessage(error instanceof Error?error.message:'確認コードを保存できません。');}}}>領域比較用の確認コードを作成</button>
    <button type="button" onClick={()=>{try{removeStorageProbe();setReport(accountPersistenceReport());setMessage('診断用確認コードだけを削除しました。');}catch{setMessage('確認コードを削除できません。');}}}>診断用確認コードだけを削除</button>
    <textarea aria-label="認証保存診断の手動コピー" readOnly value={report}/><p role="status">{message}</p></>}
  </details>;
}
