export const stageLabels={worker:'Worker起動',roadSafety:'地図上の通行制限確認',roadIndex:'道路分割一覧',roadTile:'道路区画読込・ブラウザー解凍',roadMerge:'道路区画結合・検証',road:'道路読込・ブラウザー解凍',roadHash:'道路整合性',roadUnpack:'道路の可逆圧縮復元',facilities:'施設読込',facilityHash:'施設整合性',blocks:'街区推定データ読込',blockHash:'街区データ整合性',blockAssign:'街区JSON展開・適用',decode:'道路展開・検証',conditions:'カテゴリ条件読込',tile:'接続根拠読込',tileHash:'接続根拠整合性',connection:'道路への接続',distance:'徒歩距離計算',result:'抽選・結果表示',gps:'GPS取得',manifest:'地域一覧読込'};
export function stageBudget(stage){return ['road','roadSafety','roadIndex','roadTile','facilities','blocks','tile','conditions','manifest'].includes(stage)?120000:stage==='worker'?15000:30000;}
export function safeDiagnostic(stage,details={}){return {stage:stageLabels[stage]?stage:'worker',...(Number.isFinite(details.elapsedMs)?{elapsedMs:Math.round(details.elapsedMs)}:{}),...(Number.isFinite(details.bytes)?{bytes:details.bytes}:{}),...(Number.isFinite(details.count)?{count:details.count}:{})};}
export function gpsFixIssue(fix, now=Date.now()) {
  const c=fix?.coords;
  if(!c || !Number.isFinite(c.latitude) || !Number.isFinite(c.longitude) || Math.abs(c.latitude)>90 || Math.abs(c.longitude)>180) return 'GPS座標の形式を確認できませんでした。';
  if(!Number.isFinite(c.accuracy) || c.accuracy<0) return 'GPS精度の情報を確認できませんでした。';
  if(!Number.isFinite(fix.timestamp) || fix.timestamp<=0) return 'GPS取得時刻を確認できませんでした。';
  if(now-fix.timestamp>30000) return '取得したGPS位置が30秒より古いため使用しませんでした。もう一度取得してください。';
  if(fix.timestamp>now+5000) return 'GPS取得時刻が端末の現在時刻より先になっています。iPhoneの日付と時刻を確認してください。';
  return null;
}
