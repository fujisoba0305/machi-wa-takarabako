import { useMemo, useState } from 'react';
import type { Treasure } from '../services/treasures';
import type { TreasureRatingSummaryMap } from '../features/treasureCollection';
import {
buildTreasureCollection,
countTreasureRanks,
filterTreasureCollection,
getNextTreasureRankProgress,
} from '../features/treasureCollection';
import { getTreasureRatingStars, type TreasureRankKey } from '../features/treasureRank';
import { buildGoogleMapsDirectionsUrl } from '../features/googleMaps';
import { TreasureMap } from './TreasureMap';
import {
formatAdventureDiscoveryDate,
joinAdventureHistory,
type AdventureDiscovery,
} from '../features/adventureHistory';

type Props = {
treasures: Treasure[];
ratingSummaries: TreasureRatingSummaryMap;
ratingSummariesAvailable: boolean;
currentLocation: { latitude: number; longitude: number } | null;
selectedMapTreasure: Treasure | null;
onSelectMapTreasure: (treasure: Treasure) => void;
onStartAdventure: () => void;
onRegisterTreasure: () => void;
adventureHistory: AdventureDiscovery[];
};

const filters: Array<{ key: TreasureRankKey | 'all'; label: string }> = [
{ key: 'all', label: 'すべて' }, { key: 'bronze', label: '🥉' },
{ key: 'silver', label: '🥈' }, { key: 'gold', label: '🥇' },
{ key: 'legend', label: '👑' },
];

export function TreasureCollection(props: Props) {
const [tab, setTab] = useState<'adventure' | 'community'>('community');
const [filter, setFilter] = useState<TreasureRankKey | 'all'>('all');
const [detailSelection, setDetailSelection] = useState<{
id: number;
fromAdventure: boolean;
} | null>(null);
const [showMap, setShowMap] = useState(false);
const items = useMemo(
() => buildTreasureCollection(props.treasures, props.ratingSummaries),
[props.treasures, props.ratingSummaries]
);
const counts = countTreasureRanks(items);
const visibleItems = props.ratingSummariesAvailable
? filterTreasureCollection(items, filter)
: items;
const detail = items.find((item) => item.treasure.id === detailSelection?.id) ?? null;
const adventureItems = joinAdventureHistory(props.adventureHistory, items);
const detailDiscovery = detailSelection?.fromAdventure
? props.adventureHistory.find((item) => item.treasureId === detailSelection.id)
: undefined;
const nextRank = detail
? getNextTreasureRankProgress(detail.treasure.discovery_count ?? 0, detail.summary)
: null;

if (detail) {
return (
<section className={`collection-detail collection-rank--${detail.rank.key}`}>
<button className="collection-back" type="button" onClick={() => setDetailSelection(null)}>← 図鑑へ戻る</button>
{detail.treasure.image_url && <img src={detail.treasure.image_url} alt={detail.treasure.name} />}
<p className="collection-rank-label">{props.ratingSummariesAvailable ? detail.rank.label : 'RANK 集計待ち'}</p>
<h2>{detail.treasure.name}</h2>
<p className="collection-category">{detail.treasure.category}</p>
<p className="collection-comment">{detail.treasure.comment || 'コメントはありません。'}</p>
{detailDiscovery && formatAdventureDiscoveryDate(detailDiscovery.firstDiscoveredAt) && (
<section className="collection-discovery-plaque" aria-label="あなたが発見した日">
<p>YOUR DISCOVERY</p>
<strong>✨ {formatAdventureDiscoveryDate(detailDiscovery.firstDiscoveredAt)}に発見</strong>
<span>この宝物との冒険は、ここから始まりました</span>
</section>
)}
<div className="collection-detail-stats">
{props.ratingSummariesAvailable ? <>
<p><span aria-hidden="true">{getTreasureRatingStars(detail.summary)}</span> {detail.summary.ratingCount ? detail.summary.averageRating.toFixed(1) : 'まだ評価はありません'}</p>
<p>{detail.summary.ratingCount}件の評価</p>
</> : <p>評価情報を取得できませんでした</p>}
<p>👣 発見回数 {detail.treasure.discovery_count ?? 0}回</p>
</div>
{props.ratingSummariesAvailable && <p className="collection-rank-description">{detail.rank.description}</p>}
{props.ratingSummariesAvailable && (nextRank ? (
<section className="collection-next-rank">
<h3>{nextRank.rank.shortLabel}まで</h3>
<p>👣 あと{nextRank.discoveriesRemaining}回発見</p>
<p>⭐ あと{nextRank.ratingsRemaining}件の評価</p>
<p>平均評価{nextRank.requiredAverage.toFixed(1)}以上</p>
</section>
) : (
<section className="collection-next-rank collection-next-rank--legend">
<h3>👑 LEGEND TREASURE</h3><p>最高ランクの宝物です</p>
</section>
))}
{props.currentLocation && (
<button className="collection-map-button" type="button" onClick={() => window.open(
buildGoogleMapsDirectionsUrl(props.currentLocation!, detail.treasure), '_blank'
)}>📍 この宝物の場所を見る</button>
)}
</section>
);
}

return (
<div className="treasure-collection">
<header className="collection-header">
<p>📖 TREASURE COLLECTION</p><h2>街の宝物図鑑</h2>
<span>あなたが街で見つけていく宝物たち</span>
</header>
<section className="collection-summary" aria-label="みんなの宝物の集計">
<div><span>この街に登録された宝物</span><strong>{items.length}</strong></div>
<ul>
<li>🥉 BRONZE <strong>{props.ratingSummariesAvailable ? counts.bronze : '—'}</strong></li><li>🥈 SILVER <strong>{props.ratingSummariesAvailable ? counts.silver : '—'}</strong></li>
<li>🥇 GOLD <strong>{props.ratingSummariesAvailable ? counts.gold : '—'}</strong></li><li>👑 LEGEND <strong>{props.ratingSummariesAvailable ? counts.legend : '—'}</strong></li>
</ul>
<small>※本人の発見数ではなく、現在公開されている宝物の集計です。</small>
</section>
<div className="collection-tabs" role="tablist">
<button type="button" className={tab === 'adventure' ? 'selected' : ''} onClick={() => setTab('adventure')}>🧭 冒険の記録</button>
<button type="button" className={tab === 'community' ? 'selected' : ''} onClick={() => setTab('community')}>💎 みんなの宝物</button>
</div>
{tab === 'adventure' ? (
<>
<section className="adventure-collection-summary">
<p>🧭 MY ADVENTURE COLLECTION</p><div><span>発見した宝物</span><strong>{adventureItems.length}</strong></div>
<small>街を歩いて見つけた、あなただけの冒険記録</small>
</section>
{adventureItems.length ? (
<div className="collection-grid">
{adventureItems.map((item) => (
<article key={item.treasureId} className={`collection-card adventure-collection-card collection-rank--${item.rank.key} ${item.treasure.image_url ? 'has-image' : ''}`}>
{item.treasure.image_url && <img src={item.treasure.image_url} alt={item.treasure.name} />}
<div><p className="collection-discovered-badge">✨ 発見済み</p>
<p className="collection-rank-label">{props.ratingSummariesAvailable ? item.rank.label : 'RANK 集計待ち'}</p>
<h3>{item.treasure.name}</h3><p className="collection-category">{item.treasure.category}</p>
<p className="collection-card-stats">⭐ {props.ratingSummariesAvailable ? (item.summary.ratingCount ? `${item.summary.averageRating.toFixed(1)}（${item.summary.ratingCount}件）` : '未評価') : '集計待ち'} <span>👣 {item.treasure.discovery_count ?? 0}回</span></p>
{formatAdventureDiscoveryDate(item.firstDiscoveredAt) && (
<div className="collection-discovered-date"><span>✨ あなたが発見した日</span><strong>📅 {formatAdventureDiscoveryDate(item.firstDiscoveredAt)}</strong></div>
)}
<button type="button" onClick={() => setDetailSelection({ id: item.treasureId, fromAdventure: true })}>詳しく見る →</button></div>
</article>
))}
</div>
) : (
<section className="collection-empty">
<span aria-hidden="true">🧭</span><h3>まだ冒険の記録がありません</h3>
<p>ガチャを回して、街に隠れた宝物を探しに行こう！</p>
<button type="button" onClick={props.onStartAdventure}>宝物を探しに行く</button>
</section>
)}</>
) : (
<>
{!props.ratingSummariesAvailable && (
<p className="collection-data-notice" role="status">評価・ランク集計を準備できませんでした。宝物一覧は引き続き利用できます。</p>
)}
<div className="collection-view-actions">
<div className="collection-filters" aria-label="ランクで絞り込む">
{filters.map((item) => <button key={item.key} type="button" disabled={!props.ratingSummariesAvailable && item.key !== 'all'} className={filter === item.key ? 'selected' : ''} onClick={() => setFilter(item.key)} aria-label={`${item.label}ランクを表示`}>{item.label}</button>)}
</div>
<button className="collection-map-toggle" type="button" onClick={() => setShowMap((value) => !value)}>{showMap ? 'カードを見る' : '🗺️ 地図で見る'}</button>
</div>
{showMap ? (
<TreasureMap treasures={props.treasures} selectedTreasure={props.selectedMapTreasure} onSelectTreasure={props.onSelectMapTreasure} currentLocation={props.currentLocation} />
) : visibleItems.length ? (
<div className="collection-grid">
{visibleItems.map((item, index) => (
<article key={item.treasure.id ?? `${item.treasure.latitude}-${index}`} className={`collection-card collection-rank--${item.rank.key} ${item.treasure.image_url ? 'has-image' : ''}`}>
{item.treasure.image_url && <img src={item.treasure.image_url} alt={item.treasure.name} />}
<div><p className="collection-rank-label">{props.ratingSummariesAvailable ? item.rank.shortLabel : 'RANK 集計待ち'}</p><h3>{item.treasure.name}</h3>
{!item.treasure.image_url && <p className="collection-comment">{item.treasure.comment || 'コメントはありません。'}</p>}
<p className="collection-card-stats">⭐ {props.ratingSummariesAvailable ? (item.summary.ratingCount ? item.summary.averageRating.toFixed(1) : '未評価') : '集計待ち'} <span>👣 {item.treasure.discovery_count ?? 0}回</span></p>
<button type="button" onClick={() => item.treasure.id !== undefined && setDetailSelection({ id: item.treasure.id, fromAdventure: false })}>詳しく見る →</button></div>
</article>
))}
</div>
) : props.treasures.length ? (
<section className="collection-empty"><span>🔎</span><h3>このランクの宝物はまだありません</h3><p>別のランクを選んでみてください。</p></section>
) : (
<section className="collection-empty"><span>💎</span><h3>まだ宝物がありません</h3><p>この街の最初の宝物を見つけてみませんか？</p><button type="button" onClick={props.onRegisterTreasure}>宝物を登録する</button></section>
)}
</>
)}
</div>
);
}
