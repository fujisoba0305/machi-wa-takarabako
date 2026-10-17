import {inspectLegacyDiscoveries} from '../features/adventureHistory';
import type {PersonalDiscovery} from '../features/personalDiscoveries';
export function LegacyHistoryNotice({discoveries,storage=localStorage}:{discoveries?:PersonalDiscovery[];storage?:Pick<Storage,'getItem'>}){
 const audit=inspectLegacyDiscoveries(storage);
 if(audit.state==='absent')return null;
 if(audit.rawCount===null)return <section className="my-page-card" aria-label="旧履歴の保全状況"><h3>旧履歴の件数は確認できません</h3><p>保存領域またはデータ形式を読み取れません。0件として扱わず、元データを上書き・初期化していません。</p></section>;
 const current=new Set((discoveries??[]).filter(r=>r.source==='treasure').map(r=>r.treasure.id));const excluded=audit.records.filter(r=>!current.has(r.treasureId)).length;
 return <section className="my-page-card" aria-label="旧履歴の保全状況"><h3>旧形式の発見記録を保管中</h3><p>読み取れた旧宝物：{audit.records.length}件（重複を除く）。発見者UIDがないため、旧発見日は現在のアカウントへ自動移行していません。</p>{discoveries!==undefined&&<p>新図鑑に同じ宝物がまだ表示されていない旧宝物：{excluded}件。</p>}{audit.duplicateCount>0&&<p>元データ内の重複：{audit.duplicateCount}件。元の行は削除していません。</p>}{audit.invalidCount!>0&&<p>検証できない保存行：{audit.invalidCount}件。件数を確定できない部分として保管しています。</p>}<p>新図鑑と同じ宝物がある場合も、旧発見日の帰属確認は未完了です。元の履歴・EXP・レベル・到着記録は削除していません。</p></section>;
}
