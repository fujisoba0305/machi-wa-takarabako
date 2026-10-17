export type TreasureSaveStage = 'image_upload' | 'image_url' | 'db_insert' | 'image_cleanup';
export type SaveDiagnostic = { stage: TreasureSaveStage; httpStatus: number | null; code: string; outcome: 'rejected' | 'unknown' };
const safeCodes = new Set(['23505', '23502', '23514', '22001', '22P02', '42501', '42703', 'PGRST204', 'PGRST301', 'PGRST302']);
export class TreasureSaveError extends Error {
  constructor(public diagnostic: SaveDiagnostic) { super('Treasure save operation failed'); this.name = 'TreasureSaveError'; }
}
export function saveDiagnostic(error: unknown, stage: TreasureSaveStage): SaveDiagnostic {
  if (error instanceof TreasureSaveError) return error.diagnostic;
  const e = error && typeof error === 'object' ? error as Record<string, unknown> : {};
  const value = e.statusCode ?? e.status;
  const status = typeof value === 'number' ? value : typeof value === 'string' && /^[45][0-9]{2}$/.test(value) ? Number(value) : NaN;
  const httpStatus = Number.isInteger(status) && status >= 400 && status <= 599 ? status : null;
  const code = typeof e.code === 'string' && safeCodes.has(e.code) ? e.code : 'unknown';
  // Transport failures may occur AFTER INSERT commits. Never claim that nothing was saved.
  const outcome = safeCodes.has(code) || (httpStatus !== null && httpStatus >= 400 && httpStatus < 500 && ![408, 429].includes(httpStatus)) ? 'rejected' : 'unknown';
  return { stage, httpStatus, code, outcome };
}
export function imageDiagnostic(file: File) {
  const formats: Record<string, string> = { 'image/jpeg': 'JPEG', 'image/png': 'PNG', 'image/webp': 'WebP', 'image/heic': 'HEIC', 'image/heif': 'HEIF', 'image/gif': 'GIF', 'image/avif': 'AVIF' };
  return { format: formats[file.type.toLowerCase()] || 'unknown', sizeMiB: Math.ceil(file.size / 1048576) };
}
export function saveFailureMessage(error: unknown, stage: TreasureSaveStage, file: File | null) {
  const d = saveDiagnostic(error, stage), label = { image_upload: '写真のアップロード', image_url: '写真URLの取得', db_insert: '宝物情報の保存', image_cleanup: '今回の写真の後処理' }[d.stage];
  const tooLarge = d.stage === 'image_upload' && d.httpStatus === 413;
  const unsure = tooLarge ? '写真のサイズが保存先の上限（現在1枚5MB）を超えています。小さいサイズで書き出した写真に選び直すか、写真なしで登録してください。入力内容はそのまま残っています。' : d.stage === 'db_insert' && d.outcome === 'unknown' ? '保存結果を確認できません。再送する前に図鑑で登録済みか確認してください。' : '通信状態や入力内容を確認してください。';
  const image = file ? imageDiagnostic(file) : null;
  return `宝物を保存できませんでした。${label}の段階で停止しました。${unsure} 確認用情報：${d.stage}/${d.httpStatus ?? '不明'}/${d.code}${image ? `/${image.format}/約${image.sizeMiB}MiB` : ''}`;
}
