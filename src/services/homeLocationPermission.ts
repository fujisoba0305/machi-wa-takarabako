export type HomePermission='granted'|'prompt'|'denied'|'unavailable';
/** Query only. Never prompts for GPS, polls, or changes browser permissions. */
export async function readHomeLocationPermission(permissions?:Pick<Permissions,'query'>):Promise<HomePermission>{
 if(!permissions?.query)return 'unavailable';
 let timer:ReturnType<typeof setTimeout>|undefined;
 try{const result=await Promise.race([permissions.query({name:'geolocation'}),new Promise<null>(resolve=>{timer=setTimeout(()=>resolve(null),1500);})]);return result&&['granted','prompt','denied'].includes(result.state)?result.state:'unavailable';}catch{return 'unavailable';}finally{clearTimeout(timer);}
}
