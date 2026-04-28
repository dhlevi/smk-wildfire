/**
 * tool-markup-maplibre — MapLibre initializer for MarkupTool.
 *
 * Native MapLibre drawing implementation (no Geoman).  Supports the same
 * `drawMode` values used by the Leaflet/Geoman version where reasonable:
 *   - Polygon    : click vertices, double-click to finish
 *   - Line       : click vertices, double-click to finish
 *   - Marker     : single click drops a point
 *   - Rectangle  : two clicks define the opposite corners
 *
 * Holds a single in-memory markup (replacing the prior one on a new draw),
 * matches the Leaflet `markup-created` handler contract by emitting the
 * finished feature as GeoJSON.
 */

import '../../../tool/markup/tool-markup'

declare const SMK: any

const SRC_ID    = 'smk-markup'
const FILL_ID   = 'smk-markup-fill'
const LINE_ID   = 'smk-markup-line'
const POINT_ID  = 'smk-markup-point'

const COLOR     = '#3388ff'

function emptyFC() { return { type: 'FeatureCollection' as const, features: [] as any[] } }

SMK.TYPE.MarkupTool.addInitializer( function ( this: any, smk: any ) {
    if ( smk.$viewer.type !== 'maplibre' ) return

    const self = this
    const map  = smk.$viewer.map

    // ------------------------------------------------------------------
    // State
    // ------------------------------------------------------------------
    let drawing       = false
    let mode: string  = 'Polygon'
    let points: number[][] = []
    let hover: number[] | null = null
    let prevFeature: any  = null
    let inputAttached     = false
    let prevDblClickEnabled = false
    let prevCursor: string | undefined

    // ------------------------------------------------------------------
    // Source + layers
    // ------------------------------------------------------------------
    function ensureLayers() {
        if ( map.getSource( SRC_ID ) ) return

        map.addSource( SRC_ID, { type: 'geojson', data: emptyFC() } )

        map.addLayer( {
            id:     FILL_ID,
            type:   'fill',
            source: SRC_ID,
            filter: [ 'in', [ 'geometry-type' ], [ 'literal', [ 'Polygon' ] ] ],
            paint:  {
                'fill-color':   COLOR,
                'fill-opacity': 0.2,
            },
        } )

        map.addLayer( {
            id:     LINE_ID,
            type:   'line',
            source: SRC_ID,
            filter: [ 'in', [ 'geometry-type' ], [ 'literal', [ 'LineString', 'Polygon' ] ] ],
            paint:  {
                'line-color': COLOR,
                'line-width': 3,
                'line-dasharray': [ 'case', [ '==', [ 'get', 'role' ], 'preview' ], [ 'literal', [ 2, 2 ] ], [ 'literal', [ 1, 0 ] ] ],
            },
        } )

        map.addLayer( {
            id:     POINT_ID,
            type:   'circle',
            source: SRC_ID,
            filter: [ 'in', [ 'geometry-type' ], [ 'literal', [ 'Point' ] ] ],
            paint:  {
                'circle-radius':       6,
                'circle-color':        '#ffffff',
                'circle-stroke-color': COLOR,
                'circle-stroke-width': 2,
            },
        } )
    }

    function setData( fc: any ) {
        ensureLayers()
        const src = map.getSource( SRC_ID )
        if ( src ) src.setData( fc )
    }

    function clearLayers() {
        setData( emptyFC() )
    }

    // ------------------------------------------------------------------
    // Geometry preview / final
    // ------------------------------------------------------------------
    function buildPreview(): any {
        const fc = emptyFC()

        // Show committed vertices for polygon / line / rectangle so the user
        // knows where they've clicked.
        if ( mode === 'Polygon' || mode === 'Line' || mode === 'Rectangle' ) {
            points.forEach( ( p ) => {
                fc.features.push( { type: 'Feature', properties: { role: 'vertex' }, geometry: { type: 'Point', coordinates: p } } )
            } )
        }

        const live = hover ? points.concat( [ hover ] ) : points.slice()

        if ( mode === 'Polygon' ) {
            if ( live.length >= 3 ) {
                const ring = live.concat( [ live[ 0 ] ] )
                fc.features.push( { type: 'Feature', properties: { role: 'preview' }, geometry: { type: 'Polygon', coordinates: [ ring ] } } )
            } else if ( live.length >= 2 ) {
                fc.features.push( { type: 'Feature', properties: { role: 'preview' }, geometry: { type: 'LineString', coordinates: live } } )
            }
        } else if ( mode === 'Line' ) {
            if ( live.length >= 2 ) {
                fc.features.push( { type: 'Feature', properties: { role: 'preview' }, geometry: { type: 'LineString', coordinates: live } } )
            }
        } else if ( mode === 'Rectangle' ) {
            if ( points.length === 1 && hover ) {
                const ring = rectRing( points[ 0 ], hover )
                fc.features.push( { type: 'Feature', properties: { role: 'preview' }, geometry: { type: 'Polygon', coordinates: [ ring ] } } )
            }
        } else if ( mode === 'Marker' ) {
            if ( hover ) {
                fc.features.push( { type: 'Feature', properties: { role: 'preview' }, geometry: { type: 'Point', coordinates: hover } } )
            }
        }

        return fc
    }

    function rectRing( a: number[], b: number[] ): number[][] {
        const x0 = Math.min( a[ 0 ], b[ 0 ] ), x1 = Math.max( a[ 0 ], b[ 0 ] )
        const y0 = Math.min( a[ 1 ], b[ 1 ] ), y1 = Math.max( a[ 1 ], b[ 1 ] )
        return [ [ x0, y0 ], [ x1, y0 ], [ x1, y1 ], [ x0, y1 ], [ x0, y0 ] ]
    }

    function refreshPreview() {
        setData( buildPreview() )
    }

    // ------------------------------------------------------------------
    // Map event handlers
    // ------------------------------------------------------------------
    function onClick( ev: any ) {
        if ( !drawing ) return

        // Suppress the viewer's queued pickedLocation (which would fire
        // identify and deactivate this tool).
        if ( smk.$viewer.clickTimeout ) {
            clearTimeout( smk.$viewer.clickTimeout )
            smk.$viewer.clickTimeout = null
        }

        const pt = [ ev.lngLat.lng, ev.lngLat.lat ]

        if ( mode === 'Marker' ) {
            finish( { type: 'Point', coordinates: pt } )
            return
        }

        points.push( pt )

        if ( mode === 'Rectangle' && points.length >= 2 ) {
            finish( { type: 'Polygon', coordinates: [ rectRing( points[ 0 ], points[ 1 ] ) ] } )
            return
        }

        refreshPreview()
    }

    function onMouseMove( ev: any ) {
        if ( !drawing ) return
        hover = [ ev.lngLat.lng, ev.lngLat.lat ]
        refreshPreview()
    }

    function onDblClick( ev: any ) {
        if ( !drawing ) return
        ev.preventDefault?.()
        if ( smk.$viewer.clickTimeout ) {
            clearTimeout( smk.$viewer.clickTimeout )
            smk.$viewer.clickTimeout = null
        }

        if ( mode === 'Polygon' && points.length >= 3 ) {
            const ring = points.concat( [ points[ 0 ] ] )
            finish( { type: 'Polygon', coordinates: [ ring ] } )
        } else if ( mode === 'Line' && points.length >= 2 ) {
            finish( { type: 'LineString', coordinates: points.slice() } )
        }
    }

    function finish( geometry: any ) {
        const feature = { type: 'Feature', properties: {}, geometry }

        // Render the final shape (no hover preview, no vertex points).
        const fc = emptyFC()
        fc.features.push( { type: 'Feature', properties: { role: 'final' }, geometry } )
        setData( fc )

        prevFeature = feature
        teardownInput()
        drawing  = false

        // Mirror leaflet contract: clear active flag so the widget re-toggles
        // on next activation, and call the existing 'markup-created' handler.
        self.active = false
        SMK.HANDLER.get( self.id, 'markup-created' )( smk, self, feature )
    }

    // ------------------------------------------------------------------
    // Input wiring
    // ------------------------------------------------------------------
    function setupInput() {
        if ( inputAttached ) return
        inputAttached = true

        prevDblClickEnabled = !!map.doubleClickZoom?.isEnabled?.()
        map.doubleClickZoom?.disable?.()

        const canvas = map.getCanvas()
        prevCursor   = canvas.style.cursor
        canvas.style.cursor = 'crosshair'

        map.on( 'click',     onClick )
        map.on( 'mousemove', onMouseMove )
        map.on( 'dblclick',  onDblClick )
    }

    function teardownInput() {
        if ( !inputAttached ) return
        inputAttached = false

        map.off( 'click',     onClick )
        map.off( 'mousemove', onMouseMove )
        map.off( 'dblclick',  onDblClick )

        if ( prevDblClickEnabled ) map.doubleClickZoom?.enable?.()

        const canvas = map.getCanvas()
        canvas.style.cursor = prevCursor != null ? prevCursor : ''
    }

    // ------------------------------------------------------------------
    // Public API
    // ------------------------------------------------------------------
    self.removeMarkup = function () {
        prevFeature = null
        clearLayers()
    }

    self.changedActive( function () {
        if ( self.active ) {
            self.removeMarkup()

            mode    = self.drawMode || 'Polygon'
            points  = []
            hover   = null
            drawing = true

            setupInput()
        } else {
            teardownInput()
            drawing = false
            points  = []
            hover   = null
        }
    } )
} )
