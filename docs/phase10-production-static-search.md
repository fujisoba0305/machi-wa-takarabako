# 第10工程：東京・神奈川の静的施設検索公開

2026-10-13。東京・神奈川内の通常「？km」検索に限って静的Providerを本番でも有効にする。対象外地域・固定距離・デートは既存経路。登録宝物との50%分岐、カテゴリ・料理ジャンル・おまかせ条件、Google Maps徒歩リンク、GPS到着、EXPと保存形式を維持する。Googleログイン・マイページ・登録エラー診断も利用者の明示承認で公開対象に含める。DB・SQL・RLS変更とデータ移行なし。

## 配信と通信量

施設データ56,701要素。公開用2ファイル合計10,340,330bytes、gzip参考2,051,688bytes。Vercelビルドのdistに同じSHA-256のファイルが出力されることを確認する。ハッシュ付きの2URLだけに1年のCache-Control immutableを設定し、同名の内容変更は禁止。データ更新では新ファイル名・manifest・キャッシュルールを同時更新する。失敗結果をキャッシュせず、同じタブでは取得・索引を再利用する。

OSM contributorsの表示と、公開JSONをODbLで配布するREADMEを維持。ユーザーの登録宝物、ゲスト記録、認証情報はOSMファイルに含めない。

Vercel管理画面のチーム合計（確認時点、過去30日）：Fast Data Transfer 301.41MB / 100GB、Fast Origin Transfer 307.71MB / 10GB、Deployment Storage 50.04MB / 10GB、CDN requests約2.1K / 1M。これはこのアプリ単独の使用量ではない。無料枠の将来適合を保証するものではない。

圧縮転送が約2.05MBなら静的データだけの初回1万回で約20.52GB、未圧縮なら約103.40GB。1回目だけ大きく、ブラウザキャッシュとCDNを利用する。画像・JS・他プロジェクト・更新版の追加通信は別途。実際のVercel Content-Encodingと転送量は公開後に測定する。回線速度が10Mbpsの場合、静的データ約2.05MBだけで理論上約1.64秒＋遅延・解析、未圧縮なら約8.27秒であり、実機の表示時間とは異なる。

Hobbyは100GBのFast Data Transferを含み、超過時は通常機能停止/一定期間待機。個人の非商用利用が対象。広告・店舗クーポン等の商用化前には適用条件を再確認する。今回は課金設定を変更しない。[Vercel公式](https://vercel.com/docs/plans/hobby)

## 無料APIの境界

通常「？km」は検索時の徒歩距離確認を通らず、出発時の任意Routes取得も無効。到着は端末GPSと既存報酬処理。Google Mapsはapi=1/travelmode=walkingのURLリンクで、Google RoutesやPlacesのサーバーAPIではない。テストは外部APIを禁止/モックして確認する。

固定距離・デートの既存距離取得経路とapi/walking-distanceは今回変更しない。したがってアプリ全条件から有料APIが排除されたという意味ではない。今回の本番確認ではこれらを実呼び出ししない。

## 切り戻し

1. 静的検索のみ停止：Vercelの当該プロジェクトProduction環境で `VITE_LOCAL_STATIC_SEARCH=off` を設定し、同じcommitを再ビルド・デプロイする。Viteのビルド時設定なので環境変数の保存だけでは既存配信JSは変わらない。戻すときは変数を削除、またはonにして再ビルドする。
2. 公開一式を戻す：VercelのInstant Rollbackで、公開前のReady deployment（Source e7600872171b8065d44b4d40465e338e573e4fcf）を選び、ドメインの切替を確認する。Googleログイン・診断など今回の追加も旧版になる。DB・localStorageは削除しない。
3. Git履歴で戻す場合は新しいrevert commitを作る。mainのforce pushやユーザーの未コミット変更の破棄は行わない。

静的データ読込エラーは失敗として案内する。障害時に無断でOverpassへフォールバックせず、検索条件を保つ。

## 公開後の確認と限界

Vercel Production/Ready/Current、SourceとGitHub mainのcommit一致、ビルドログ、2ファイルの200応答・SHA-256・キャッシュヘッダー・圧縮、画面の読み込みを確認する。実機GPS/OAuthの成功率やスマホ回線の読み込み時間は、PCの自動テスト/HTTP測定と区別する。Supabaseに宝物・評価を試験投稿しない。

Googleログインには `https://machi-wa-takarabako.vercel.app/?account=1&auth_callback=1` のSupabase Redirect URLs登録が必要。管理画面の認証設定は今回変更しない。ゲストEXP・冒険回数・発見履歴の同期、個人投稿への帰属は未実装で、その旨をマイページで表示する。
