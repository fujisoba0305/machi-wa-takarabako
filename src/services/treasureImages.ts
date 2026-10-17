import {managementEnabled} from './treasureManagement';
import {getAccountClient} from './accountAuth';
import {compressTreasurePhoto,type PreparedPhoto} from '../features/photoCompression';
import { getSupabaseClient } from './supabase';
import { imageDiagnostic, saveDiagnostic, TreasureSaveError, type TreasureSaveStage } from '../features/treasureSaveDiagnostics';

const TREASURE_IMAGE_BUCKET = 'treasure-images';

export type UploadedTreasureImage = {
path: string;
publicUrl: string;
photo?: Omit<PreparedPhoto,'file'>;
preparedFile?:File;
};

function getFileExtension(file: File) {
const extension = file.name.split('.').pop()?.toLowerCase();

if (extension && /^[a-z0-9]+$/.test(extension)) {
return extension;
}

const mimeExtension = file.type.split('/')[1]?.split('+')[0]?.toLowerCase();
return mimeExtension && /^[a-z0-9]+$/.test(mimeExtension)
? mimeExtension
: 'image';
}

export async function uploadTreasureImage(
file: File
): Promise<UploadedTreasureImage> {
let stage: TreasureSaveStage = 'image_prepare';
try {
const prepared=await compressTreasurePhoto(file);
stage='image_upload';
let supabase=getSupabaseClient();let prefix='';if(managementEnabled()){supabase=getAccountClient();const {data,error}=await supabase.auth.getUser();if(error||!data.user||data.user.is_anonymous)throw Error('Googleログインを確認してください。');prefix=data.user.id+'/';}
const path = prefix+crypto.randomUUID()+'.'+getFileExtension(prepared.file);
const { error } = await supabase.storage
.from(TREASURE_IMAGE_BUCKET)
.upload(path, prepared.file, {
contentType: prepared.file.type,
upsert: false,
});

if (error) {
throw new TreasureSaveError(saveDiagnostic(error, 'image_upload'));
}

stage = 'image_url';
const { data } = supabase.storage
.from(TREASURE_IMAGE_BUCKET)
.getPublicUrl(path);
if (typeof data?.publicUrl !== 'string' || !data.publicUrl) throw new TreasureSaveError(saveDiagnostic({}, 'image_url'));

return {
path,
publicUrl: data.publicUrl,
preparedFile:prepared.file,
photo:{originalBytes:prepared.originalBytes,compressedBytes:prepared.compressedBytes,width:prepared.width,height:prepared.height,quality:prepared.quality,targetMet:prepared.targetMet},
};
} catch (error) {
const diagnostic = saveDiagnostic(error, stage);
console.error('[treasure-image] failed', { ...diagnostic, ...imageDiagnostic(file) });
throw error instanceof TreasureSaveError ? error : new TreasureSaveError(diagnostic);
}
}

export async function deleteTreasureImage(path: string) {
const supabase = getSupabaseClient();
const { error } = await supabase.storage
.from(TREASURE_IMAGE_BUCKET)
.remove([path]);

if (error) {
const diagnostic = saveDiagnostic(error, 'image_cleanup');
console.error('[treasure-image] cleanup_failed', diagnostic);
throw new TreasureSaveError(diagnostic);
}
}
