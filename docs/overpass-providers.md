# 無料Overpass接続先の確認（2026-10-12 JST）

## 第1候補: VK Maps公開Overpass
正式エンドポイント: https://maps.mail.ru/osm/tools/overpass/api/interpreter
公開フロントエンド: https://maps.mail.ru/osm/tools/overpass/
運営サービス: VK Maps（VK、ロシア）。公式一般サービス規約では運営会社はООО «ВК»。

OSMプロジェクトの公開Overpass一覧に、全世界対応、任意のプロジェクトで利用可能、現時点では要求制限なしと掲載されている。登録・APIキー・課金設定なしで使う公開Overpassである。「任意のプロジェクト」という公開方針に商用除外は示されていないため、この公開Overpassを接続先候補として採用する。ただし、商用利用を個別保証する契約やSLAを取得したものではない。通常のVK Maps API契約・SDKとこの公開Overpassを混同しない。運営元サイトにOverpass専用の独立した契約文書は確認できなかった。利用規模や用途の変更時は最新方針を再確認する。

要求制限がないという案内を無制限の利用許可や可用性保証として扱わない。今回の実装は小規模な近隣検索、キャッシュ、同時通信制限、識別用User-Agentを維持し、利用制限やアクセス拒否が返れば停止する。OSMデータにはODbLが適用され、OpenStreetMap contributorsの帰属表示が必要。

出典:
- https://wiki.openstreetmap.org/wiki/Overpass_API#Instances_with_global_data_coverage （公開Overpassに特化した利用方針・カバレッジ）
- https://maps.mail.ru/osm/tools/overpass/ （運営ドメインの公開ツール）
- https://help.mail.ru/legal/terms/maps/terms/ （運営会社・一般VK Mapsサービス規約。公開Overpassの個別料金規約ではない）
- https://www.openstreetmap.org/copyright

## 第2候補: Private.coffee
正式エンドポイント: https://overpass.private.coffee/api/interpreter
運営元: オーストリアの非営利団体Private.coffee。
運営元の明示的な条件: 無料、登録不要、商用を含む利用可能、固定レート制限なし。ただし同時要求を抑え、クエリを最適化し、OSMのライセンス・帰属表示を守る。大規模運用は事前通知を求めている。可用性保証なし。
https://overpass.private.coffee/

旧overpass.kumi.systemsは使わず現行ドメインを使用。前回の比較では500だったので第2候補としてのみ利用する。

## 既存接続先と制限の扱い
overpass-api.deは前回504が続き、公開方針も恒常的アプリや商用利用に厳しいため今回の自動接続先から外す。スイス限定overpass.osm.chは日本の検索に使用しない。

- 1検索につき最大2接続先、各1回。同時に複数サーバーへ投げない。
- 第2候補へ進む前に1秒待機。
- 429/403/406は接続先を替えて回避しない。最低30秒、Retry-Afterが長ければその期間、ブラウザとこのサーバーインスタンスで停止する。キャッシュ内の有効候補は通信なしで利用可能。
- その他の4xxも条件を変えて再試行せず失敗として扱う。
- 各接続25秒・ブラウザ55秒。Overpassクエリの実行時間12秒は維持。
- サーバーインスタンス内で同時2検索まで。超過時503・Retry-Afterで戻し、無制限の待機列を作らない。
- ブラウザは同一クエリ共有、同時2件・待機4件、候補5分・正常0件30秒のキャッシュを維持。障害を空結果キャッシュにしない。
- 分散した複数のVercelインスタンス全体を横断するレート制限ではない。利用増加時は運営元の方針を確認して構成を再検討する。

## 診断
APIはprovider ID、試行番号、HTTP状態、所要時間、クエリ形状、候補件数だけをconsoleに出す。応答ヘッダーX-Machi-Overpass-Providerで成功した接続先を確認できる。クエリ本文・座標・施設名・ユーザー情報・応答本文は診断に出さない。ブラウザはoverpass-clientとnormal-search succeededのsource・候補数で取得から抽選まで確認できる。診断の外部送信・永続保存はしない。
