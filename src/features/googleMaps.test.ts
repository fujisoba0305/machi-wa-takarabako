import { describe, expect, it } from 'vitest';
import { buildGoogleMapsDirectionsUrl } from './googleMaps';

describe('Google Maps directions URL', () => {
it('passes the selected treasure coordinates as the walking destination', () => {
const url = new URL(buildGoogleMapsDirectionsUrl(
{ latitude: 35.681236, longitude: 139.767125 },
{ latitude: 35.6895, longitude: 139.6917 }
));

expect(url.origin + url.pathname).toBe('https://www.google.com/maps/dir/');
expect(url.searchParams.get('origin')).toBe('35.681236,139.767125');
expect(url.searchParams.get('destination')).toBe('35.6895,139.6917');
expect(url.searchParams.get('travelmode')).toBe('walking');
});

it('preserves an optional waypoint for the existing date route', () => {
const url = new URL(buildGoogleMapsDirectionsUrl(
{ latitude: 35, longitude: 139 },
{ latitude: 35.2, longitude: 139.2 },
{ latitude: 35.1, longitude: 139.1 }
));

expect(url.searchParams.get('waypoints')).toBe('35.1,139.1');
});
});
