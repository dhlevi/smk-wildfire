/**
 * tool-directions-maplibre — Directions/routing tool adapter for MapLibre viewer.
 *
 * The shared `tool-directions-waypoints` tool already contains routing logic
 * and renders the route through internal vector layers (which the
 * MapLibre vector adapter now handles).  This module only needs to wire viewer-side
 * presentation for the hover/pick highlights and the zoom-waypoint behaviour,
 * mirroring viewer-leaflet/tool/directions/tool-directions-leaflet.ts.
 */

import '../../../tool/directions/tool-directions-waypoints'
import { SMK } from '../../../smk-ref'

declare const maplibregl: any

const HIGHLIGHT_SOURCE = '_smk-directions-highlight'
const PICK_SOURCE      = '_smk-directions-pick'
const HIGHLIGHT_LAYER  = '_smk-directions-highlight-layer'
const PICK_LAYER       = '_smk-directions-pick-layer'

const smkRef = SMK

smkRef.TYPE.DirectionsWaypointsTool.addInitializer( function ( this: any, smk: any ) {
    if ( smk.$viewer.type !== 'maplibre' ) return

    const self = this
    const map  = smk.$viewer.map

    function emptyFC() { return { type: 'FeatureCollection', features: [] } }

    function ensureSourcesAndLayers() {
        if ( !map.getSource( HIGHLIGHT_SOURCE ) ) {
            map.addSource( HIGHLIGHT_SOURCE, { type: 'geojson', data: emptyFC() } )
            map.addLayer( {
                id:     HIGHLIGHT_LAYER,
                type:   'circle',
                source: HIGHLIGHT_SOURCE,
                paint: {
                    'circle-radius':       7,
                    'circle-color':        '#3388ff',
                    'circle-stroke-color': '#ffffff',
                    'circle-stroke-width': 2,
                    'circle-opacity':      0.9,
                },
            } )
        }
        if ( !map.getSource( PICK_SOURCE ) ) {
            map.addSource( PICK_SOURCE, { type: 'geojson', data: emptyFC() } )
            map.addLayer( {
                id:     PICK_LAYER,
                type:   'circle',
                source: PICK_SOURCE,
                paint: {
                    'circle-radius':       15,
                    'circle-color':        '#3388ff',
                    'circle-opacity':      0.25,
                    'circle-stroke-color': '#3388ff',
                    'circle-stroke-width': 2,
                },
            } )
        }
    }

    function setLayerVisible( id: string, visible: boolean ) {
        if ( !map.getLayer( id ) ) return
        map.setLayoutProperty( id, 'visibility', visible ? 'visible' : 'none' )
    }

    function setSourceData( sourceId: string, data: any ) {
        const src = map.getSource( sourceId )
        if ( src ) src.setData( data )
    }

    function pointFC( point: number[] ) {
        return {
            type:     'FeatureCollection',
            features: [ { type: 'Feature', geometry: { type: 'Point', coordinates: [ point[ 0 ], point[ 1 ] ] }, properties: {} } ],
        }
    }

    function whenStyleReady( fn: () => void ) {
        if ( map.isStyleLoaded() ) fn()
        else map.once( 'styledata', fn )
    }

    whenStyleReady( () => {
        ensureSourcesAndLayers()
        setLayerVisible( HIGHLIGHT_LAYER, !!self.visible )
        setLayerVisible( PICK_LAYER,      !!self.visible )
    } )

    this.changedGroup( function () {
        self.visible = self.group
    } )

    this.changedVisible( function () {
        whenStyleReady( () => {
            ensureSourcesAndLayers()
            setLayerVisible( HIGHLIGHT_LAYER, !!self.visible )
            setLayerVisible( PICK_LAYER,      !!self.visible )
            if ( !self.visible ) {
                setSourceData( HIGHLIGHT_SOURCE, emptyFC() )
                setSourceData( PICK_SOURCE,      emptyFC() )
            }
        } )
    } )

    function reset() {
        setSourceData( HIGHLIGHT_SOURCE, emptyFC() )
        setSourceData( PICK_SOURCE,      emptyFC() )
    }

    function zoomToPoint( point: number[], maxZoom?: number ) {
        const padding = smk.$viewer.getPanelPadding( true )
        map.fitBounds(
            [ [ point[ 0 ], point[ 1 ] ], [ point[ 0 ], point[ 1 ] ] ],
            {
                padding: {
                    top:    padding.topLeft.y,
                    left:   padding.topLeft.x,
                    bottom: padding.bottomRight.y,
                    right:  padding.bottomRight.x,
                },
                maxZoom: maxZoom || 15,
                animate: true,
            }
        )
    }

    smk.on( 'directions-route', {
        'hover-direction': function ( ev: any ) {
            whenStyleReady( () => {
                ensureSourcesAndLayers()
                if ( ev.highlight == null ) {
                    setSourceData( HIGHLIGHT_SOURCE, emptyFC() )
                    return
                }
                const p = self.directions[ ev.highlight ].point
                setSourceData( HIGHLIGHT_SOURCE, pointFC( p ) )
            } )
        },

        'pick-direction': function ( ev: any ) {
            whenStyleReady( () => {
                ensureSourcesAndLayers()
                if ( ev.pick == null ) {
                    setSourceData( PICK_SOURCE, emptyFC() )
                    return
                }
                const p = self.directions[ ev.pick ].point
                setSourceData( PICK_SOURCE, pointFC( p ) )
                zoomToPoint( p )
            } )
        },
    } )

    smk.on( this.id, {
        'clear': function () {
            reset()
        },

        'zoom-waypoint': function ( ev: any ) {
            zoomToPoint( [ ev.waypoint.longitude, ev.waypoint.latitude ] )
        },
    } )
} )
