/**
 * tool-identify-leaflet — Leaflet initializer for IdentifyListTool (drag-radius resize).
 */

declare const L:    any
declare const turf: any

const smkRef = ( window as any ).SMK

smkRef.TYPE.IdentifyListTool.addInitializer( function ( this: any, smk: any ) {
    const self = this

    const lg = L.layerGroup().addTo( smk.$viewer.map )

    this.clearMarker = function () {
        lg.clearLayers()
    }

    let marker: any = null

    smk.$viewer.map.on( 'mousemove', function ( ev: any ) {
        if ( !self.trackMouse )        return
        if ( !self.searchLocation )    return
        if ( ev.originalEvent.buttons ) return

        const latLong = ev.target.layerPointToLatLng( ev.layerPoint )
        const distToLocation = turf.distance(
            [ self.searchLocation.map.longitude, self.searchLocation.map.latitude ],
            llToTurf( latLong ),
        ) * 1000

        if ( Math.abs( distToLocation - self.getRadiusMeters() ) < self.bufferDistance() ) {
            const pos = self.closestPointOnBoundary( latLong )

            if ( !marker ) {
                marker = L.marker( pos, {
                    icon: L.divIcon( {
                        className: 'smk-drag-handle',
                        iconSize:  [ 10, 10 ],
                        iconAnchor: [ 5, 5 ],
                    } ),
                    bubblingMouseEvents: true,
                    draggable: true,
                } )
                .on( 'dragstart', function () {
                    self.trackMouse = false
                    self.displayEditSearchArea( self.makeSearchLocationCircle( distToLocation ) )
                } )
                .on( 'drag', function ( ev: any ) {
                    const rad = turf.distance(
                        [ self.searchLocation.map.longitude, self.searchLocation.map.latitude ],
                        llToTurf( ev.latlng ),
                    ) * 1000
                    self.displayEditSearchArea( self.makeSearchLocationCircle( rad ) )
                } )
                .on( 'dragend', function ( ev: any ) {
                    self.setRadiusMeters( turf.distance(
                        [ self.searchLocation.map.longitude, self.searchLocation.map.latitude ],
                        llToTurf( ev.target.getLatLng() ),
                    ) * 1000 )
                    self.restartIdentify()
                } )

                lg.addLayer( marker )
            } else {
                marker.setLatLng( pos )
            }
        } else {
            if ( marker ) { marker.remove(); marker = null }
        }
    } )
} )

function llToTurf( ll: any ) {
    return [ ll.lng, ll.lat ]
}
