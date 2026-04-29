/**
 * tool-minimap-maplibre — MapLibre initializer for MinimapTool.
 *
 * Renders a small overview map in the status area, kept in sync with the
 * main map.  The minimap shows the configured basemap, and a rectangle
 * indicating the main map's current viewport.  Clicking inside the
 * minimap recentres the main map.
 *
 * Hidden on mobile devices (matches the leaflet implementation).
 */

import '../../../tool/minimap/tool-minimap'
import { basemapSpecForConfig } from '../../viewer-maplibre'

declare const SMK:        any
declare const maplibregl: any

const SIZE_PX        = 160      // square minimap
const ZOOM_OFFSET    = 4        // mini.zoom = main.zoom - ZOOM_OFFSET
const FRAME_SOURCE   = 'smk-mm-frame'
const FRAME_FILL_ID  = 'smk-mm-frame-fill'
const FRAME_LINE_ID  = 'smk-mm-frame-line'

const FRAME_COLOR    = '#ff5252'

SMK.TYPE.MinimapTool.addInitializer( function ( this: any, smk: any ) {
    if ( smk.$viewer.type !== 'maplibre' ) return
    if ( smk.$device === 'mobile' )         return

    const self = this

    // Container in the status area.
    const wrap = document.createElement( 'div' )
    wrap.className = 'smk-minimap-maplibre'
    Object.assign( wrap.style, {
        position:      'relative',
        width:         SIZE_PX + 'px',
        height:        SIZE_PX + 'px',
        border:        '1px solid rgba(0,0,0,0.4)',
        borderRadius:  '3px',
        overflow:      'hidden',
        background:    '#eee',
        margin:        '4px',
    } )
    smk.addToStatus( wrap )

    // ------------------------------------------------------------------
    // Build the minimap
    // ------------------------------------------------------------------
    const baseMapId = self.baseMap || smk.viewer.baseMap || 'Topographic'
    const cfg       = smk.$viewer.getBasemapConfig( baseMapId )
    const specs     = cfg ? basemapSpecForConfig( cfg ) : []

    const sources: any = {}
    const layers:  any[] = []
    specs.forEach( ( spec: any ) => {
        sources[ spec.sourceId ] = spec.source
        layers.push( spec.layer )
    } )

    const main   = smk.$viewer.map
    const center = main.getCenter()

    let mini: any
    try {
        mini = new maplibregl.Map( {
            container:          wrap,
            style:              {
                version: 8,
                sources,
                layers,
                glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
            },
            attributionControl: false,
            interactive:        false,
            dragRotate:         false,
            pitchWithRotate:    false,
            touchPitch:         false,
            projection:         'mercator',
            center:             [ center.lng, center.lat ],
            zoom:               Math.max( 0, main.getZoom() - ZOOM_OFFSET ),
            minZoom:            0,
            maxZoom:            22,
        } )
    } catch ( e ) {
        console.warn( 'maplibre minimap: failed to construct overview map', e )
        return
    }

    // Allow click-to-recenter even though the mini map is non-interactive.
    wrap.addEventListener( 'click', function ( ev: MouseEvent ) {
        const rect = wrap.getBoundingClientRect()
        const px   = ev.clientX - rect.left
        const py   = ev.clientY - rect.top
        try {
            const ll = mini.unproject( [ px, py ] )
            main.easeTo( { center: [ ll.lng, ll.lat ], duration: 300 } )
        } catch { /* ignore */ }
    } )

    function emptyFC() { return { type: 'FeatureCollection' as const, features: [] as any[] } }

    function ensureFrameLayers() {
        if ( mini.getSource( FRAME_SOURCE ) ) return
        mini.addSource( FRAME_SOURCE, { type: 'geojson', data: emptyFC() } )
        mini.addLayer( {
            id:     FRAME_FILL_ID,
            type:   'fill',
            source: FRAME_SOURCE,
            paint:  { 'fill-color': FRAME_COLOR, 'fill-opacity': 0.1 },
        } )
        mini.addLayer( {
            id:     FRAME_LINE_ID,
            type:   'line',
            source: FRAME_SOURCE,
            paint:  { 'line-color': FRAME_COLOR, 'line-width': 2 },
        } )
    }

    function updateFrame() {
        try {
            const b   = main.getBounds()
            const w   = b.getWest(), e = b.getEast(), s = b.getSouth(), n = b.getNorth()
            const ring = [ [ w, s ], [ e, s ], [ e, n ], [ w, n ], [ w, s ] ]
            const fc: any = {
                type: 'FeatureCollection',
                features: [ { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [ ring ] } } ],
            }
            const src = mini.getSource( FRAME_SOURCE )
            if ( src ) src.setData( fc )

            // Recentre the mini map and adjust zoom so the frame stays visible.
            const c = main.getCenter()
            mini.jumpTo( {
                center: [ c.lng, c.lat ],
                zoom:   Math.max( 0, main.getZoom() - ZOOM_OFFSET ),
            } )
        } catch { /* ignore */ }
    }

    mini.on( 'load', function () {
        ensureFrameLayers()
        updateFrame()
    } )

    // Demote tile decode errors (matches main viewer's handling)
    mini.on( 'error', function ( e: any ) {
        const err = e?.error
        const msg = err?.message || String( err || '' )
        if (
            /could not be decoded/i.test( msg ) ||
            /Failed to fetch|NetworkError|AbortError/i.test( msg ) ||
            err?.name === 'InvalidStateError'
        ) return
        console.warn( 'maplibre minimap:', err || e )
    } )

    main.on( 'move', updateFrame )
    main.on( 'zoom', updateFrame )

    // Track basemap changes on the main viewer.
    if ( typeof smk.$viewer.changedBaseMap === 'function' ) {
        smk.$viewer.changedBaseMap( function ( ev: any ) {
            const newCfg = smk.$viewer.getBasemapConfig( ev.baseMap )
            if ( !newCfg ) return
            const newSpecs = basemapSpecForConfig( newCfg )

            // Remove existing basemap layers/sources from the mini map.
            try {
                const style = mini.getStyle()
                ;( style.layers || [] ).forEach( ( ly: any ) => {
                    if ( ly.id.indexOf( 'smk-bm-' ) === 0 && mini.getLayer( ly.id ) ) {
                        mini.removeLayer( ly.id )
                    }
                } )
                Object.keys( style.sources || {} ).forEach( ( sid: string ) => {
                    if ( sid.indexOf( 'smk-bm-' ) === 0 && mini.getSource( sid ) ) {
                        mini.removeSource( sid )
                    }
                } )
            } catch { /* ignore */ }

            // Insert new basemap layers below the frame layer.
            const beforeId = mini.getLayer( FRAME_FILL_ID ) ? FRAME_FILL_ID : undefined
            newSpecs.forEach( ( spec: any ) => {
                if ( !mini.getSource( spec.sourceId ) ) mini.addSource( spec.sourceId, spec.source )
                if ( !mini.getLayer( spec.layer.id ) )  mini.addLayer( spec.layer, beforeId )
            } )
        } )
    }
} )
