import {useState} from 'react';
import {MyPosts} from './MyPosts';
import {TreasureCollection} from './TreasureCollection';
import {readPersonalDiscoveries} from '../features/personalDiscoveries';
import type {loadMyPosts} from '../services/myPosts';
import './MyTreasureBook.css';

export function MyTreasureBook({uid,onExplore,loadPosts}:{uid:string;onExplore:()=>void;loadPosts?:typeof loadMyPosts}){
 const [tab,setTab]=useState<'posts'|'adventures'>('posts');
 const book=readPersonalDiscoveries(localStorage,uid);
 return <section className="my-treasure-book" aria-label="宝物図鑑"><header><p>MY TREASURE CARDS</p><h2>宝物図鑑</h2><p>あなたの発見を、ひとつずつコレクション。</p></header><div role="tablist" aria-label="宝物の見つけ方"><button type="button" id="posted-book-tab" role="tab" aria-selected={tab==='posts'} aria-controls="posted-book-panel" tabIndex={tab==='posts'?0:-1} onKeyDown={e=>{if(e.key==='ArrowRight'||e.key==='ArrowLeft'){setTab('adventures');document.getElementById('adventure-book-tab')?.focus();}}} onClick={()=>setTab('posts')}>📸 自分で発見した宝物</button><button type="button" id="adventure-book-tab" role="tab" aria-selected={tab==='adventures'} aria-controls="adventure-book-panel" tabIndex={tab==='adventures'?0:-1} onKeyDown={e=>{if(e.key==='ArrowRight'||e.key==='ArrowLeft'){setTab('posts');document.getElementById('posted-book-tab')?.focus();}}} onClick={()=>setTab('adventures')}>🧭 冒険で発見した宝物</button></div><div id="posted-book-panel" role="tabpanel" aria-labelledby="posted-book-tab" hidden={tab!=='posts'}><p className="book-tab-note">現地で投稿した、あなたの宝物カード。冒険の発見図鑑とは別に並びます。</p><MyPosts key={uid} uid={uid} initiallyOpen cards load={loadPosts}/></div>{tab==='adventures'&&<div id="adventure-book-panel" role="tabpanel" aria-labelledby="adventure-book-tab"><TreasureCollection treasures={[]} ratingSummaries={{}} ratingSummariesAvailable={false} currentLocation={null} selectedMapTreasure={null} onSelectMapTreasure={()=>{}} onStartAdventure={onExplore} onRegisterTreasure={onExplore} adventureHistory={[]} discoveries={book.records} discoveryMessage={book.message}/></div>}</section>;
}
