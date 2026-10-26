vi.mock('./accountAuth',()=>({getAccountClient:()=>({auth:{getUser:async()=>({data:{user:{id:'own'}},error:null})},storage:{from:()=>({upload:mocks.upload,getPublicUrl:mocks.getPublicUrl,remove:mocks.remove})}})}));
vi.mock('./onsitePosting',()=>({saveOnsiteTreasure:vi.fn()}));
import {saveOnsiteTreasure} from './onsitePosting';
vi.mock('../features/photoCompression',()=>({compressTreasurePhoto:vi.fn(async(file:File)=>({file,originalBytes:file.size,compressedBytes:file.size,width:100,height:100,quality:.86,targetMet:true}))}));
import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ upload: vi.fn(), getPublicUrl: vi.fn(), remove: vi.fn(), insert: vi.fn() }));
vi.mock('./supabase', () => ({ getSupabaseClient: () => ({
  storage: { from: () => ({ upload: mocks.upload, getPublicUrl: mocks.getPublicUrl, remove: mocks.remove }) },
  from: () => ({ insert: mocks.insert }),
}) }));
import { createTreasure } from './treasures';
import { uploadTreasureImage } from './treasureImages';
beforeEach(() => { vi.resetAllMocks(); mocks.upload.mockResolvedValue({ error: null }); mocks.getPublicUrl.mockReturnValue({ data: { publicUrl: 'https://example.com/photo' } }); });
describe('treasure save stages with mocked Supabase', () => {
  it.each(['春日局乃像', '大黒天'])('does not reject the name %s', async name => {
    mocks.insert.mockResolvedValue({ error: null, status: 201 });
    const row = { name, comment: '', category: '📷 写真スポット', latitude: 35, longitude: 139, image_url: null };
    const context={uid:'own',mode:'daily' as const,requestId:'request',fix:{latitude:35,longitude:139,accuracy:5,timestamp:Date.now()}};
    await expect(createTreasure(row,context)).resolves.toBeUndefined();
    expect(saveOnsiteTreasure).toHaveBeenCalledWith(row,context);expect(mocks.insert).not.toHaveBeenCalled();
  });
  it('distinguishes Storage rejection from database failure', async () => {
    mocks.upload.mockResolvedValue({ error: { statusCode: '413', message: 'private photo' } });
    await expect(uploadTreasureImage({ name: 'test.heic', type: 'image/heic', size: 7000000 } as File)).rejects.toMatchObject({ diagnostic: { stage: 'image_upload', httpStatus: 413 } });
    expect(mocks.getPublicUrl).not.toHaveBeenCalled(); expect(mocks.insert).not.toHaveBeenCalled();
  });
  it('identifies a public URL failure after uploading', async () => {
    mocks.getPublicUrl.mockReturnValue({ data: {} });
    await expect(uploadTreasureImage({ name: 'test.jpg', type: 'image/jpeg', size: 10 } as File)).rejects.toMatchObject({ diagnostic: { stage: 'image_url' } });
  });
  it('refuses a legacy direct insert without a GPS context',async()=>{await expect(createTreasure({name:'像',comment:'',category:'📷 写真スポット',latitude:35,longitude:139,image_url:null})).rejects.toThrow('GPS確認');expect(mocks.insert).not.toHaveBeenCalled();});
});

it('cleans only a successfully uploaded own photo if URL preparation fails',async()=>{mocks.getPublicUrl.mockReturnValue({data:{}});mocks.remove.mockResolvedValue({error:null});await expect(uploadTreasureImage({name:'a.jpg',type:'image/jpeg',size:10} as File,'own')).rejects.toMatchObject({diagnostic:{stage:'image_url'}});expect(mocks.remove).toHaveBeenCalledWith([expect.stringMatching(/^own\//)]);expect(mocks.insert).not.toHaveBeenCalled();});
