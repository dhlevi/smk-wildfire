/**
 * tool-directions-waypoints — Directions waypoints tool (main directions logic).
 * Converted from tool/directions/tool-directions-waypoints.js.
 */

import Tool from '../../tool'
import panelDirectionsHtml from './panel-directions.html?raw'
import { SMK } from '../../smk-ref'

declare const Vue: any
declare const turf: any

const smkRef = SMK

function close( w1: any, w2: any ) {
    if ( Math.abs( w1.latitude  - w2.latitude  ) > 1e-5 ) return false
    if ( Math.abs( w1.longitude - w2.longitude ) > 1e-5 ) return false
    return true
}

Vue.component( 'directions-widget', {
    extends: smkRef.COMPONENT.ToolWidgetBase,
} )

Vue.component( 'directions-panel', {
    extends: smkRef.COMPONENT.ToolPanelBase,
    template: panelDirectionsHtml,
    props: [ 'waypoints', 'hasRoute', 'optimal', 'geocoderService' ],
} )

const factory = ( Tool as any ).define( 'DirectionsWaypointsTool',
    function ( this: any ) {
        smkRef.TYPE.ToolWidget.call( this, 'directions-widget' )
        smkRef.TYPE.ToolPanel.call( this, 'directions-panel' )

        this.defineProp( 'waypoints' )
        this.defineProp( 'hasRoute' )
        this.defineProp( 'optimal' )
        this.defineProp( 'geocoderService' )
        this.defineProp( 'routePlannerService' )
        this.defineProp( 'activating' )
        this.defineProp( 'directions' )
        this.defineProp( 'segmentLayers' )
        this.defineProp( 'waypointLayers' )

        this.waypoints  = []
        this.hasRoute   = false
        this.activating = smkRef.UTIL.resolved()
        this.directions = []
    },
    function ( this: any, smk: any ) {
        const self = this

        this.routePanel   = smk.getToolById( 'DirectionsRouteTool' )
        this.routeOptions = smk.getToolById( 'DirectionsOptionsTool' )

        this.routePlanner = new smkRef.TYPE.RoutePlanner( this.routePlannerService )
        this.geocoder     = new smkRef.TYPE.Geocoder( this.geocoderService )

        this.changedActive( function () {
            if ( self.active ) self.optimal = self.routeOptions.optimal
        } )

        this.getCurrentLocation = function () {
            self.showStatusMessage( 'Finding current location...', 'progress', null )
            self.busy = true
            return smk.$viewer.getCurrentLocation().finally( function () {
                self.busy = false
                self.showStatusMessage()
            } )
        }

        smk.$viewer.handlePick( 2, function ( location: any ) {
            if ( !self.active ) return

            return self.geocoder.fetchNearestSite( location.map ).then( function ( site: any ) {
                self.active = true
                return self.activating.then( function () {
                    return self.addWaypoint( site )
                } )
            } )
            .catch( function ( err: any ) { console.debug( err ) } )
            .then( function () { return true } )
        } )

        smk.on( this.id, {
            'current-location': function () {
                self.addCurrentLocation().then( function () { self.findRoute() } )
            },
            'reverse': function () {
                self.waypoints.reverse()
                self.findRoute()
            },
            'clear': function () {
                self.resetWaypoints()
            },
            'hover-direction': function ( ev: any ) {
                self.directionHighlight = ev.highlight
            },
            'pick-direction': function ( ev: any ) {
                self.directionPick = ev.pick
            },
            'changed-waypoints': function () {
                self.findRoute()
            },
            'remove-waypoint': function ( ev: any ) {
                self.waypoints.splice( ev.index, 1 )
                self.hasRoute = self.waypoints.length > 1
                self.findRoute()
            },
            'new-waypoint': function ( ev: any ) {
                if ( ev.latitude ) self.addWaypoint( ev )
            },
            'route': function () {
                self.routePanel.active = true
            },
            'options': function () {
                self.routeOptions.active = true
            },
        } )

        this.layer = {}
        const groupItems: any[] = []

        ;( this.segmentLayers || [] ).concat( this.waypointLayers || [] ).forEach( function ( ly: any ) {
            ly.type       = 'vector'
            ly.isVisible  = true
            ly.isInternal = true

            const display = smk.$viewer.addLayer( ly )
            display.class = 'smk-inline-legend'

            groupItems.push( { id: display.id } )

            self.layer[ ly.id ] = smk.$viewer.layerId[ ly.id ]

            if ( ly.isDraggable )
                self.layer[ ly.id ].changedFeature( function ( ev: any ) {
                    self.updateWaypoint( ev.geojson.properties.index, ev.newPt )
                } )
        } )

        smk.$viewer.setDisplayContextItems( this.type, [ {
            id:         this.id,
            type:       'group',
            title:      this.title,
            isVisible:  false,
            isInternal: true,
            items:      groupItems,
        } ] )

        this.setInternalLayerVisible = function ( visible: boolean ) {
            smk.$viewer.displayContext[ self.type ].setItemVisible( self.id, visible )
        }

        this.handleRouteData = function ( data: any ) {
            if ( smkRef.HANDLER.has( self.id, 'route' ) )
                smkRef.HANDLER.get( self.id, 'route' )( smk, data )
        }
    },
    {
        addWaypoint( this: any, site: any ) {
            if ( !site )
                return this.showStatusMessage( 'Unable to get location', 'error', 1000 )

            const top = this.waypoints[ this.waypoints.length - 1 ]
            if ( top && close( top, site ) )
                return this.showStatusMessage( 'Location too close to previous one', 'error', 1000 )

            if ( !site.fullAddress )
                this.showStatusMessage( 'Unable to find address for location', 'error', 1000 )

            this.waypoints.push( site )
            return this.findRoute()
        },

        addCurrentLocation( this: any ) {
            const self = this
            return self.getCurrentLocation()
                .then( function ( res: any ) { return self.addWaypoint( res ) } )
                .catch( function () { return self.showStatusMessage( 'Unable to get current location', 'error', 1000 ) } )
        },

        updateWaypoint( this: any, index: number, newPt: any ) {
            const self = this
            this.active = true
            return this.geocoder.fetchNearestSite( newPt ).then( function ( site: any ) {
                self.waypoints[ index ] = site
                return self.findRoute()
            } )
        },

        resetWaypoints( this: any ) {
            this.waypoints = []
            this.hasRoute  = false
            return this.findRoute()
        },

        findRoute( this: any ) {
            const self = this

            this.directions        = []
            this.directionHighlight = null
            this.directionPick     = null
            this.showStatusMessage()
            this.clearLayers()

            const points = this.waypoints.map( function ( w: any, i: number ) {
                return { index: i, latitude: w.latitude, longitude: w.longitude }
            } )

            if ( points.length < 2 ) {
                self.handleRouteData()
                self.displayWaypoints()
                this.showStatusMessage( 'Add a waypoint' )
                return smkRef.UTIL.resolved()
            }

            this.showStatusMessage( 'Constructing route...', 'progress', null )
            this.busy     = true
            this.hasRoute = false

            const opt = {
                criteria:              this.routeOptions.criteria,
                roundTrip:             this.routeOptions.roundTrip,
                optimal:               this.routeOptions.optimal,
                truck:                 this.routeOptions.truck,
                followTruckRoute:      !!this.routeOptions.truck,
                truckRouteMultiplier:  this.routeOptions.truck && this.routeOptions.truckRoute,
                height:                this.routeOptions.truck && this.routeOptions.truckHeight,
                weight:                this.routeOptions.truck && this.routeOptions.truckWeight,
                oversize:              this.routeOptions.oversize,
            }

            return this.routePlanner.fetchDirections( points, opt )
                .then( function ( data: any ) {
                    self.handleRouteData( data )
                    self.displaySegments( data.segments )

                    if ( data.visitOrder && data.visitOrder.findIndex( function ( v: number, i: number ) {
                        return points[ v ].index !== i
                    } ) !== -1 ) {
                        self.waypoints = data.visitOrder.map( function ( v: number ) {
                            return self.waypoints[ points[ v ].index ]
                        } )
                    }

                    self.displayWaypoints()
                    self.showStatusMessage( 'Route travels ' + data.distance + ' km in ' + data.timeText, 'summary' )
                    self.hasRoute = true
                    self.directions = data.directions
                    self.directionsRaw = data
                    self.directionsRaw.waypoints = JSON.parse( JSON.stringify( self.waypoints ) )
                } )
                .catch( function ( err: any ) {
                    console.debug( err )
                    self.showStatusMessage( 'Unable to find route', 'error' )
                    self.displayWaypoints()
                } )
                .finally( function () { self.busy = false } )
        },

        clearLayers( this: any ) {
            const self = this
            this.setInternalLayerVisible( false )
            Object.keys( this.layer ).forEach( function ( id: string ) { self.layer[ id ].clear() } )
        },

        displaySegments( this: any, segments: any ) {
            const self = this
            this.setInternalLayerVisible( true )

            const fc: Record<string, any[]> = {}
            segments.features.forEach( function ( sg: any ) {
                const ly = sg.properties[ '@layer' ] || '@segments'
                if ( !fc[ ly ] ) fc[ ly ] = []
                fc[ ly ].push( sg )
            } )

            Object.keys( fc ).forEach( function ( ly: string ) {
                if ( !self.layer[ ly ] ) { console.warn( 'no layer defined for ' + ly ); return }
                self.layer[ ly ].load( turf.featureCollection( fc[ ly ] ) )
                fc[ ly ].forEach( function ( sg: any ) { sg.style = self.layer[ ly ].config.style } )
            } )
        },

        displayWaypoints( this: any ) {
            const wl = this.waypoints.length

            if ( wl > 0 ) this.layer[ '@waypoint-start' ].load( waypointGeom( this.waypoints[ 0 ], 0 ) )
            if ( wl > 1 ) this.layer[ '@waypoint-end' ].load( waypointGeom( this.waypoints[ wl - 1 ], wl - 1 ) )
            if ( wl > 2 ) {
                this.layer[ '@waypoint-middle' ].load( turf.featureCollection(
                    this.waypoints.slice( 1, wl - 1 ).map( function ( wp: any, i: number ) {
                        return waypointGeom( wp, 1 + i )
                    } )
                ) )
            }

            this.setInternalLayerVisible( wl > 0 )

            function waypointGeom( wp: any, index: number ) {
                return turf.point( [ wp.longitude, wp.latitude ], { index } )
            }
        },
    }
)

smkRef.TYPE[ 'tool-directions-waypoints' ] = factory
export default factory
