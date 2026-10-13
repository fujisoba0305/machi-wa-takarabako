# 第8工程：ローカル静的施設検索の確認

東京・神奈川の通常「？km」だけ、開発サーバーで静的検索を利用します。本番ビルドでは未有効です。固定距離・デート・対象地域外の検索は旧経路を維持しています。

## 起動

PowerShellで実行します。

```powershell
Set-Location -LiteralPath 'C:/Users/higep/Documents/machi-wa-takarabako'
npm run dev
```

http://localhost:5173/ が本体です。5173が使用中なら別ポートを増やさず、先にどのサーバーが動いているか確認してください。終了はCtrl+C。

## 端末GPSを使わない確認

http://localhost:5173/dev/static-search-check.html を開きます。

1. 「東京駅のカフェを抽選する」を押すと、本体のProviderがローカル静的ファイルを読みます。
2. 一般施設名、候補数、方式static-local、Google Maps徒歩リンクを確認します。
3. 「辻堂の写真条件を確認する」は本体条件の候補0件を表示します。条件を緩めず、外部APIへも切り替えません。
4. 続けて再検索しても、成功取得済みのファイルはメモリから再利用します。

これは開発用の確認ページで、本体のガチャ画面ではありません。テスト座標の結果を実機GPSや街歩きの成功率と混同しないでください。確認ページからDB登録・評価・報酬処理は実行しません。

## 本体の確認

本体でカテゴリを選び「？km」→冒険コイン→ガチャへ進みます。現在地が東京・神奈川内なら静的検索、外なら旧検索です。位置がない場合は既存の再取得案内になります。

ブラウザの開発者ツールのConsoleで[facility-search]、Networkで/facilities-local-v1/を確認できます。対象検索と「？km」の冒険開始では/api/walking-distanceを呼びません。Google Mapsは通常のURLリンクです。検索診断に実座標・名前・認証情報は出しません。

写真カテゴリには0件地点が残っています。失敗時の案内に従って本人が条件を変えることはできますが、アプリは自動で変更しません。データ読込障害は「施設データを読み込めませんでした」と区別します。

実機GPS・Google Mapsへ移動して戻る確認は次工程です。スマホの位置情報は安全な接続が必要なため、単にPCのHTTPアドレスを開いただけでは許可されない場合があります。公開トンネル・新規デプロイは今回は行っていません。

## 明示的に旧検索へ戻す

開発サーバーをCtrl+Cで止め、同じPowerShellで実行します。

```powershell
$env:VITE_LOCAL_STATIC_SEARCH = 'off'
npm run dev
```

戻す場合は再度止めて実行します。

```powershell
Remove-Item Env:VITE_LOCAL_STATIC_SEARCH -ErrorAction SilentlyContinue
npm run dev
```

この切替は既存localStorage・Googleログイン・進行中冒険を削除しません。旧検索へ戻すと公開Overpassを使います。通常「？km」の任意出発ルート距離取得は切替にかかわらず無効のままで、保存済みの過去の距離は書き換えません。固定距離のローカルRoutesは既存dev/localApiで引き続き遮断されます。

## データと残課題

Geofabrik関東2026-10-11版から現行条件に合わせた採用候補56,701件。対象施設の一般公開・営業中・実入口を全件現地確認したものではありません。店舗・寺院内のGPSを実機で確認する必要があります。

データはJSON約9.54MB＋地域形状約0.80MB（gzip換算約1.84MB＋0.21MB）。初回読み込みのスマホ性能、地域分割、Worker化、更新方式は次工程。開発サーバーの転送量はgzip換算値より大きい場合があります。

© OpenStreetMap contributors。ODbL 1.0、https://www.openstreetmap.org/copyright 。一般施設の帰属表示と既存の写真素材表記を維持しています。
