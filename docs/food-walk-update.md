# 食べ歩きデートの仕様変更と初回タイムアウト調査

2026-10-13。第11工程の未コミット修正を保持したまま、食べ歩きだけを変更。commit/push/デプロイ、DB/SQL/RLS変更なし。本番は2a924a20adbc37dc0cca2802353076d115a642abのまま。

## 新しい食べ歩き

1軒目はnodeのshop=bakery/pastry/confectionery/chocolate、またはamenity=ice_cream。amenity=cafeとの重複タグがあっても今回は1軒目から除外し、カフェ→カフェを出さない。店名、雰囲気、写真から料理ジャンルを推測しない。

2軒目はnode amenity=cafe。喫茶店を含む標準タグ。coffee販売店や飲食店のcuisine=coffee_shopだけでは喫茶店と認定しない。同一OSM ID/canonical、同名の2地点は組み合わせない。

分類は [OSM bakery](https://wiki.openstreetmap.org/wiki/Tag%3Ashop%3Dbakery)、[pastry](https://wiki.openstreetmap.org/wiki/Tag%3Ashop%3Dpastry)、[confectionery](https://wiki.openstreetmap.org/wiki/Tag%3Ashop%3Dconfectionery) のタグ定義に基づく。confectioneryはお菓子店であり、全件を和菓子店として扱わない。

## 既存静的データの件数

東京・神奈川の現行56,701要素をオフライン集計した。新しい施設データの追加取得はしていない。

|タグ|データ内node数|カフェを除いた1軒目候補|
|---|---:|---:|
|shop=bakery|1,277|1,264|
|shop=pastry|360|358|
|shop=confectionery|1,212|1,207|
|shop=chocolate|3|0|
|amenity=ice_cream|175|175|

1軒目のcanonical重複除去後は3,004施設。2軒目のnode amenity=cafeは6,142施設。和菓子等と明記したcuisineが一致する1軒目候補は3施設（wagashi/manju/和菓子の明示タグ）。これは実際の和菓子店総数ではない。cuisine未記録のお菓子店を名前から和菓子へ分類していない。営業中・商品価格・営業時間・実入口は別途確認が必要。

## 近さの扱い

徒歩5〜15分という意図に合わせて近接した2店を優先するが、道路ネットワークがないため徒歩分数は判定・表示しない。

- 2店間の**直線距離600m以内**の適合ペアを優先。
- なければ直線距離600m超〜1km以内の適合ペアを利用。
- 1km以内に組み合わせがなければ近接候補不足と表示し、遠いカフェや別ジャンルで埋めない。
- 600m/1kmは今回の実装上の近接基準であり、徒歩5〜15分を保証する数値ではない。川・鉄道・道路・建物の入口で実徒歩ルートは長くなる。
- 各帯の候補全体からreservoir samplingで抽選。大きな全ペア配列を作らず、先頭数件だけに偏らせない。処理中もキャンセル可能。

画面は「1軒目：買い物・スイーツ」「2軒目：カフェ・喫茶店」と表示する。「現在地→1軒目→2軒目の直線距離合計」「2店間の直線距離」を区別し、徒歩時間はGoogle Mapsで確認するよう案内。徒歩の架空分数は出さない。

検索半径と既存の距離選択は保持。固定距離の実徒歩距離保証は前工程と同様未対応。通常ガチャ・他4デートモード・GPS到着・EXP・登録宝物・Googleログインの処理は維持。対象地域外/明示offの食べ歩き用旧Overpassクエリも買い物系5タグへ合わせ、2軒目は既存カフェ検索を利用する。今回、公開Overpassや有料APIを実際に呼んでいない。

## 初回タイムアウトの調査

利用者情報：ローカルHTTPS版のiPhone Safari、初回は「デートコースの検索に時間がかかっています」、約1分の体感、2・3回目は成功。

確認できたこと：

1. 作業前の実ローカルHTTPSサーバーは施設JSONを200/Content-Length=9,542,729bytes/Content-Encodingなしで配信。地域形状込みで約10.34MBが初回転送される。
2. 第11工程の20秒期限には、初回の地域/施設取得、body読み込み、JSON解析、索引構築、候補選択が全て含まれる。
3. fake timersで施設body完了を23秒にすると初回20秒でDateSearchTimeout、読込完了後の同条件再試行はキャッシュだけで成功した。外部APIなしで再現。
4. 実機の段階別ログはないため、「約1分」全体を純粋なネットワーク転送と断定しない。Safariのタイマー/JS実行、古い配信コード、候補計算も今回の実機ログでは切り分け未完了。対象地域外や明示offならローカルでも旧Overpassを使うため、その遅延も実機ログなしには除外できない。前工程の本番Overpass約51秒のログを、今回のローカル初回の直接証拠として扱わない。

修正：開発サーバーの当該2つのハッシュ付き公開JSONだけをgzip配信するPluginを追加。元ファイルを変更せず、読み取り時にSHA-256を検証。GET/HEAD、Accept-Encodingの選択に対応し、API・秘密鍵・任意ファイルは対象外。buildには適用せず、Vercelの既存Brotli配信を維持。TLS証明書検証を無効化していない。

実サーバーでgzipとX-Machi-Static-Transport=local-gzip、200応答を確認：

- 施設JSON：9,542,729→1,842,752bytes。
- 地域形状：797,601→208,936bytes。
- 合計：10,340,330→2,051,688bytes（約80%削減）。

これにより初回転送量を軽減したが、実機で初回タイムアウトが解消したかは再確認待ち。20秒制限は変更していない。[facility-data]へheaderMs/bodyAndParseMs/indexed時間と読込状態を追加し、タイムアウト時の[date-search]にはstaticLoad段階を出す。bodyAndParseMsは転送と解析を合わせた時間であり、純粋な通信時間ではない。診断には名前・座標・トークン・写真・URLを出さない。

## 再確認手順

既存のローカルHTTPSサーバーでgzip配信を確認済み。iPhone Safariのページを更新し、デート→食べ歩き→？kmで試す。1軒目が買い物店、2軒目がカフェ、直線距離表示とMapsの順番を確認。同条件を2・3回続けて初回との差を記録する。既存のWebサイトデータを削除しない。

再発した場合は画面の「確認用情報」（施設/地域の読込状態と待機秒数）を記録・共有する。座標やログイン情報は表示しない。確認可能なら[date-search]のstaticLoadと[facility-data]の段階・所要時間も使える。PC側のHTTPS証明書の警告を無視しない。ログがない状態で、実機の根本原因を断定しない。

## 変更と検証

- src/features/foodWalk.ts・foodWalk.test.ts：役割の分類、近接優先、抽選・重複・不足。
- src/App.tsx：新しい2プールの取得、画面ラベル、距離表記、不足理由、段階診断。
- src/services/staticFacilities.ts・overpass.ts：食べ歩きのタグと読込診断。
- dev/staticCompression.ts・staticCompression.test.ts、vite.config.ts：ローカル圧縮。
- src/DateSearchFlow.test.tsx・src/services/staticDateSpots.test.ts：新仕様に合わせた前工程テスト更新。
- src/services/dateColdLoad.test.ts：冷読込タイムアウトとキャッシュ後成功の再現。
- docs/food-walk-update.md：この報告。

全329テスト成功。TypeScript、API型チェック、build、git diff --checkを確認。gzip解凍後のSHA-256一致、HEADの空body、gzip;q=0、API/秘密パスの除外を検証。通常ガチャ・他デートモード・認証・GPS・EXP・評価・冒険復帰の回帰テストも成功。既知のbuildサイズ警告は残る。

前工程の未コミット変更と施設JSONは保護。生成tsconfig.tsbuildinfoは作業前へ戻す。元から利用者が起動していた開発サーバーを維持し、本番は変更しない。
