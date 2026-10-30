import {useEffect,useRef,useState} from 'react';
import {loadMyPosts,type OwnPost,type OwnPostPage} from '../services/myPosts';
import {PhotoThumbnails} from './PhotoThumbnails';
export function MyPosts({uid,initiallyOpen=false,load=loadMyPosts}:{uid:string;initiallyOpen?:boolean;load?:typeof loadMyPosts}){
 const [open,setOpen]=useState(initiallyOpen);
 return <section className="my-page-card" aria-label="自分が投稿した宝物"><h2>自分が投稿した宝物</h2><p>あなたが現地で投稿した宝物です。GPS到着で集める宝物図鑑とは別で、投稿だけではEXPやたからんの発見数は増えません。</p><button type="button" aria-expanded={open} onClick={()=>setOpen(v=>!v)}>{open?'自分の投稿を閉じる':'自分の投稿を見る'}</button>{open&&<OwnPostList key={uid} uid={uid} load={load}/>}</section>;
}
function OwnPostList({uid,load}:{uid:string;load:typeof loadMyPosts}){
 const [page,setPage]=useState<OwnPostPage>({items:[],next:null}),[busy,setBusy]=useState(false),[error,setError]=useState('');const generation=useRef(0),request=useRef<AbortController|null>(null),pending=useRef(false);
 async function refresh(append=false){if(pending.current)return;pending.current=true;const n=++generation.current,controller=new AbortController();request.current=controller;setBusy(true);setError('');try{const next=await load(uid,append?page.next??undefined:undefined,controller.signal);if(n!==generation.current||controller.signal.aborted)return;setPage(old=>({items:append?[...new Map([...old.items,...next.items].map(t=>[t.id,t])).values()]:next.items,next:next.next}));}catch{if(n===generation.current&&!controller.signal.aborted)setError('投稿を読み込めませんでした。保存済みの宝物は変更していません。再試行してください。');}finally{if(n===generation.current){pending.current=false;setBusy(false);}}}
 useEffect(()=>{void refresh();return()=>{generation.current++;request.current?.abort();pending.current=false;};},[uid,load]);
 function date(post:OwnPost){return post.created_at&&Number.isFinite(Date.parse(post.created_at))?new Date(post.created_at).toLocaleString('ja-JP'):'投稿日時不明';}
 return <div className="my-posts"><button type="button" disabled={busy} onClick={()=>void refresh()}>投稿一覧を更新</button>{busy&&<p role="status">投稿を読み込み中…</p>}{error&&<p role="alert">{error}</p>}{!busy&&!error&&!page.items.length&&<p>本人の投稿記録と確認できる宝物はまだありません。所有者不明の旧投稿は推測で追加しません。</p>}{page.items.map(t=><article key={t.id}><h3>{t.name}</h3><p>{t.category}</p><p>投稿日時：{date(t)}</p>{t.comment&&<p>{t.comment}</p>}<PhotoThumbnails photos={[t.image_url&&{url:t.image_url,label:'代表画像'},t.additional_image_url&&{url:t.additional_image_url,label:'追加画像'}].filter((p):p is {url:string;label:string}=>Boolean(p))}/></article>)}{error&&<button type="button" disabled={busy} onClick={()=>void refresh()}>投稿の読み込みを再試行</button>}{page.next&&<button type="button" disabled={busy} onClick={()=>void refresh(true)}>さらに20件を見る</button>}<p>編集・公開取り下げは引き続き準備中です。</p></div>;
}
