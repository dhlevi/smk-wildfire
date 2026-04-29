/**
 * Standalone bundle entry.
 *
 * Imports every external library that SMK relies on, exposes them as the
 * window globals that the legacy code expects (`window.L`, `window.Vue`,
 * `window.maplibregl`, etc.), then loads `main`.
 *
 * The resulting bundle (`dist/smk.standalone.js` + `dist/smk.standalone.css`)
 * is a single drop-in script that needs no other <script> tags.
 *
 * Note: ESM `import` statements are hoisted to the top of the module and
 * evaluated before any of the `window.* = ...` assignments below.  That is
 * fine because:
 *   - esri-leaflet / esri-leaflet-vector import `leaflet` themselves; rollup
 *     dedupes the import, so they patch the same `L` instance we expose.
 *   - SMK app code (loaded last via the `./main` import) is what reads the
 *     window globals, and by then all assignments below have run.
 */

import Vue from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import proj4 from 'proj4'
import * as turf from '@turf/turf'

// Side-effect imports — these extend `L.esri` on the leaflet instance above.
import 'esri-leaflet'
import 'esri-leaflet-vector'

const w = window as any
w.Vue        = Vue
w.L          = L
w.maplibregl = maplibregl
w.proj4      = proj4
w.turf       = turf

// Finally load SMK itself.  Must be the last import so it runs after the
// globals above are visible when its module body evaluates.
import './main'
