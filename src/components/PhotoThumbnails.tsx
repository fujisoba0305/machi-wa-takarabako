import {useEffect,useState} from 'react';
export function PhotoThumbnails({photos}:{photos:{url:string;label:string}[]}){
 const [selected,setSelected]=useState<string|null>(null);
 useEffect(()=>{if(!selected)return;const overflow=document.body.style.overflow;const before=document.activeElement as HTMLElement|null;document.body.style.overflow='hidden';return()=>{document.body.style.overflow=overflow;before?.focus();};},[selected]);
 return <><div className="photo-thumbnails">{photos.map(p=><button key={p.url} type="button" aria-label={p.label+'を拡大'} onClick={()=>setSelected(p.url)}><img src={p.url} alt={p.label}/><span>{p.label}</span></button>)}</div>{selected&&<div className="photo-lightbox" role="dialog" aria-modal="true" aria-label="写真の拡大確認" onKeyDown={e=>{if(e.key==='Escape')setSelected(null);if(e.key==='Tab'){e.preventDefault();e.currentTarget.querySelector<HTMLButtonElement>('button')?.focus();}}}><button autoFocus type="button" onClick={()=>setSelected(null)}>閉じる</button><img src={selected} alt="拡大した宝物の写真"/></div>}</>;
}
