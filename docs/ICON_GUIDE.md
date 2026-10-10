# Season 2 SVG icons

- `AppIcon` uses the existing lucide-react dependency (22px, stroke 1.8). No new package or image request is needed. Its decorative SVG is hidden from assistive technology; the adjacent Japanese label names the action.
- `IconText` translates known legacy UI labels only at rendering time. Do not pass user-written names/comments to it. Supabase category values, native select values, and localStorage formats stay unchanged. `plainIconLabel` removes decoration only from the visible native option label.
- Normal icons inherit the warm brown UI palette. Active navigation uses orange; treasure/discovery uses blue. Icons inherit white on filled buttons to retain contrast. Category icons are 26px and navigation icons 24px. Tap targets are at least 44px.
- Shrine and Leaflet marker paths are original SVG artwork created for this app. `categoryMarkerSvg` only emits predefined paths; it avoids bundling the React server renderer and never interpolates user content.
- Lucide license: `/licenses/lucide.txt` (copied from the installed package; ISC with Feather attribution).

## Screens covered
Title, home categories, bottom navigation, condition/coin/gacha controls, destination cards, walking, arrival controls, treasure registration, collection/history/detail and map markers.

## Intentionally preserved
Takaran artwork/dialogue/evolution, gacha machine/capsules/drawing logic, arrival chest/jewel/confetti animation, treasure rank decorations/effects and photo backgrounds. GPS/rewards/history/rating/registration handlers and stored values are unchanged.

The existing My Page navigation item has no destination handler. Only its icon is refreshed; this change does not add a My Page feature.
