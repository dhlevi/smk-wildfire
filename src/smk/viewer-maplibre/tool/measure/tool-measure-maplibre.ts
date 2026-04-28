/**
 * tool-measure-maplibre — MapLibre initializer for MeasureTool.
 *
 * Native MapLibre implementation (no Leaflet plugin).  Mirrors the public
 * behaviour of the Leaflet measure tool:
 *   - listens for 'start-distance', 'start-area', 'cancel' events
 *   - click to add a vertex, double-click (or maxPoints) to finish
 *   - live preview line/polygon and running totals via turf
 *   - emits 'measure-distance' / 'measure-area' on completion
 *   - honours minPoints / maxPoints
 *   - populates self.results (consumed by the measure-panel)
 */

import '../../../tool/measure/tool-measure'

declare const SMK:  any
declare const turf: any

const SRC_ID    = 'smk-measure'
const FILL_ID   = 'smk-measure-fill'
const LINE_ID   = 'smk-measure-line'
const POINT_ID  = 'smk-measure-points'
const PREVIEW_ID = 'smk-measure-preview'

const COLOR_ACTIVE   = '#38598a'
const COLOR_COMPLETE = '#003366'

function emptyFC() { return { type: 'FeatureCollection' as const, features: [] as any[] } }

SMK.TYPE.MeasureTool.addInitializer( function ( this: any, smk: any ) {
    if ( smk.$viewer.type !== 'maplibre' ) return

    const self = this
    const map  = smk.$viewer.map

    self.viewer.maplibre = true
    self.showStatusMessage( 'Select measurement method' )

    // ------------------------------------------------------------------
    // State
    // ------------------------------------------------------------------
    let active   = false   // currently capturing
    let mode: 'distance' | 'area' | null = null
    let points: number[][] = []   // [ [lng,lat], ... ]
    let hover:  number[] | null = null

    // ------------------------------------------------------------------
    // Source + layers (lazily created on first use)
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
                'fill-color':   COLOR_ACTIVE,
                'fill-opacity': 0.15,
            },
        } )

        map.addLayer( {
            id:     LINE_ID,
            type:   'line',
            source: SRC_ID,
            filter: [ 'in', [ 'geometry-type' ], [ 'literal', [ 'LineString', 'Polygon' ] ] ],
            paint:  {
                'line-color': [ 'case', [ '==', [ 'get', 'role' ], 'preview' ], COLOR_ACTIVE, COLOR_COMPLETE ],
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
                'circle-radius':       5,
                'circle-color':        '#ffffff',
                'circle-stroke-color': COLOR_ACTIVE,
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
    // Geometry rendering
    // ------------------------------------------------------------------
    function buildFC( withHover: boolean, finished: boolean ) {
        const fc = emptyFC()

        const live = withHover && hover ? points.concat( [ hover ] ) : points.slice()

        // Vertex points (committed only)
        points.forEach( ( p ) => {
            fc.features.push( { type: 'Feature', properties: { role: 'vertex' }, geometry: { type: 'Point', coordinates: p } } )
        } )

        if ( finished ) {
            if ( mode === 'area' && points.length >= 3 ) {
                const ring = points.concat( [ points[ 0 ] ] )
                fc.features.push( {
                    type: 'Feature',
                    properties: { role: 'final' },
                    geometry: { type: 'Polygon', coordinates: [ ring ] },
                } )
            } else if ( mode === 'distance' && points.length >= 2 ) {
                fc.features.push( {
                    type: 'Feature',
                    properties: { role: 'final' },
                    geometry: { type: 'LineString', coordinates: points },
                } )
            }
            return fc
        }

        if ( mode === 'area' && live.length >= 3 ) {
            const ring = live.concat( [ live[ 0 ] ] )
            fc.features.push( {
                type: 'Feature',
                properties: { role: 'preview' },
                geometry: { type: 'Polygon', coordinates: [ ring ] },
            } )
        } else if ( live.length >= 2 ) {
            fc.features.push( {
                type: 'Feature',
                properties: { role: 'preview' },
                geometry: { type: 'LineString', coordinates: live },
            } )
        }
        return fc
    }

    function refresh( finished?: boolean ) {
        setData( buildFC( !finished, !!finished ) )
        if ( !finished ) updateRunningResult()
    }

    function updateRunningResult() {
        const live = hover ? points.concat( [ hover ] ) : points
        const result: any = {}

        if ( mode === 'distance' && live.length > 1 ) {
            result.length = turf.length( turf.lineString( live ), { units: 'meters' } )
            result.count  = live.length
        } else if ( mode === 'area' && live.length > 2 ) {
            const ring = live.concat( [ live[ 0 ] ] )
            result.area   = turf.area( turf.polygon( [ ring ] ) )
            result.length = turf.length( turf.lineString( ring ), { units: 'meters' } )
            result.count  = live.length
        }

        displayResult( result )
    }

    function displayResult( res: any ) {
        self.results = []

        if ( !res.count ) return

        if ( mode === 'area' ) {
            self.showStatusMessage()
            self.results.push( { title: 'Number of edges', value: res.count } )
            if ( res.area )   self.results.push( { title: 'Area',      value: res.area,   dim: 2 } )
            if ( res.length ) self.results.push( { title: 'Perimeter', value: res.length, dim: 1 } )
        } else if ( mode === 'distance' ) {
            self.showStatusMessage()
            self.results.push( { title: 'Number of edges', value: res.count - 1 } )
            self.results.push( { title: 'Length',          value: res.length, dim: 1 } )
        }
    }

    // ------------------------------------------------------------------
    // Map event handlers (only attached while measuring)
    // ------------------------------------------------------------------
    function onClick( ev: any ) {
        if ( !active ) return
        // Suppress the viewer's queued pickedLocation (which would fire identify
        // and deactivate this tool).
        if ( smk.$viewer.clickTimeout ) {
            clearTimeout( smk.$viewer.clickTimeout )
            smk.$viewer.clickTimeout = null
        }
        const pt = [ ev.lngLat.lng, ev.lngLat.lat ]
        points.push( pt )

        if ( self.maxPoints != null && points.length >= self.maxPoints ) {
            finish()
            return
        }
        refresh()
    }

    function onMouseMove( ev: any ) {
        if ( !active ) return
        hover = [ ev.lngLat.lng, ev.lngLat.lat ]
        refresh()
    }

    function onDblClick( ev: any ) {
        if ( !active ) return
        // Prevent the default zoom-on-dblclick during measurement and suppress
        // the queued pickedLocation from the preceding single click.
        ev.preventDefault?.()
        if ( smk.$viewer.clickTimeout ) {
            clearTimeout( smk.$viewer.clickTimeout )
            smk.$viewer.clickTimeout = null
        }
        finish()
    }

    function finish() {
        if ( !active ) return

        if ( self.minPoints != null && points.length < self.minPoints ) {
            // Not enough points: bail out silently.
            return
        }

        const finalPoints = points.slice()
        const finalMode   = mode

        // Compute final totals from finalPoints (no hover)
        const result: any = { count: finalPoints.length }
        if ( finalMode === 'distance' && finalPoints.length > 1 ) {
            result.length = turf.length( turf.lineString( finalPoints ), { units: 'meters' } )
        } else if ( finalMode === 'area' && finalPoints.length > 2 ) {
            const ring = finalPoints.concat( [ finalPoints[ 0 ] ] )
            result.area   = turf.area( turf.polygon( [ ring ] ) )
            result.length = turf.length( turf.lineString( ring ), { units: 'meters' } )
        }

        // Render the final geometry (solid, no hover preview)
        hover = null
        refresh( true )
        displayResult( result )

        // Stop capturing
        teardownInput()
        active     = false
        self.busy  = false

        // Convert to {lat,lng} latlngs for parity with leaflet's emitted shape
        self.latlngs = finalPoints.map( ( p ) => ( { lat: p[ 1 ], lng: p[ 0 ] } ) )

        if ( finalMode === 'distance' ) {
            smk.emit( self.id, 'measure-distance', {
                count:  finalPoints.length,
                length: result.length,
                points: self.latlngs,
            } )
        } else if ( finalMode === 'area' ) {
            smk.emit( self.id, 'measure-area', {
                count:  finalPoints.length,
                length: result.length,
                area:   result.area,
                points: self.latlngs,
            } )
        }
    }

    // ------------------------------------------------------------------
    // Input wiring
    // ------------------------------------------------------------------
    let inputAttached = false
    let prevDblClickEnabled = false
    let prevCursor: string | undefined

    function setupInput() {
        if ( inputAttached ) return
        inputAttached = true

        // Suppress map's double-click zoom while measuring (enabled by ZoomTool)
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
        if ( prevCursor != null ) canvas.style.cursor = prevCursor
        else                      canvas.style.cursor = ''
    }

    // ------------------------------------------------------------------
    // Public lifecycle (matches the leaflet initializer's contract)
    // ------------------------------------------------------------------
    function startMeasurement( newMode: 'distance' | 'area', minPts: number ) {
        // Reset any prior state
        teardownInput()
        clearLayers()
        points  = []
        hover   = null
        mode    = newMode
        active  = true
        self.busy           = true
        self.results        = []
        self.measureDistance = newMode === 'distance'
        self.measureArea     = newMode === 'area'
        self.minPoints       = minPts
        self.maxPoints       = null

        self.showStatusMessage(
            newMode === 'distance' ? 'Click on map to set starting point' : 'Click on map to set first point',
            'progress',
        )

        setupInput()
    }

    function cancel() {
        teardownInput()
        clearLayers()
        points  = []
        hover   = null
        mode    = null
        active  = false
        self.busy            = false
        self.results         = []
        self.measureDistance = false
        self.measureArea     = false
        self.showStatusMessage( 'Select measurement method' )
    }

    this.changedActive( function () {
        if ( !self.active ) {
            // Tool deactivated — clear visuals and stop capturing.
            cancel()
        }
    } )

    smk.on( this.id, {
        'start-distance': () => startMeasurement( 'distance', 2 ),
        'start-area':     () => startMeasurement( 'area',     3 ),
        'cancel':         cancel,
    } )
} )
