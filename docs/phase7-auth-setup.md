# Season 2 第7-A / 第7-B

## 今回の境界
Google認証の入口だけを追加。EXP、冒険回数、発見履歴、ゲスト名、進行中冒険は従来の端末記録のまま。クラウド移行・投稿者紐づけは未実装。別アカウントでログインしても端末記録をアカウントの成果として表示・送信しない。
既存の宝物/Storage/評価のクライアントはセッション永続化とURL認証検出を無効化し、ゲストとして従来の操作を継続。認証専用クライアントは別の保存キー `machiAccountAuth.v1` とPKCEを使用する。既存localStorageキーを削除・書き換える移行処理はない。Supabase SDKが認証専用の新しいキーを保存・更新する。
冒険中はログイン/ログアウトを禁止。通常のゲストプレイはそのまま。既存タイトルは変更しない。

## 第7-A：実DBは未監査
利用できる管理接続・Supabase管理ツールがないため、本番テーブル/RLS/GRANT/Storageの現在値は未確認。リポジトリのSQLは実DBの証明にはならない。
`phase7-readonly-audit.sql` は確認用SELECTだけで、こちらでは実行していない。Supabase Dashboardで対象プロジェクトを確認し、SQL Editor → New queryへ貼り付けて実行すると設定のみ取得できる。宝物本文・ユーザー情報・秘密情報は取得しない。結果を共有する場合も秘密情報を含めないこと。
さらにDashboardでData APIの公開スキーマ、Googleプロバイダー、Site URL/Redirect URLs、Storageの各ポリシーを確認する。SQL結果でRLS無効、広いGRANT、無条件ポリシー、過大なEXECUTE権限がないか照合する。

### ソース上の注意点
- discovery_count加算と評価投稿RPCはanonにもEXECUTEがある。Googleログインを追加しても不正呼び出し防止にはならない。
- treasuresの所有者は未保存。過去投稿を名前や画像で自動所有扱いにしない。
- treasure-imagesは公開URL利用。個人専用写真をこのバケットへ追加しない。
- 認証とゲストの接続を分けないと既存評価RPCがauth.uid()を保存し、意図せず投稿をアカウントへ紐づけるため分離した。
- 認証トークンはブラウザ保存。XSS対策を維持し、トークン/コード/エラー詳細をログ出力しない。プロフィール画像はHTTPSのGoogle画像ホストのみ、失敗時はローカルSVG。
- 新規テーブルやGRANT/RLSの変更は今回なし。公開前に上記実DB監査を完了する。

## Googleログインの設定手順（ユーザー操作）
1. Google Cloud Consoleでこのアプリ用プロジェクトを選ぶ。Google Auth PlatformのBrandingにアプリ名・サポート用メールを設定する。Audienceは一般利用ならExternal。テスト中はTest usersに自分のGoogleアカウントを登録する。
2. Data Accessはopenid・メール・基本プロフィールのみ。Driveや位置情報などは追加しない。公開時は必要なホームページ・プライバシーポリシー・利用規約・ドメイン確認を整える。
3. Clients → Create client → Web application。Authorized JavaScript originsに実際の開発origin（例 http://localhost:5173）を登録する。本番反映時に https://machi-wa-takarabako.vercel.app も登録する。
4. Supabase Dashboard → Authentication → Sign In / Providers → Googleを開く。表示されたCallback URLをコピーして、GoogleのAuthorized redirect URIsへ正確に登録する。これはアプリURLではなくSupabaseが表示するURL。
5. Googleで作成されたClient IDとClient SecretをSupabaseのGoogle設定欄に入力して保存・有効化する。秘密情報をチャット、ソース、VITE_変数、スクリーンショットへ入れない。
6. Supabase Authentication → URL ConfigurationでSite URLを本番URLへ設定。Redirect URLsへ使用するURLを完全一致で登録する。
   - 開発: http://localhost:5173/?account=1&auth_callback=1 （実際のポート/originに合わせる）
   - 本番公開時: https://machi-wa-takarabako.vercel.app/?account=1&auth_callback=1
   広いワイルドカードは使用しない。今回は本番デプロイしない。
7. ローカルの既存VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEYが正しいプロジェクトか確認。Google Secretやservice_roleキーは不要。アプリのマイページ → Googleでログイン。
8. 同じブラウザでGoogleから戻ることを確認。PKCEは開始したブラウザの保存情報が必要。Safariで始めて別アプリ内ブラウザで完了する等は失敗するため、同じブラウザでやり直す。保存を禁止する設定やプライベートモードにも注意。
9. ログイン後はマイページへ復帰。キャンセル・通信失敗・期限切れは案内を表示。ログアウトはこの端末だけ。Google自体や他端末からログアウトする操作ではない。

## 公開前の実機確認
Google設定未完了の状態で本物のOAuth成功は保証できない。設定後、iPhone Safari/Android Chromeで成功・キャンセル・再読込・画像表示・ローカルログアウト・別アカウント切替を確認。変更前後でゲストEXP/冒険回数/履歴/冒険IDが同一であることを確認。冒険中は認証操作が無効で、冒険復帰が可能なことを確認。

## 公式資料
- https://supabase.com/docs/guides/auth/social-login/auth-google
- https://supabase.com/docs/guides/auth/sessions/pkce-flow
- https://supabase.com/docs/reference/javascript/auth-signout

背景は既存walking-park.webpを再利用（src/assets/walking-park.LICENSE.md）。新規素材・DB変更・自動データ移行なし。
