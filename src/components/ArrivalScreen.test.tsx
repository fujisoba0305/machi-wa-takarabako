// @vitest-environment jsdom
import React from 'react';
import { act } from 'react-dom/test-utils';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import type { ActiveAdventure } from '../features/activeAdventure';
import { ArrivalScreen } from './ArrivalScreen';
const adventure: ActiveAdventure = {
 version:1,id:'test',target:{kind:'normal',id:'node:1',latitude:35,longitude:139},
 departure:{latitude:35,longitude:139,accuracy:10,timestamp:1000},startedAt:1000,
 rewardClaimed:true,completedAt:121000,arrival:{latitude:35,longitude:139,accuracy:10,timestamp:121000},
 result:{spot:{type:'node',id:1,lat:35,lon:139,tags:{name:'長い目的地の名前'.repeat(20)}},treasure:null,choices:{mood:'自然'},distanceKm:0.8}
};
it('shows only confirmed completion and never substitutes a straight-line distance for the departure route', () => {
 const container=document.createElement('div'); const root=createRoot(container);
 const actions={onHome:vi.fn(),onNext:vi.fn(),onRate:vi.fn()};
 act(()=>root.render(<ArrivalScreen adventure={{...adventure,rewardClaimed:false}} {...actions}/>));
 expect(container.textContent).toBe('');
 act(()=>root.render(<ArrivalScreen adventure={adventure} {...actions}/>));
 expect(container.textContent).toContain('2分');
 expect(container.textContent).toContain('徒歩ルート距離を取得できませんでした');
 expect(container.textContent).not.toContain('0.8km');
 expect(container.textContent).not.toContain('登録件数');
 expect(container.querySelector('time')?.dateTime).toBe(new Date(121000).toISOString());
 expect(actions.onNext).not.toHaveBeenCalled();
 act(()=>root.unmount());
});
