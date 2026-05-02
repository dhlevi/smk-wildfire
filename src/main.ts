/**
 * SMK — Simple Map Kit
 * Vite / TypeScript entry point
 *
 * Core modules are being converted from include.module()
 * to ES imports. Converted modules are imported here and also assigned to
 * window.SMK.* for backward compatibility with unconverted modules.
 * 
 * Note: some modules (e.g. viewer-leaflet) still have unconverted deps (e.g. turf, jQuery) that are imported via global vars. These will be converted in a future pass.
 * Additionally esri3d viewer is not functional yet, but considering dropping support
 * and replacing with MapLibre, which also has 3D support via Mapbox GL JS.
 *
 * After all modules are converted, the global namespace (window.SMK) can be removed and modules can import from each other directly.
 */

// ---------------------------------------------------------------------------
// Bootstrap the window.SMK global namespace.
// Unconverted modules expect these objects to exist before they run.
// ---------------------------------------------------------------------------

import type { SMKEvent } from './smk/event'
import type { UTIL as UTILType }    from './smk/util'

declare global {
    interface Window {
        SMK:       SMKNamespace
        include:   IncludeLoader
        dojoConfig: Record<string, any>
    }
}

export interface SMKNamespace {
    TYPE:        SMKTypeRegistry
    UTIL:        typeof UTILType
    HANDLER:     SMKHandlerRegistry
    ON_FAILURE:  ( err: Error, el?: Element ) => void
    INIT?:       ( option: Record<string, unknown> ) => void
    FAILURE?:    Error
    // Runtime sub-namespaces that modules self-register into.  Typed as `any`
    // for now (a future pass can refine each).
    COMPONENT?:  Record<string, any>
    CONFIG?:     Record<string, any>
    PROJECTIONS?: any[]
    MAP?:        Record<string, any>
    BUILD?:      Record<string, any>
    // Catch-all for ad-hoc registrations (e.g. _baseMaps cache).
    [key: string]: any
}

export interface SMKTypeRegistry {
    Event:   typeof SMKEvent
    Viewer:  ViewerRegistry
    Layer:   LayerRegistry
    SmkMap:  any
    Tool:    any
    Esri3d?: any
    [key: string]: any
}

export interface SMKHandlerRegistry {
    has:  ( scope: string, name: string ) => boolean
    get:  ( scope: string, name: string ) => Function | null
    set?: ( scope: string, name: string, fn: Function ) => void
}

export interface ViewerRegistry {
    [key: string]: any
    leaflet?: any
    esri3d?:  any
}

export interface LayerRegistry {
    [type: string]: LayerConstructor & {
        [viewer: string]: LayerConstructor & {
            create?: ( layers: any[], zIndex: number ) => any
        }
    }
}

export interface LayerConstructor {
    new ( config: LayerConfig ): any
    prototype: any
}

export interface LayerConfig {
    id:           string
    type:         string
    title?:       string
    isVisible?:   boolean
    isQueryable?: boolean
    opacity?:     number
    attribution?: string
    minScale?:    number
    maxScale?:    number
    [key: string]: unknown
}

export interface IncludeLoader {
    module: ( name: string, deps: string[] | null, factory: Function ) => void
    tag:    ( name: string, attr?: any ) => any
    SMK?:   boolean
}

// ---------------------------------------------------------------------------
// Minimal window.SMK guard — ensures the global object exists so that
// modules that register themselves (e.g. smk-map.ts) don't throw when they
// do `window.SMK.TYPE.SmkMap = …`.  The full initialisation (CONFIG, BUILD,
// HANDLER, INIT, etc.) is performed by bootstrap.ts which is imported last.
// ---------------------------------------------------------------------------

if ( typeof window !== 'undefined' ) {
    if ( !window.SMK )            ( window as any ).SMK            = {}
    if ( !window.SMK.TYPE )       ( window.SMK as any ).TYPE       = {}
    if ( !window.SMK.UTIL )       ( window.SMK as any ).UTIL       = {}
    if ( !window.SMK.HANDLER )    ( window.SMK as any ).HANDLER    = { has: () => false, get: () => null }
    if ( !window.SMK.TYPE.Viewer ) window.SMK.TYPE.Viewer          = {} as any
    if ( !window.SMK.TYPE.Layer )  window.SMK.TYPE.Layer           = {} as any

    // ----------------------------------------------------------------------
    // Vector data providers — runtime registry for dynamic / in-memory
    // data sources used by `vector` layer configs:
    //
    //     SMK.dataProviders.register( 'liveFires', ( layerCfg, smk ) => {
    //         // 1) Promise / GeoJSON for a one-shot load
    //         return fetch( '/api/fires' ).then( r => r.json() )
    //
    //         // 2) Subscriber form - live updates; return an unsubscribe fn
    //         //    return ( push ) => {
    //         //        const off = store.on( 'change', s => push( s.geojson ) )
    //         //        return off
    //         //    }
    //     } )
    //
    // Used in layer config as:
    //     { "type": "vector", "id": "fires", "isInternal": true,
    //       "dataProvider": "liveFires" }
    // ----------------------------------------------------------------------
    if ( !( window.SMK as any ).dataProviders ) {
        const _providers: Record<string, Function> = {}
        ;( window.SMK as any ).dataProviders = {
            register( name: string, fn: Function ) { _providers[ name ] = fn },
            unregister( name: string ) { delete _providers[ name ] },
            get( name: string ) { return _providers[ name ] || null },
            has( name: string ) { return !!_providers[ name ] },
        }
    }
}

// ---------------------------------------------------------------------------
// Global SMK namespace stub — MUST be first so Rollup places it before
// util.ts and all other self-registering modules in the bundle.
// ---------------------------------------------------------------------------
import './smk/smk-global'

// ---------------------------------------------------------------------------
// Converted ES modules — imported here so Vite bundles them.
// Each module also self-assigns to window.SMK.* for backward compat.
// ---------------------------------------------------------------------------

export { UTIL, default as util } from './smk/util'
export { SMKEvent, default as event } from './smk/event'
export { Layer, default as layer } from './smk/layer/layer'
export { FeatureSet, default as featureSet } from './smk/feature-set'
export { LayerDisplay, LayerDisplayContext } from './smk/layer-display'
export { Query, QueryParameter } from './smk/query/query'
export { VectorLayer, WmsLayer, EsriDynamicLayer, EsriFeatureLayer, EsriTiledLayer, ClusterLayer } from './smk/layer/layer-types'
export { Viewer, default as viewer } from './smk/viewer'

// ---------------------------------------------------------------------------
// Core runtime deps — must be imported before viewer/tool modules use them
// ---------------------------------------------------------------------------
import './smk/merge-config'
import './smk/vue-config'
import './smk/document-ready'
import './smk/projections'

// ---------------------------------------------------------------------------
// Vue component base classes — must precede individual component imports
// ---------------------------------------------------------------------------
import './smk/component/component'
import './smk/component/activate-tool/component-activate-tool'
import './smk/component/address-search/component-address-search'
import './smk/component/command-button/component-command-button'
import './smk/component/enter-input/component-enter-input'
import './smk/component/feature-attribute/component-feature-attribute'
import './smk/component/feature-attributes/component-feature-attributes'
import './smk/component/feature-description/component-feature-description'
import './smk/component/feature-list/component-feature-list'
import './smk/component/feature-properties/component-feature-properties'
import './smk/component/menu-button/component-menu-button'
import './smk/component/parameter/component-parameter'
import './smk/component/select-dropdown/component-select-dropdown'
import './smk/component/select-option/component-select-option'
import './smk/component/toggle-button/component-toggle-button'
import './smk/component/tool-panel-feature/component-tool-panel-feature'
import './smk/component/tool-panel/component-tool-panel'

// ---------------------------------------------------------------------------
// Sidepanel and status-message — self-register on SMK.TYPE
// ---------------------------------------------------------------------------
import './smk/sidepanel/sidepanel'
import './smk/status-message/status-message'

// ---------------------------------------------------------------------------
// Tool mixins — self-register on SMK.TYPE (tool-base is pulled in via tool.ts)
// ---------------------------------------------------------------------------
import './smk/mixin/tool-feature-list/tool-feature-list'
import './smk/mixin/tool-internal-layers/tool-internal-layers'
import './smk/mixin/tool-panel/tool-panel'
import './smk/mixin/tool-panel-feature/tool-panel-feature'
import './smk/mixin/tool-widget/tool-widget'

// ---------------------------------------------------------------------------
// API services
// ---------------------------------------------------------------------------
import './smk/api/geocoder'
import './smk/api/route-planner'

// ---------------------------------------------------------------------------
// Viewer implementations
// ---------------------------------------------------------------------------
import './smk/smk-map'
import './smk/base-maps'
import './smk/viewer-leaflet/viewer-leaflet'
import './smk/viewer-leaflet/layer/layer-vector-leaflet'
import './smk/viewer-leaflet/layer/layer-wms-leaflet'
import './smk/viewer-leaflet/layer/layer-esri-dynamic-leaflet'
import './smk/viewer-leaflet/layer/layer-esri-feature-leaflet'
import './smk/viewer-leaflet/layer/layer-esri-tiled-leaflet'
import './smk/viewer-esri3d/types-esri3d'
import './smk/viewer-esri3d/util-esri3d'
import './smk/viewer-esri3d/viewer-esri3d'
import './smk/viewer-esri3d/feature-list-esri3d'
import './smk/viewer-esri3d/layer/layer-cluster-esri3d'
import './smk/viewer-esri3d/layer/layer-esri-dynamic-esri3d'
import './smk/viewer-esri3d/layer/layer-vector-esri3d'
import './smk/viewer-esri3d/layer/layer-wms-esri3d'
import './smk/viewer-maplibre/viewer-maplibre'

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------
import './smk/tool/about/tool-about'
import './smk/tool/pan/tool-pan'
import './smk/tool/zoom/tool-zoom'
import './smk/tool/coordinate/tool-coordinate'
import './smk/tool/version/tool-version'
import './smk/tool/scale/tool-scale'
import './smk/tool/reset-view/tool-reset-view'
import './smk/tool/minimap/tool-minimap'
import './smk/tool/menu/tool-menu'
import './smk/tool/toolbar/tool-toolbar'
import './smk/tool/actionbar/tool-actionbar'
import './smk/tool/dropdown/tool-dropdown'
import './smk/tool/baseMaps/tool-baseMaps'
import './smk/tool/list-menu/tool-list-menu'
import './smk/tool/shortcut-menu/tool-shortcut-menu'
import './smk/tool/bespoke/tool-bespoke'
import './smk/tool/bookmarks/tool-bookmarks'
import './smk/tool/current-location/tool-current-location'
import './smk/tool/location/tool-location'
import './smk/tool/legend/tool-legend'
import './smk/tool/layers/tool-layers'
import './smk/tool/markup/tool-markup'
import './smk/tool/measure/tool-measure'
import './smk/tool/identify/tool-identify'
import './smk/tool/search/tool-search'
import './smk/tool/select/tool-select'
import './smk/tool/query/tool-query'
import './smk/tool/query-place/tool-query-place'
import './smk/tool/directions/tool-directions'

// ---------------------------------------------------------------------------
// Viewer-specific tool initializers — MUST come after base Tools above so
// SMK.TYPE.<BaseTool> is already defined when addInitializer() is called.
// ---------------------------------------------------------------------------
import './smk/viewer-leaflet/tool/pan/tool-pan-leaflet'
import './smk/viewer-leaflet/tool/zoom/tool-zoom-leaflet'
import './smk/viewer-leaflet/tool/identify/tool-identify-leaflet'
import './smk/viewer-leaflet/tool/tool-feature-list-clustering-leaflet'
import './smk/viewer-leaflet/tool/select/tool-select-leaflet'
import './smk/viewer-leaflet/tool/query/tool-query-leaflet'
import './smk/viewer-leaflet/tool/directions/tool-directions-leaflet'
import './smk/viewer-leaflet/tool/markup/tool-markup-leaflet'
import './smk/viewer-leaflet/tool/measure/tool-measure-leaflet'
import './smk/viewer-leaflet/tool/minimap/tool-minimap-leaflet'
import './smk/viewer-leaflet/tool/query-place/tool-query-place-leaflet'
import './smk/viewer-esri3d/tool/pan/tool-pan-esri3d'
import './smk/viewer-esri3d/tool/zoom/tool-zoom-esri3d'
import './smk/viewer-esri3d/tool/identify/tool-identify-esri3d'
import './smk/viewer-esri3d/tool/select/tool-select-esri3d'
import './smk/viewer-esri3d/tool/query/tool-query-esri3d'
import './smk/viewer-esri3d/tool/search/tool-search-esri3d'
import './smk/viewer-esri3d/tool/measure/tool-measure-esri3d'
import './smk/viewer-esri3d/tool/directions/tool-directions-esri3d'
import './smk/viewer-maplibre/tool/pan/tool-pan-maplibre'
import './smk/viewer-maplibre/tool/zoom/tool-zoom-maplibre'
import './smk/viewer-maplibre/tool/mode/tool-mode-maplibre'
import './smk/viewer-maplibre/tool/measure/tool-measure-maplibre'
import './smk/viewer-maplibre/tool/markup/tool-markup-maplibre'
import './smk/viewer-maplibre/tool/minimap/tool-minimap-maplibre'
import './smk/viewer-maplibre/tool/directions/tool-directions-maplibre'
import './smk/viewer-maplibre/layer/layer-wms-maplibre'
import './smk/viewer-maplibre/layer/layer-esri-tiled-maplibre'
import './smk/viewer-maplibre/layer/layer-esri-dynamic-maplibre'
import './smk/viewer-maplibre/layer/layer-esri-feature-maplibre'
import './smk/viewer-maplibre/layer/layer-vector-maplibre'

// ---------------------------------------------------------------------------
// CSS — all SMK stylesheets bundled into dist/style.css by Vite.
// The host page must <link> to dist/style.css in addition to smk.umd.js.
// ---------------------------------------------------------------------------

// Base theme tokens and layout
import './theme/_base/variables.css'
import './theme/_base/resets.css'
import './theme/_base/map-frame.css'
import './theme/_base/elastic.css'
import './theme/_base/command.css'

// Components
import './smk/component/component.css'
import './smk/component/activate-tool/component-activate-tool.css'
import './smk/component/address-search/component-address-search.css'
import './smk/component/command-button/component-command-button.css'
import './smk/component/enter-input/component-enter-input.css'
import './smk/component/feature-list/component-feature-list.css'
import './smk/component/menu-button/component-menu-button.css'
import './smk/component/parameter/tool-query.css'
import './smk/component/select-dropdown/component-select-dropdown.css'
import './smk/component/select-option/component-select-option.css'
import './smk/component/toggle-button/component-toggle-button.css'
import './smk/component/tool-panel-feature/component-tool-panel-feature.css'

// Sidepanel and status
import './smk/sidepanel/sidepanel.css'
import './smk/status-message/status-message.css'

// Tools
import './smk/tool/about/tool-about.css'
import './smk/tool/actionbar/tool-actionbar.css'
import './smk/tool/baseMaps/tool-base-maps.css'
import './smk/tool/bespoke/tool-bespoke.css'
import './smk/tool/bookmarks/tool-bookmarks.css'
import './smk/tool/coordinate/tool-coordinate.css'
import './smk/tool/current-location/tool-current-location.css'
import './smk/tool/directions/tool-directions.css'
import './smk/tool/directions/tool-directions-options.css'
import './smk/tool/directions/tool-directions-route.css'
import './smk/tool/dropdown/dropdown.css'
import './smk/tool/identify/tool-identify.css'
import './smk/tool/layers/tool-layers.css'
import './smk/tool/legend/tool-legend.css'
import './smk/tool/list-menu/list-menu.css'
import './smk/tool/location/tool-location.css'
import './smk/tool/measure/tool-measure.css'
import './smk/tool/menu/menu.css'
import './smk/tool/query/tool-query.css'
import './smk/tool/reset-view/tool-reset-view.css'
import './smk/tool/scale/tool-scale.css'
import './smk/tool/search/tool-search.css'
import './smk/tool/shortcut-menu/shortcut-menu.css'
import './smk/tool/toolbar/tool-toolbar.css'
import './smk/tool/version/tool-version.css'

// Leaflet viewer and its tools
import './smk/viewer-leaflet/viewer-leaflet.css'
import './smk/viewer-leaflet/tool/identify/tool-identify-leaflet.css'
import './smk/viewer-leaflet/tool/directions/tool-directions-leaflet.css'
import './smk/viewer-leaflet/tool/measure/tool-measure-leaflet.css'
import './smk/viewer-leaflet/tool/query/tool-query-leaflet.css'

// ESRI 3D viewer
import './smk/viewer-esri3d/viewer-esri3d.css'

// Themes (all shipped; host picks one via <body class="smk-theme-*">)
import './theme/alpha/alpha.css'
import './theme/beta/beta.css'
import './theme/delta/delta.css'
import './theme/gamma/gamma.css'
import './theme/modern/modern.css'
import './theme/wf/wf.css'

// ---------------------------------------------------------------------------
// Bootstrap — must be last so all TYPE registrations above are done before
// the map init chain runs.  Replaces src/smk.js from the Grunt build.
// ---------------------------------------------------------------------------
import './smk/bootstrap'
