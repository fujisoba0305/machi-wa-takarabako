const stages = {
  gps: 'GPS前のログイン確認・GPS取得', registered: '登録宝物の読み込み', treasures: '登録宝物の徒歩接続確認', authorization: '試験版の権限確認',
  manifest: 'データ版確認', index: 'データ索引の読み込み', worker: 'Worker起動', road: '道路データの読み込み',
  roadTile: '道路区画の読み込み', roadIndex: '道路索引の読み込み', facilities: '施設データの読み込み',
  evidence: '道路接続根拠の読み込み', tile: '接続根拠の読み込み', origin: '現在地と道路の接続判定',
  search: '道路・施設検索', distance: '徒歩距離計算', blocks: '街区データの読み込み', conditions: '検索条件の確認',
  roadSafety: '通行制限の確認', selection: '候補抽選', unknown: '段階未確認',
} as const;
export type TrialStage = keyof typeof stages;
export function trialStage(value: unknown): TrialStage { return typeof value === 'string' && Object.prototype.hasOwnProperty.call(stages, value) ? value as TrialStage : 'unknown'; }
export function trialStageLabel(value: unknown) { return stages[trialStage(value)]; }
export class WalkingTrialTrace {
  private started = performance.now();
  private entered = this.started;
  private current: TrialStage = 'gps';
  private steps: { stage: TrialStage; ms: number }[] = [];
  stage(value: unknown) { const next = trialStage(value); if (next === this.current) return; const now = performance.now(); this.steps.push({stage: this.current, ms: now - this.entered}); this.current = next; this.entered = now; }
  failureReport() { const now = performance.now(); return ['徒歩検索・試験版の停止診断（座標・施設名・アカウント情報なし）', '結果：停止', '最後の処理：' + stages[this.current], '検索開始から：' + ((now - this.started)/1000).toFixed(3) + '秒', ...[...this.steps, {stage: this.current, ms: now - this.entered}].map(s => stages[s.stage] + '：' + (s.ms/1000).toFixed(3) + '秒')].join('\n'); }
}
const reasons: Record<string,string> = {
 building: '地図上の建物形状との交差', water: '水路との交差', 'water-area': '水域との交差', rail: '線路との交差',
 barrier: '柵・壁などとの交差', restricted: '通行制限のある道路との交差', 'restricted-area': '立入制限のある敷地との交差',
 'elevated-road': '橋・高架・地下との高さの対応が未確認', 'no-positive-pedestrian-geometry': '歩ける接続区間の地図根拠が不足',
 'evidence-missing': '接続を調べる地図情報が不足',
};
export function originReasonLabel(value: unknown) { return typeof value === 'string' && Object.prototype.hasOwnProperty.call(reasons,value) ? reasons[value] : '詳細な接続理由は未確認'; }
const seconds = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? (value/1000).toFixed(3) + '秒' : '未測定';
export function originFailureReport(result: {status:string; originConnection?:{type?:string;reason?:string}; loadMs?:number;totalMs?:number;bodyBytes?:number; bytes?:Record<string,number>; timings?:{roadMs?:number;facilityLoadMs?:number;originMs?:number}}) {
 const blocked=result.status==='origin-blocked';const measuredBytes=typeof result.bodyBytes==='number'&&Number.isFinite(result.bodyBytes)&&result.bodyBytes>=0?result.bodyBytes:null;
 return ['停止段階：現在地と道路の接続判定', '停止コード：' + (blocked?'origin-blocked':'origin-unconnected'), '起点接続：' + (blocked?'地図上の障害物との交差で保留':'近くの道路への接続を確認できない'), '接続理由：' + originReasonLabel(result.originConnection?.reason), 'データ読込・準備：'+seconds(result.loadMs), '道路読込：'+seconds(result.timings?.roadMs), '施設データ読込：'+seconds(result.timings?.facilityLoadMs), '起点接続判定：'+seconds(result.timings?.originMs), 'Worker合計：'+seconds(result.totalMs), '今回の取得本文量：'+(measuredBytes===null?'未測定':(measuredBytes/1e6).toFixed(3)+'MB（ブラウザー通信キャッシュの有無は未確認）'), '徒歩探索・目的地抽選：未実行（起点接続が保留のため）', 'これはタイムアウトや施設候補0件ではありません。', 'キャッシュで読込が速くなっても、同じGPS点と地図データなら再度保留になる可能性があります。', '実際の障害物の有無、GPSや地図の位置ずれは現地未確認です。安全判定は緩めていません。'].join('\n');
}
