export type SearchFailure = 'location' | 'overpass' | 'static' | 'empty' | 'distance' | 'limit' | 'walking' | 'treasures';
export const searchFailureMessages: Record<SearchFailure, string> = {
location: '現在地を取得できませんでした。位置情報の許可を確認して、もう一度現在地を取得してください。',
static: '施設データを読み込めませんでした。条件を保ったまま、もう一度お試しください。',
overpass: '施設検索サービスに接続できませんでした。条件はそのままで、少し待ってからもう一度お試しください。',
empty: 'この条件では、名前と位置を確認できる施設・宝物が見つかりませんでした。',
distance: '取得した候補の中に、指定した距離で到達できる目的地がありませんでした。',
limit: '候補の確認上限に達しました。未確認の候補があるため、目的地がないとは限りません。',
walking: '徒歩距離を確認できませんでした。条件を保持しています。少し待ってからもう一度お試しください。',
treasures: '登録宝物を読み込めませんでした。少し待ってからもう一度お試しください。',
};
