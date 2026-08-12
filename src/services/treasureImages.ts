import { getSupabaseClient } from './supabase';

const TREASURE_IMAGE_BUCKET = 'treasure-images';

export type UploadedTreasureImage = {
path: string;
publicUrl: string;
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
const supabase = getSupabaseClient();
const path = `${crypto.randomUUID()}.${getFileExtension(file)}`;
const { error } = await supabase.storage
.from(TREASURE_IMAGE_BUCKET)
.upload(path, file, {
contentType: file.type,
upsert: false,
});

if (error) {
console.error('[treasure-image] Upload failed', {
message: error.message,
});
throw new Error('Treasure image upload failed');
}

const { data } = supabase.storage
.from(TREASURE_IMAGE_BUCKET)
.getPublicUrl(path);

return {
path,
publicUrl: data.publicUrl,
};
}

export async function deleteTreasureImage(path: string) {
const supabase = getSupabaseClient();
const { error } = await supabase.storage
.from(TREASURE_IMAGE_BUCKET)
.remove([path]);

if (error) {
console.error('[treasure-image] Delete failed', {
path,
message: error.message,
});
throw new Error('Treasure image delete failed');
}
}
