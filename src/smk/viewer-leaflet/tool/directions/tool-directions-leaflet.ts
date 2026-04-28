import type { SmkInstance } from '../../viewer-leaflet'

declare const SMK: any
declare const L: any

SMK.TYPE.DirectionsWaypointsTool.addInitializer( function ( this: any, smk: SmkInstance ) {
    if ( ( smk as any ).$viewer.type !== 'leaflet' ) return

    const self = this

    this.changedGroup( function () {
        self.visible = self.group
    } )

    this.changedVisible( function () {
        if ( self.visible ) {
            if ( self.directionHighlightLayer )
                smk.$viewer.map.addLayer( self.directionHighlightLayer )

            if ( self.directionPickLayer )
                smk.$viewer.map.addLayer( self.directionPickLayer )
        }
        else {
            if ( self.directionHighlightLayer )
                smk.$viewer.map.removeLayer( self.directionHighlightLayer )

            if ( self.directionPickLayer )
                smk.$viewer.map.removeLayer( self.directionPickLayer )
        }
    } )

    function reset() {
        if ( self.directionHighlightLayer )
            smk.$viewer.map.removeLayer( self.directionHighlightLayer )
        self.directionHighlightLayer = null

        if ( self.directionPickLayer )
            smk.$viewer.map.removeLayer( self.directionPickLayer )
        self.directionPickLayer = null
    }

    smk.on( 'directions-route', {
        'hover-direction': function ( ev: any ) {
            if ( self.directionHighlightLayer ) {
                smk.$viewer.map.removeLayer( self.directionHighlightLayer )
                self.directionHighlightLayer = null
            }

            if ( ev.highlight == null ) return

            const p = self.directions[ ev.highlight ].point
            self.directionHighlightLayer = L.circleMarker( [ p[ 1 ], p[ 0 ] ] )
                .addTo( smk.$viewer.map )
        },

        'pick-direction': function ( ev: any ) {
            if ( self.directionPickLayer ) {
                smk.$viewer.map.removeLayer( self.directionPickLayer )
                self.directionPickLayer = null
            }

            if ( ev.pick == null ) return

            const p = self.directions[ ev.pick ].point
            self.directionPickLayer = L.circleMarker( [ p[ 1 ], p[ 0 ] ], { radius: 15 } )
                .addTo( smk.$viewer.map )

            zoomToPoint( p )
        },
    } )

    function zoomToPoint( point: number[], maxZoom?: number ) {
        const ll = L.latLng( point[ 1 ], point[ 0 ] )
        const bounds = L.latLngBounds( [ ll, ll ] )
        const padding = smk.$viewer.getPanelPadding( true )

        smk.$viewer.map
            .fitBounds( bounds, {
                paddingTopLeft:     padding.topLeft,
                paddingBottomRight: padding.bottomRight,
                maxZoom:            maxZoom || 15,
                animate:            true,
            } )
    }

    smk.on( this.id, {
        'clear': function () {
            reset()
        },

        'zoom-waypoint': function ( ev: any ) {
            zoomToPoint( [ ev.waypoint.longitude, ev.waypoint.latitude ] )
        },
    } )
} )
