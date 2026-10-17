import {getAccountClient} from './accountAuth';
import {compressTreasurePhoto} from '../features/photoCompression';
import {registrationCategories} from '../features/treasureCategories';
import type {TreasureInsert} from './treasures';
export type TreasureEdit = TreasureInsert & {version:number};
export type ManagementContext={ownedIds:number[];available:boolean;message:string};
export interface TreasureManagement {
 context():Promise<ManagementContext>;
 load(id:number):Promise<TreasureEdit>;
 save(id:number,value:TreasureEdit,files:(File|null)[]):Promise<void>;
 remove(id:number,version:number):Promise<void>;
 subscribe?(reset:()=>void):()=>void;
}
export const managementEnabled=()=>import.meta.env.VITE_TREASURE_MANAGEMENT_ENABLED==='true';
function message(){return Error('変更を確認できませんでした。入力は保持しています。再送前に図鑑を読み直してください。');}
async function account(){if(!managementEnabled())throw Error('編集・削除はDBの権限整備後に利用できます。');const client=getAccountClient();const {data,error}=await client.auth.getUser();if(error||!data.user||data.user.is_anonymous)throw Error('Googleログインを確認してください。');return {client,uid:data.user.id};}
export function validateTreasureEdit(v:TreasureEdit){if(!v.name.trim()||v.name.trim().length>60||v.comment.length>160||!registrationCategories.includes(v.category)||!Number.isFinite(v.latitude)||Math.abs(v.latitude)>90||!Number.isFinite(v.longitude)||Math.abs(v.longitude)>180||!Number.isInteger(v.version)||v.version<0)throw Error('名前・説明・カテゴリー・座標を確認してください。');if(v.additional_image_url&&!v.image_url)throw Error('追加画像には代表画像が必要です。');}
export const treasureManagement:TreasureManagement={
 async context(){if(!managementEnabled())return {ownedIds:[],available:false,message:'編集・削除はDBの権限整備後に利用できます。所有者不明の宝物は変更できません。'};try{const {client}=await account();const {data,error}=await client.rpc('my_treasure_ids');if(error)throw error;return {ownedIds:(data??[]).map((r:{treasure_id:number})=>r.treasure_id),available:true,message:''};}catch{return {ownedIds:[],available:false,message:'登録者の権限を確認できませんでした。変更せず再読み込みしてください。'};}},
 async load(id){const {client}=await account();const {data,error}=await client.rpc('get_my_treasure',{p_id:id});if(error||!data)throw message();return data as TreasureEdit;},
 async save(id,value,files){validateTreasureEdit(value);const {client,uid}=await account();const next={...value};for(let i=0;i<2;i++){const file=files[i];if(!file)continue;const prepared=await compressTreasurePhoto(file);const path=uid+'/'+crypto.randomUUID()+'.jpg';const {error}=await client.storage.from('treasure-images').upload(path,prepared.file,{upsert:false,contentType:'image/jpeg'});if(error)throw message();const {data}=client.storage.from('treasure-images').getPublicUrl(path);if(i===0)next.image_url=data.publicUrl;else next.additional_image_url=data.publicUrl;}
 // Supabase Auth applies the current JWT. Server checks UID, version and allowed image paths again.
 validateTreasureEdit(next);const checked=await account();if(checked.uid!==uid)throw Error('アカウントが切り替わったため保存を中止しました。');
 const {error}=await client.rpc('edit_my_treasure',{p_id:id,p_version:value.version,p_value:{name:next.name.trim(),comment:next.comment,category:next.category,latitude:next.latitude,longitude:next.longitude,image_url:next.image_url,additional_image_url:next.additional_image_url??null}});if(error)throw message();
 },
 async remove(id,version){const {client}=await account();const {error}=await client.rpc('withdraw_my_treasure',{p_id:id,p_version:version});if(error)throw message();},
 subscribe(reset){try{let previous:string|null|undefined;const {data}=getAccountClient().auth.onAuthStateChange((_event,session)=>{const next=session?.user&&!session.user.is_anonymous?session.user.id:null;if(previous!==undefined&&previous!==next)reset();previous=next;});return ()=>data.subscription.unsubscribe();}catch{return ()=>{};}}
};
/** Activated only after approved DB migration. Owner UID is assigned by server, never supplied by caller. */
export async function createManagedTreasure(value:TreasureInsert){const {client}=await account();const {error}=await client.rpc('create_my_treasure',{p_value:value});if(error)throw message();}
