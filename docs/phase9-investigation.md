# 第9工程：実機検証準備と登録エラー調査結果

2026-10-13。iPhone Safari／写真付きの保存失敗という利用者の補足を反映。

## 結論と未確認事項

春日局乃像・大黒天の過去のレスポンス、写真ファイル、管理画面設定を取得できていないため、アップロードとINSERTのどちらで失敗したかは未確定。根本原因を修正済みとは扱わない。次回の失敗段階を安全に把握するための診断をローカル追加した。

登録経路はGPS取得→入力→写真アップロード（任意）→公開URL取得→treasures INSERT。OSM照合、施設名重複判定、対象2名称の禁止処理はない。サービスのモックテストで両名称がそのままINSERTに渡ることを確認。ただし実DBのCHECK/UNIQUE制約の存在までは否定できない。

写真は圧縮・形式変換・サイズ制限をフロントで行わず元ファイルのまま送る。パスはUUID＋拡張子で、宝物名はパスに使わない。iPhoneのHEIC/HEIFや大容量画像、Storageの許可形式/サイズ、アップロード通信、INSERT権限/制約を次の順で切り分ける。今回、写真形式や容量が原因だと断定していない。

1. 新しい失敗画面の確認用情報でimage_upload／image_url／db_insertを区別する。
2. Storage bucketの最大サイズ・許可MIME、storage.objectsのINSERT/DELETEポリシーを管理画面で読み取り確認する。
3. DBのGRANT・RLS・CHECK/NOT NULL/UNIQUEと、戻った許可済みエラーコードを照合する。
4. 不明な通信失敗なら先に図鑑を確認し、保存済みの可能性を排除してから再試行を判断する。

実DB監査権限を取得していない。既存phase7-readonly-audit.sqlを確認用として案内したが、SQL実行・管理画面変更・実登録・削除はしていない。公開URLで閲覧できることとアップロードの権限は別。[Storage権限の公式説明](https://supabase.com/docs/guides/storage/security/access-control)

## 追加した安全対策

- 失敗段階、HTTPステータス、許可リスト内のコード、画像形式と丸めた容量だけを表示・記録。写真名・写真内容・座標・名前・SQL詳細・トークン・URLは診断に出さない。
- DB拒否が確認できた場合だけ、今回アップロードした写真を従来どおり後処理する。通信途絶・5xx等で保存結果が不明なら写真を残し、図鑑確認を促す。サーバーで保存済みだった場合の画像消失を避ける。残存画像の棚卸しや重複送信のサーバー側冪等化は別工程。
- 失敗時の入力画面と進行中冒険を維持。GPS到着・EXP・評価・登録成功後の冒険復帰は変更していない。

## iPhone準備・性能

明示的な証明書設定時のみVite HTTPSを有効化。無設定時は従来のlocalhost、build時はHTTPS設定を無視。不正証明書をHTTPへフォールバックしない。証明書・鍵はGit除外し、VITE_環境変数へ入れない。mkcertによる作成と端末への信頼設定は利用者操作として手順書に分離した。今回は実行していない。

静的データ測定ページは本体Providerを公開座標で呼び、処理時間・候補数・Resource Timingを表示する。GPS・DB・報酬・外部APIは使わない。静的データ10,340,330bytes／gzip参考2,051,688bytes。初回検索と2回目キャッシュを比較できる。本体全体の初回表示時間とiPhone実転送量は未測定。

切り戻しは既存VITE_LOCAL_STATIC_SEARCH=offを維持。対象地域・固定距離・失敗時の既存分岐を変更していない。第8工程の静的施設ファイル、Provider、条件・manifestを作業前とのハッシュ比較で保護確認した。

## マイページ

Googleのプロフィール画像・名前、ゲスト/ログイン状態、ログアウト、失敗案内、セッション復元が既存実装にある。基本画面にはEXPゲージや個人投稿一覧はまだない。EXP・冒険回数はゲスト記録、発見履歴は図鑑の冒険の記録。登録に投稿者IDがないため、自分の投稿を推測で帰属させない。認証用とゲスト登録用のSupabaseクライアントは分離したまま。クラウド移行・保存形式変更なし。

## 今回の変更ファイル

- src/App.tsx：保存失敗案内、保存結果不明時の写真保持。
- src/services/treasureImages.ts：アップロード・URL・後処理の安全な診断。
- src/services/treasures.ts：INSERT診断、返却コード保持。
- src/features/treasureSaveDiagnostics.ts：診断の共通処理。
- vite.config.ts、dev/mobileHttps.ts、.gitignore：任意HTTPS。
- dev/mobile-load-check.html：読み込み測定。
- src/WalkingFlow.test.tsx、src/services/treasureSave.test.ts、src/features/treasureSaveDiagnostics.test.ts、dev/mobileHttps.test.ts：再現テスト。
- docs/phase9-iphone-check.md、docs/phase9-investigation.md：手順と報告。

## 検証結果

|確認|結果|
|---|---|
|全テスト|34ファイル、271件成功（既存250＋追加21）|
|TypeScript npx tsc --noEmit|成功|
|API型チェック npm run typecheck:api|成功|
|npm run build|成功、既知500kB超警告あり|
|git diff --check|リポジトリ本来の改行設定で成功|
|ローカル配信|本体・測定ページ・既存静的確認ページ・Providerモジュール200|
|実機HTTPS/GPS/OAuth|未実施、利用者確認待ち|
|実写真・実DBでの失敗再現|未実施、失敗レスポンス未取得|

追加テストでは画像アップロード拒否、URL失敗、DB制約エラー、結果不明、診断の個人情報排除、実名2件の通過、冒険維持、後処理の分岐、HTTPSの明示設定と不正鍵時停止をモックで確認。外部API・Supabase実書き込みは使っていない。

作業開始時の97ファイルをバックアップ・ハッシュ保存し、既存ファイルの今回差分は上記6ファイルだけ。生成されたtsconfig.tsbuildinfoは作業前の内容へ戻した。その他の保護対象は一致。既存の未コミット変更は保持。HEADはe7600872171b8065d44b4d40465e338e573e4fcfのまま。commit・push・デプロイ・DB/SQL/RLS変更なし。確認用開発サーバーは停止済み。
