// Explicit allowlist: never copy coordinates, facility names/IDs, URLs, paths,
// timestamps, raw API errors or complete Worker objects.
import {stageLabels} from './diagnostics.mjs';
const allowed=(x,values)=>values.includes(x)?x:null;
const number=x=>Number.isFinite(x)&&x>=0?x:null;
const count=x=>Number.isSafeInteger(x)&&x>=0?x:null;
const failureLabels={gps:'現在地を取得できませんでした。再取得できます。','gps-accuracy':'GPS精度不足です。再取得できます。','gps-invalid':'新しいGPS位置を確認できませんでした。','insecure':'GPSには信頼されたHTTPSが必要です。','unsupported':'このブラウザーではGPSを利用できません。',manifest:'地域一覧の読み込みに失敗しました。再試行できます。',search:'データ読み込み・計算を完了できませんでした。再試行できます。',cancelled:'操作を中止しました。条件を確認して再検索できます。','coverage-incomplete':'道路データの範囲が不足しています。施設0件とは別です。','partition-incomplete':'必要な道路区画の読み直しが必要です。','origin-unconnected':'50m以内の利用可能道路へ接続できませんでした。'};
export function buildSafeReport({result=null,gps=null,firstLoadMs=null,mainMs=null,conditions={},failure=null}={}){
  const r=result||{},c=r.connectionCounts||{},m=r.measurement||{};
  const status=failure?allowed(failure.code,Object.keys(failureLabels))||'search':r.status==='ok'?(r.candidates?.length?'ok':'zero'):'search';
  return Object.freeze({version:25,status,
    distanceKm:allowed(conditions.km,[1,3,5,10]),category:allowed(conditions.mood,['カフェ','グルメ','神社・お寺','自然','写真','おまかせ']),
    method:allowed(conditions.method,['traditional','block','simple']),roadMode:allowed(r.roadLoading||conditions.roadMode,['bulk','partitioned','bulk-fallback']),
    gpsMode:gps?(gps.reused?'reused':'new'):'none',gpsMs:gps&&!gps.reused?number(gps.gpsMs):null,gpsAccuracy:gps?number(gps.accuracy):null,
    firstLoadMs:number(firstLoadMs),loadMs:number(r.loadMs),searchMs:number(r.searchMs),workerMs:number(r.totalMs),mainMs:number(mainMs),
    decodedBytes:number(r.decodedBytes),brotliBytes:number(r.brotliBytes),requestCount:count(m.downloads?.length),
    candidateCount:count(r.candidates?.length),facilityEvidenceCount:r.status==='ok'?(count(c['osm-node'])||0)+(count(c['osm-entrance'])||0)+(count(c['mapped-walk-connection'])||0):null,
    estimatedCount:r.status==='ok'?(count(c['block-estimate'])||0)+(count(c['nearest-road-estimate'])||0):null,origin:allowed(r.originConnection?.type,['mapped-walk-connection','unknown','blocked']),
    completeEvidenceCount:count(r.reachabilityCounts?.['osm-evidence-complete']),selectedRoadMeters:number(r.picked?.distanceMeters),selectedApproachMeters:number(r.picked?.approachEstimateMeters),
    selectedQuality:allowed(r.picked?.quality,['osm-node','osm-entrance','mapped-walk-connection','unknown','block-estimate','nearest-road-estimate']),
    networkReused:typeof m.networkReused==='boolean'?m.networkReused:null,
    stage:allowed(failure?.stage,Object.keys(stageLabels)),httpStatus:failure&&Number.isInteger(failure.httpStatus)&&failure.httpStatus>=400&&failure.httpStatus<=599?failure.httpStatus:null});
}
export function formatSafeReport(r){
  const seconds=n=>n===null?'未測定':(n/1000).toFixed(3)+'秒',meters=n=>n===null?'未確認':Math.round(n)+'m',items=n=>n===null?'未確認':n+'件',mb=n=>n===null?'未測定':(n/1e6).toFixed(3)+'MB';
  const outcome=r.status==='ok'?'検索完了（現地到達は未確認）':r.status==='zero'?'条件に合う候補0件（条件は変更していません）':failureLabels[r.status]||failureLabels.search;
  return ['街は宝箱・徒歩試作 第25工程／座標・施設名を含まない測定結果',
    '結果：'+outcome,'条件：'+(r.distanceKm===null?'未指定':r.distanceKm+'km')+'／'+(r.category||'未指定')+'／'+({traditional:'A',block:'B',simple:'C'}[r.method]||'未指定'),
    '道路読込：'+({bulk:'一括',partitioned:'地域分割','bulk-fallback':'一括へ復帰'}[r.roadMode]||'未確認'),
    'GPS：'+({new:'この操作で取得',reused:'再取得なし（前回の位置を再利用）',none:'この操作では未取得'}[r.gpsMode]),
    'GPS取得時間：'+seconds(r.gpsMs),'GPS精度：'+(r.gpsAccuracy===null?'未取得':r.gpsAccuracy.toFixed(1)+'m')+(r.gpsMode==='reused'?'（前回値）':''),
    'このWorkerの初回読込・準備：'+seconds(r.firstLoadMs),'今回の読込・準備：'+seconds(r.loadMs),
    '検索処理：'+seconds(r.searchMs),'Worker合計：'+seconds(r.workerMs),'検索から表示更新：'+seconds(r.mainMs),
    '今回の受信データ（HTTP自動解凍後）：'+mb(r.decodedBytes),'初回配信用Brotli容量：'+mb(r.brotliBytes)+'（実通信量・総メモリではありません）',
    '今回のデータ取得回数：'+(r.requestCount===null?'未確認':r.requestCount+'回'),
    '起点の道路接続：'+({ 'mapped-walk-connection':'OSM接続根拠あり（現地未確認）',unknown:'不明',blocked:'障害物等で保留'}[r.origin]||'未確認'),
    '候補合計：'+items(r.candidateCount),'施設側のOSM接続根拠あり：'+items(r.facilityEvidenceCount),'街区・最寄り道路の推定候補：'+items(r.estimatedCount),
    '起点・施設の両方にOSM接続根拠あり：'+items(r.completeEvidenceCount)+'（実機の到達確認ではありません）',
    '選択目的地の道路網上の距離：'+meters(r.selectedRoadMeters),
    '道路から登録地点への接続区間：'+(r.selectedApproachMeters===null?'未確認・加算なし':meters(r.selectedApproachMeters)+'（道路網の距離とは別）'),
    '選択目的地の分類：'+(['block-estimate','nearest-road-estimate','unknown'].includes(r.selectedQuality)?'推定・施設到達未確認':r.selectedQuality?'OSM接続根拠あり・現地未確認':'未選択'),
    '道路探索結果の再利用：'+(r.networkReused===null?'未確認':r.networkReused?'あり':'なし'),
    ...(r.stage?['停止段階：'+stageLabels[r.stage]]:[]),...(r.httpStatus?['HTTP状態：'+r.httpStatus]:[]),
    '距離基準：1km=0〜2km／3km=2〜4km／5km=4〜6km／10km=9〜11km',
    '道路距離・街区推定は実際に歩いた距離や施設入口までの到達保証ではありません。'].join('\n');
}
