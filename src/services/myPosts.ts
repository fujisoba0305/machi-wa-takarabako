import {getAccountClient} from './accountAuth';
export type OwnPost={id:number;name:string;comment:string;category:string;image_url:string|null;additional_image_url:string|null;created_at:string|null};
export type OwnPostPage={items:OwnPost[];next:string|null};
export async function loadMyPosts(uid:string,before?:string,signal?:AbortSignal):Promise<OwnPostPage>{
 const session=async()=>{const {data,error}=await getAccountClient().auth.getSession();const s=data.session;if(error||!s||s.user.id!==uid||s.user.is_anonymous||(s.expires_at&&s.expires_at*1000<=Date.now()))throw Error('Googleログインを確認してください。');return s.access_token;};
 const token=await session(),controller=new AbortController(),cancel=()=>controller.abort(),timeout=setTimeout(cancel,15000);signal?.addEventListener('abort',cancel,{once:true});if(signal?.aborted)cancel();
 try{const response=await fetch('/api/my-treasures'+(before?'?before='+encodeURIComponent(before):''),{headers:{Authorization:'Bearer '+token},signal:controller.signal,cache:'no-store'});if(!response.ok)throw Error('投稿を読み込めませんでした。再試行してください。');const page=await response.json();await session();if(controller.signal.aborted)throw Error('投稿の読み込みを中止しました。');if(!Array.isArray(page.items)||page.items.length>20||!(page.next===null||typeof page.next==='string'&&/^\d+$/.test(page.next))||page.items.some((t:OwnPost)=>!Number.isSafeInteger(t.id)||typeof t.name!=='string'||typeof t.category!=='string'))throw Error('投稿の応答を確認できませんでした。再試行してください。');return page;}
 finally{clearTimeout(timeout);signal?.removeEventListener('abort',cancel);}
}
