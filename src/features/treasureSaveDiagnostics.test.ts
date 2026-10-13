import { describe, expect, it } from 'vitest';
import { imageDiagnostic, saveDiagnostic, saveFailureMessage, TreasureSaveError } from './treasureSaveDiagnostics';

describe('private treasure save diagnostics', () => {
  it('retains only stage, approved code and HTTP status', () => {
    const error = { status: 403, code: '42501', message: 'private token', details: 'private coordinates', hint: 'private filename' };
    expect(saveDiagnostic(error, 'db_insert')).toEqual({ stage: 'db_insert', httpStatus: 403, code: '42501', outcome: 'rejected' });
    expect(JSON.stringify(saveDiagnostic(error, 'db_insert'))).not.toContain('private');
    expect(saveDiagnostic({ code: 'secret-in-code', status: 'secret' }, 'image_upload').code).toBe('unknown');
  });
  it.each([undefined, 408, 429, 500, 503])('does not assume INSERT failed for ambiguous status %s', status => {
    expect(saveDiagnostic({ status }, 'db_insert').outcome).toBe('unknown');
  });
  it('preserves the original failed stage across wrappers', () => {
    const error = new TreasureSaveError(saveDiagnostic({ statusCode: '413' }, 'image_upload'));
    expect(saveDiagnostic(error, 'db_insert').stage).toBe('image_upload');
    expect(saveFailureMessage(error, 'db_insert', null)).toContain('写真のアップロード');
  });
  it('requests a list check before retrying an uncertain INSERT', () => {
    expect(saveFailureMessage(new Error('network'), 'db_insert', null)).toContain('再送する前に図鑑');
  });
  it('reports only coarse image format and size, never the filename', () => {
    const file = { name: 'private-name.heic', type: 'image/heic', size: 6291457 } as File;
    expect(imageDiagnostic(file)).toEqual({ format: 'HEIC', sizeMiB: 7 });
    expect(saveFailureMessage({}, 'image_upload', file)).not.toContain('private-name');
  });
});
