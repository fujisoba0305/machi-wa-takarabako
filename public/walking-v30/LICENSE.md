# 東京・神奈川の徒歩検索試験データ（第30工程）

© OpenStreetMap contributors — ODbL 1.0

- 帰属・利用条件: https://www.openstreetmap.org/copyright
- ライセンス: https://opendatacommons.org/licenses/odbl/1-0/
- 取得元: Geofabrik 関東OSM PBF https://download.geofabrik.de/asia/japan/kanto.html
- 元のスナップショット: 2026-10-11。更新・現地の状況との一致は保証しません。

この加工データベースはODbLに従い公開します。`manifest.json` の `base` にある `roads/index.json.gz` と `profiles/index.json.gz` を取得しgzip解凍すると、全公開区画・施設条件・接続根拠のURL・サイズ・SHA-256が得られます。各区画もgzipです。施設の数値形式は `runtime/facility-codec.mjs`、道路形式は `runtime/codec.mjs` で解釈できます。道路・施設IDと距離は保持し、ノードの高さを無視した結合はしていません。OSM由来の加工データベースの再利用時もODbLの条件に従ってください。

対象施設は56,701件。条件別プロフィールには同じ施設を含む場合があるため、プロフィールの件数合計を施設総数とは扱いません。東京・神奈川向けですが、道路不足地域は検索不可として停止します。道路・街区の推定は施設への入場・到達、営業や安全の保証ではありません。

ログイン情報・ユーザーの現在地・投稿写真・秘密鍵はデータに含みません。本人限定なのは本体の試験機能の利用権限であり、OSMデータや計算コードは公開です。
