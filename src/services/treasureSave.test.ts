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
    await expect(createTreasure(row)).resolves.toBeUndefined();
    expect(mocks.insert).toHaveBeenCalledWith(row);
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
  it('preserves safe DB error codes and removes failing row details', async () => {
    mocks.insert.mockResolvedValue({ status: 400, error: { code: '23514', details: 'private location' } });
    await expect(createTreasure({ name: '像', comment: '', category: '📷 写真スポット', latitude: 35, longitude: 139, image_url: null })).rejects.toMatchObject({ diagnostic: { stage: 'db_insert', code: '23514', outcome: 'rejected' } });
  });
});
