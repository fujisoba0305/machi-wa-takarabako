// @vitest-environment jsdom
import {it,expect,vi} from 'vitest';
import {readHomeLocationPermission} from './homeLocationPermission';
it.each(['granted','prompt','denied'] as const)('reads %s without requesting GPS',async state=>{const query=vi.fn().mockResolvedValue({state});expect(await readHomeLocationPermission({query})).toBe(state);expect(query).toHaveBeenCalledWith({name:'geolocation'});});
it('does not auto-acquire if permissions API is missing or rejects',async()=>{expect(await readHomeLocationPermission()).toBe('unavailable');expect(await readHomeLocationPermission({query:vi.fn().mockRejectedValue(Error())})).toBe('unavailable');});
it('ends permission probing if Safari never responds',async()=>{vi.useFakeTimers();try{const promise=readHomeLocationPermission({query:vi.fn(()=>new Promise<PermissionStatus>(()=>{}))});await vi.advanceTimersByTimeAsync(1500);expect(await promise).toBe('unavailable');}finally{vi.useRealTimers();}});
