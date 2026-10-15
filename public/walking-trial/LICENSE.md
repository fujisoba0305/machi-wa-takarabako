# OSM徒歩検索・試験版のデータ

© OpenStreetMap contributors. このディレクトリのOSM由来データベースは ODbL 1.0 に従い提供します。
帰属・ライセンス：https://www.openstreetmap.org/copyright
ODbL：https://opendatacommons.org/licenses/odbl/1-0/
配布元：Geofabrik 関東OSM PBF（2026-10-11版）。https://download.geofabrik.de/asia/japan/kanto.html

対象は今井南町の公開町代表点を中心とする半径12kmの既存検証範囲です。全国・東京神奈川全域をカバーしません。
徒歩禁止、私有地、工事、未評価の条件付き通行は除外/保留し、道路長と元OSM点の接続を保持しています。
施設・街区・接続根拠は地図情報であり、現地の安全・営業・入口までの到達を保証しません。

加工済みデータベースの取得方法：同ディレクトリの regions.json が版・SHA-256・URLを示します。
各 /data/... の公開データは /walking-trial/data/....gz にgzipで収録しています（879ファイル）。
道路区画一覧の各タイル、connectionEvidence.tiles、施設、街区、通行制限データも同じ規則です。
.gz を通常のgzipツールで解凍すると、manifestに記載した同一SHA-256の元データに復元できます。
原道路のpackedバイナリの解釈は packed-core.mjs、可逆通信形式の復元は road-transport.mjs、道路分割の復元は partition-road.mjs にあります。
これらの公開OSMデータにはログイン情報、ユーザーのGPS記録、ユーザー投稿写真、秘密鍵を含みません。

試験機能の利用権限と、公開OSMデータの取得は別です。OSMデータそのものは公開しており、本人専用の秘密情報として扱いません。
