/**
 * Ambient declarations for vendored libs that are loaded as window globals
 * via <script> tags in HTML pages (src/lib/*).
 *
 * These are installed as devDependencies (for types and version pinning) but
 * NOT bundled — Vite marks them external in vite.config.js.  This file lets
 * TypeScript see the global identifiers and (where useful) re-export the
 * package types.
 */

// ---------------------------------------------------------------------------
// Window globals — what HTML pages expose by loading <script src="..."></script>
// ---------------------------------------------------------------------------

import type * as LType   from 'leaflet'
import type * as MlgType from 'maplibre-gl'
import type Proj4Type    from 'proj4'

declare global {
    // Vue 2.7 — kept loose because tools use ad-hoc Vue.component( … ) etc.
    const Vue: any

    // Leaflet
    const L: typeof LType & {
        esri?:    any
        Vector?:  any
        Heat?:    any
        markerClusterGroup?: ( opts?: any ) => any
    }

    // MapLibre
    const maplibregl: typeof MlgType

    // proj4
    const proj4: typeof Proj4Type

    // Turf 5.x classic UMD
    const turf: any

    // Terraformer
    const Terraformer:                    any
    const ArcgisToGeoJSON:                any   // terraformer-arcgis-parser exposes this
    const WKT:                            any   // terraformer-wkt-parser

    // jQuery (used by some legacy paths)
    const jQuery: any
    const $:      any
}

export {}
