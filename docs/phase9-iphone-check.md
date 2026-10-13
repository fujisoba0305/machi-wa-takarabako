# 第9工程：iPhone Safariでローカル版を確認する

2026-10-13。今回は本番デプロイ、DB変更、実登録、証明書のインストールは行っていません。以下の端末操作は利用者自身が実施します。

## 先に知っておくこと

- GPSには信頼されたHTTPS接続が必要です。PCのLANアドレスをHTTPで開く方法や、証明書警告を無視する方法は使いません。[Geolocation API](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation_API)
- 自宅など信頼できる同一Wi-FiにPCとiPhoneを接続します。PCは起動したままにします。公衆Wi-Fi、ルーターのポート開放、無断の公開トンネルは使いません。
- HTTPSのLANアドレスは本番やlocalhostと別の保存領域です。本番のEXP・履歴・ログインが表示されなくても消えたわけではありません。既存のWebサイトデータを削除しないでください。
- ローカル版も既存Supabaseへ接続します。宝物登録・評価は本番DBへの書き込みです。今回は表示・検索・ナビを先に確認し、書き込みテストは別途判断してください。
- 東京・神奈川の通常「？km」を選びます。固定距離は今回の無料検索確認の対象外です。対象外の地域・条件では旧検索を使います。

## 1. PCに開発用証明書を用意する（利用者操作）

1. [mkcert公式](https://github.com/FiloSottile/mkcert)のWindows手順で導入します。既存のChocolatey/Scoop、または公式配布バイナリを使います。
2. PowerShellで `ipconfig` を実行し、使っているWi-FiのIPv4アドレスを確認します。以下の `192.168.1.20` は例です。必ず自分のPCの値に置き換えます。
3. 次を実行します。`mkcert -install` はPCの証明書信頼設定を変更します。

```powershell
Set-Location -LiteralPath 'C:/Users/higep/Documents/machi-wa-takarabako'
New-Item -ItemType Directory -Path '.local-https' -Force
mkcert -install
mkcert -cert-file .local-https/mobile.pem -key-file .local-https/mobile-key.pem 192.168.1.20 localhost 127.0.0.1
mkcert -CAROOT
```

最後に表示されたフォルダにある **rootCA.pemだけ**を、自分のiPhoneへ安全に転送します。秘密鍵 `rootCA-key.pem` と `mobile-key.pem` は転送・共有・チャット貼り付けをしません。rootCA-keyは信頼された証明書を作れてしまう重要な鍵です。証明書をアプリのpublicフォルダへ入れないでください。

## 2. iPhoneで自分の開発用CAを信頼する（利用者操作）

転送したrootCA.pemを開き、設定のダウンロード済みプロファイルからインストールします。その後「設定 → 一般 → 情報 → 証明書信頼設定」で、自分が作成したCAだけを完全に信頼します。他人のCAは使いません。検証終了後、不要になったプロファイルは設定から削除できます。[Appleの公式手順](https://support.apple.com/en-us/102390)

## 3. サーバーを1つだけ起動する

既存の開発サーバーを、そのPowerShellのCtrl+Cで止めてから次を実行します。

```powershell
Set-Location -LiteralPath 'C:/Users/higep/Documents/machi-wa-takarabako'
$env:MACHI_DEV_HTTPS_CERT = 'C:/Users/higep/Documents/machi-wa-takarabako/.local-https/mobile.pem'
$env:MACHI_DEV_HTTPS_KEY = 'C:/Users/higep/Documents/machi-wa-takarabako/.local-https/mobile-key.pem'
npm run dev
```

この設定をした場合だけLANから接続できます。証明書が不正なら停止し、HTTPへ自動で切り替えません。5173が使用中なら5174を追加せず、既存サーバーを確認します。

Windowsの通信許可が必要なら、信頼できる**プライベートネットワークのみ**を対象にします。iPhone Safariで `https://192.168.1.20:5173/`（実際のPCアドレス）を開きます。証明書警告が出る場合は先へ進まず、IPと証明書、CA信頼を確認します。

IPが変わったら証明書と次のOAuth戻り先も合わせます。通常のPC開発へ戻すときはCtrl+Cで停止し、同じPowerShellでHTTPS設定を外します。

```powershell
Remove-Item Env:MACHI_DEV_HTTPS_CERT -ErrorAction SilentlyContinue
Remove-Item Env:MACHI_DEV_HTTPS_KEY -ErrorAction SilentlyContinue
npm run dev
```

## 4. 読み込みと検索の確認

1. 本体を開く時間、端末機種、Wi-Fi条件を記録します。今回、実機の時間は未測定です。
2. 同じアドレスの `/dev/mobile-load-check.html` を開き「読み込みを測定する」を2回押します。初回の読込・検索時間と2回目のメモリ再利用を比較できます。候補数、ファイルごとの時間・転送量のみを表示し、端末GPSは取得しません。
3. `/dev/static-search-check.html` は既存の本体Providerによる抽選・Google Mapsリンク確認です。公開座標を使い、外部APIは禁止しています。
4. 本体に戻りSafariの位置情報を許可します。「？km」とカテゴリを選び、冒険コイン→ガチャ→一般施設の表示を確認します。候補がない場合はその条件を記録し、自動で条件を変更しません。
5. 「ここへ行く」からGoogle Mapsへ移り、元のSafariタブへ戻ります。目的地、冒険の続き、ナビ再開が維持されるか確認します。GPS到着の100m・accuracy50m条件は従来のままです。

静的ファイルは現在2ファイル合計 **10,340,330 bytes**。gzip換算 **2,051,688 bytes** は参考値で、開発サーバーの実転送量ではありません。測定ページの転送量0はキャッシュまたは情報取得不可の可能性があり、通信量0の証明として使いません。本体JS・写真・開発用モジュールの通信はこの静的データ測定に含みません。

Wi-Fi圏外へ歩くとPCにつながらなくなります。本格的な街歩きにはPCも接続した信頼できるモバイルネットワーク等が必要で、IP・証明書を合わせ直します。家庭Wi-Fiだけの結果を街歩き全体の成功率とは扱いません。公開プレビュー等は別工程で承認を受けます。

## 5. Googleログイン

SupabaseのAuthentication → URL Configuration → Redirect URLsへ、自分の `https://192.168.1.20:5173/?account=1&auth_callback=1` を完全一致で追加する必要があります。これは利用者の管理画面操作で、今回は未実施です。本番Site URLは変えません。Google側のCallback URIは既存Supabaseのものを維持します。[Supabaseの戻り先設定](https://supabase.com/docs/guides/auth/redirect-urls)

冒険開始前に通常モードのSafariでマイページを開き、Googleログイン→同じSafariへの復帰→プロフィール表示→更新後の維持→ログアウトを確認します。別のアプリ内ブラウザやプライベートモードへの切替は避けます。冒険中は既存仕様で認証操作が無効です。

現在のマイページはアカウント状態・プロフィール・ログイン管理の基本画面です。EXP・冒険回数は端末のゲスト記録、発見履歴は図鑑の「冒険の記録」で確認します。アカウントへの同期や「自分が投稿した宝物」の所有者判定は未実装です。ログインしてもこれらを自動移行しません。

## 6. 宝物登録エラーが再発したら

今回は実際の失敗レスポンスがないため、春日局乃像・大黒天の失敗段階は未確定です。次回の失敗時に画面の「確認用情報」だけを控えてください。例：`image_upload/413/unknown/HEIC/約7MiB`（架空の例）。名前、座標、写真、認証情報、URLを含むNetworkログは共有しません。

- `image_upload`：Storageへ写真を送る段階。画像形式・サイズ、通信、バケット設定を確認します。
- `image_url`：アップロード後の公開URL取得段階。
- `db_insert`：宝物情報をDBへ保存する段階。権限・制約等は実DB設定との照合が必要です。
- DB保存結果が不明なら、**すぐ再送せず図鑑で保存済みか確認**します。名前だけで同一と決めず、写真・場所も本人が確認します。

現在は画像圧縮・HEIC変換を行わず元ファイルをアップロードしています。6MBはこのアプリの拒否上限ではありませんが、Supabaseは大きなファイルに再開可能アップロードを推奨しています。[標準アップロードの公式資料](https://supabase.com/docs/guides/storage/uploads/standard-uploads)

既存 `docs/phase7-readonly-audit.sql` と管理画面で、treasuresの制約・RLS・GRANT、Storageの容量/MIME設定・INSERT/DELETE権限を読み取り確認します。公開写真を閲覧できることと、アップロード権限は別です。Googleログインと登録用ゲスト接続は分離されています。今回は実DBの設定取得・SQL実行・権限変更をしていません。

## 切り戻し

第8工程の手順を維持しています。サーバー停止後 `$env:VITE_LOCAL_STATIC_SEARCH = 'off'` で再起動すると旧検索です。元に戻すには停止して `Remove-Item Env:VITE_LOCAL_STATIC_SEARCH -ErrorAction SilentlyContinue`、再起動します。HTTPS設定はそのままで構いません。既存の保存記録は削除しません。旧検索では公開Overpassへ接続するため、今回は切り戻しの実API検索を追加実行していません。

## この工程の検証

全271テスト成功（既存250＋追加21）、TypeScript、API専用型チェック、build成功。buildの既知500kB警告は残っています。HTTPローカルで本体、2つの確認ページ、Providerモジュールの200応答を確認しました。iPhone HTTPS/GPS/OAuth、実画像での再発、実機通信量は利用者の確認待ちです。証明書・秘密鍵は未生成、確認用サーバーは終了済みです。
