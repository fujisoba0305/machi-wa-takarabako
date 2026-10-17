import {LegacyHistoryNotice} from './LegacyHistoryNotice';
import {useEffect,useMemo,useState} from 'react';
import type {Treasure} from '../services/treasures';
import type {TreasureRatingSummaryMap} from '../features/treasureCollection';
import {buildTreasureCollection,countTreasureRanks,filterTreasureCollection} from '../features/treasureCollection';
import {collectionCategories,categoryMatchesFilter,categoryIcon} from '../features/treasureCategories';
import {treasurePhotoUrls} from '../features/treasurePhotos';
import {formatAdventureDiscoveryDate,type AdventureDiscovery} from '../features/adventureHistory';
import type {PersonalDiscovery} from '../features/personalDiscoveries';
import {IconText} from './AppIcon';
import type {TreasureRankKey} from '../features/treasureRank';
type Props={treasures:Treasure[];ratingSummaries:TreasureRatingSummaryMap;ratingSummariesAvailable:boolean;currentLocation:{latitude:number;longitude:number}|null;selectedMapTreasure:Treasure|null;onSelectMapTreasure:(t:Treasure)=>void;onStartAdventure:()=>void;onRegisterTreasure:()=>void;adventureHistory:AdventureDiscovery[];discoveries?:PersonalDiscovery[];discoveryMessage?:string};
export function TreasureCollection(props:Props){
 const [category,setCategory]=useState(''),[query,setQuery]=useState(''),[limit,setLimit]=useState(60),[rank,setRank]=useState<TreasureRankKey|'all'>('all'),[selected,setSelected]=useState<string|null>(null);
 const records=props.discoveries??[];
 const items=useMemo(()=>buildTreasureCollection(records.map(r=>r.treasure),props.ratingSummaries).map((item,index)=>({...item,discovery:records[index]})),[records,props.ratingSummaries]);
 const counts=countTreasureRanks(items);
 const visible=items.filter(i=>(!props.ratingSummariesAvailable||rank==='all'||i.rank.key===rank)&&categoryMatchesFilter(i.treasure.category,category)&&(!query||[i.treasure.name,i.treasure.comment].some(v=>v.toLocaleLowerCase().includes(query.toLocaleLowerCase()))));
 useEffect(()=>setLimit(60),[category,query,rank]);
 const detail=items.find(i=>i.discovery.key===selected);
 if(detail)return <section className="collection-detail"><button className="collection-back" type="button" onClick={()=>setSelected(null)}>← 図鑑へ戻る</button><p>冒険で発見した宝物</p><h2>{detail.treasure.name}</h2><p>発見日：{formatAdventureDiscoveryDate(detail.discovery.firstDiscoveredAt)}</p>{treasurePhotoUrls(detail.treasure).map((url,i)=><img key={url} src={url} alt={detail.treasure.name+(i?' 追加画像':' 代表画像')}/>)}<p><IconText text={detail.treasure.category}/></p><p>{detail.treasure.comment||'説明はありません。'}</p><p>発見時の場所：緯度 {detail.treasure.latitude} / 経度 {detail.treasure.longitude}</p><p>冒険で発見した時点の情報です。現在の営業・公開状況とは異なる場合があります。</p><a href={'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(detail.treasure.latitude+','+detail.treasure.longitude)} target="_blank" rel="noreferrer">Googleマップで場所を確認する</a></section>;
 return <div className="treasure-collection"><header className="collection-header"><p>MY DISCOVERIES</p><h2>自分の宝物図鑑</h2><span>冒険で到着を確認した宝物だけが並びます</span></header><section className="collection-summary" aria-label="自分が発見した宝物の集計"><div><span>発見した宝物</span><strong>{items.length}</strong></div><ul><li>🥉 {counts.bronze}</li><li>🥈 {counts.silver}</li><li>🥇 {counts.gold}</li><li>👑 {counts.legend}</li></ul><small>投稿しただけの宝物は追加されません。記録はこの端末・アカウント別です。</small></section>{props.discoveryMessage&&<p role="status">{props.discoveryMessage}</p>}
 <LegacyHistoryNotice discoveries={records}/><div className="collection-controls"><label>カテゴリーで絞り込む<select value={category} onChange={e=>setCategory(e.target.value)}><option value="">すべてのカテゴリー</option>{collectionCategories.map(c=><option key={c.value} value={c.value}>{c.label}</option>)}</select></label><label>名前・説明を検索<input type="search" value={query} onChange={e=>setQuery(e.target.value)}/></label></div><div className="collection-filters" aria-label="ランクで絞り込む">{(['all','bronze','silver','gold','legend'] as const).map(r=><button key={r} type="button" disabled={!props.ratingSummariesAvailable&&r!=='all'} onClick={()=>setRank(r)}>{({all:'すべて',bronze:'🥉',silver:'🥈',gold:'🥇',legend:'👑'})[r]}</button>)}</div>
 {visible.length?<><p>表示対象 {visible.length}件</p><div className="collection-grid">{visible.slice(0,limit).map(item=><article key={item.discovery.key} className="collection-card" onClick={e=>{if((e.target as Element).closest('button'))return;setSelected(item.discovery.key);}}>{item.treasure.image_url?<img loading="lazy" src={item.treasure.image_url} alt={item.treasure.name}/>:<span className="category-placeholder" aria-label={item.treasure.category}>{categoryIcon(item.treasure.category)}</span>}<div><p className="collection-discovered-badge">発見済み</p><h3>{item.treasure.name}</h3><button type="button" onClick={()=>setSelected(item.discovery.key)}>詳しく見る →</button></div></article>)}</div>{visible.length>limit&&<button type="button" onClick={()=>setLimit(n=>n+60)}>さらに60件表示する</button>}</>:<section className="collection-empty"><h3>{items.length?'条件に合う発見済みの宝物はありません':'まだこのアカウントの発見記録がありません'}</h3><p>ガチャで目的地へ歩き、GPS到着判定が成功すると追加されます。</p><button type="button" onClick={props.onStartAdventure}>宝物を探しに行く</button></section>}
 </div>;
}
