/**
 * tool-directions-esri3d — Directions/routing tool for ESRI 3D viewer.
 * Converted from viewer-esri3d/tool/directions/tool-directions-esri3d.js.
 */

const smkRef = ( window as any ).SMK

// Patches DirectionsWaypointsTool (not DirectionsTool — that name never existed;
// Leaflet equivalent uses DirectionsWaypointsTool.addInitializer)
smkRef.TYPE.DirectionsWaypointsTool.addInitializer( function ( this: any, smk: any ) {
    if ( !smk.$viewer.view ) return   // not an esri3d viewer

    const self = this
    const E    = smkRef.TYPE.Esri3d

    const base = ( smkRef.option && smkRef.option.baseUrl ? smkRef.option.baseUrl : '' ) + 'images/tool/directions'

    const redSymbol = {
        type: 'point-3d',
        symbolLayers: [
            { type: 'icon', size: '41px', anchor: 'bottom', resource: { href: base + '/marker-shadow.png' } },
            { type: 'icon', size: '41px', anchor: 'bottom', resource: { href: base + '/marker-icon-red.png' } },
        ],
    }

    const greenSymbol = {
        type: 'point-3d',
        symbolLayers: [
            { type: 'icon', size: '41px', anchor: 'bottom', resource: { href: base + '/marker-shadow.png' } },
            { type: 'icon', size: '41px', anchor: 'bottom', resource: { href: base + '/marker-icon-green.png' } },
        ],
    }

    const blueSymbol = {
        type: 'point-3d',
        symbolLayers: [
            { type: 'icon', size: '41px', anchor: 'bottom', resource: { href: base + '/marker-shadow.png' } },
            { type: 'icon', size: '41px', anchor: 'bottom', resource: { href: base + '/marker-icon-hole.png' } },
        ],
    }

    self.directionsLayer = new E.layers.GraphicsLayer( { visible: false } )
    smk.$viewer.map.add( self.directionsLayer )

    this.changedActive(  () => { self.visible = self.active } )
    this.changedVisible( () => { self.directionsLayer.visible = self.visible } )

    smk.$viewer.handlePick( 3, function ( location: any ) {
        if ( !self.active ) return
        return smk.$viewer.view.hitTest( location.screen )
            .then( function ( hit: any ) {
                if ( hit.results.length === 0 ) return
                if ( !hit.results[ 0 ].graphic ) return
                return true
            } )
    } )

    const styleRoute = smkRef.UTIL.smkStyleToEsriSymbol( {
        strokeColor:   '#0000FF',
        strokeOpacity: 0.5,
        strokeWidth:   7,
    } )
    const styleRouteFn = ( type: string ) => styleRoute[ type ]

    this.displayRoute = function ( points: any[] ) {
        reset()
        if ( !points ) return

        const geojson = { type: 'Feature', geometry: { type: 'LineString', coordinates: points } }
        self.routeGraphic = new E.Graphic( smkRef.UTIL.geoJsonToEsriGeometry( geojson, styleRouteFn )[ 0 ] )
        self.directionsLayer.add( self.routeGraphic )
        smk.$viewer.view.goTo( self.routeGraphic )
    }

    this.displayWaypoints = function () {
        const last = self.waypoints.length - 1
        self.waypointGraphics = self.waypoints.map( function ( w: any, i: number ) {
            let symbol: any
            const popup = Object.assign( { index: i }, w )

            if ( i === 0 )    { symbol = greenSymbol; popup.first = true }
            else if ( i === last ) { symbol = redSymbol;   popup.last  = true }
            else                   { symbol = blueSymbol }

            return new E.Graphic( {
                geometry:   { type: 'point', latitude: w.latitude, longitude: w.longitude },
                symbol,
                attributes: popup,
            } )
        } )

        self.directionsLayer.addMany( self.waypointGraphics )
    }

    function reset() {
        self.directionsLayer.removeAll()
    }

    smk.on( 'directions-route', {
        'hover-direction': function ( ev: any ) {
            self.directionsLayer.remove( self.highlightGraphic )
            if ( ev.highlight == null ) return

            const p = self.directions[ ev.highlight ].point
            self.highlightGraphic = new E.Graphic( {
                geometry: { type: 'point', latitude: p[ 1 ], longitude: p[ 0 ] },
                symbol:   { type: 'point-3d', symbolLayers: [ { type: 'icon', size: '20px', anchor: 'center', material: { color: [ 0, 0, 0, 0 ] }, resource: { primitive: 'circle' }, outline: { color: 'blue', size: '2px' } } ] },
            } )
            self.directionsLayer.add( self.highlightGraphic )
        },

        'pick-direction': function ( ev: any ) {
            self.directionsLayer.remove( self.pickGraphic )
            if ( ev.pick == null ) return

            const p = self.directions[ ev.pick ].point
            self.pickGraphic = new E.Graphic( {
                geometry: { type: 'point', latitude: p[ 1 ], longitude: p[ 0 ] },
                symbol:   { type: 'point-3d', symbolLayers: [ { type: 'icon', size: '30px', anchor: 'center', material: { color: [ 0, 0, 0, 0 ] }, resource: { primitive: 'circle' }, outline: { color: 'blue', size: '2px' } } ] },
            } )
            self.directionsLayer.add( self.pickGraphic )
            smk.$viewer.view.goTo( { center: p, zoom: 12 } )
        },
    } )

    smk.on( this.id, {
        'clear': () => reset(),

        'zoom-waypoint': function ( ev: any ) {
            const w = ev.waypoint
            smk.$viewer.view.goTo( { center: [ w.longitude, w.latitude ], zoom: 12 } )
        },
    } )
} )
