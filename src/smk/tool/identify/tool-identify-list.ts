/**
 * tool-identify-list — Identify list tool (part of identify composite).
 * Converted from tool/identify/tool-identify-list.js.
 */

import Tool from '../../tool'
import panelIdentifyHtml from './panel-identify.html?raw'
import { SMK } from '../../smk-ref'

declare const Vue: any
declare const turf: any

const smkRef = SMK

Vue.component( 'identify-widget', {
    extends: smkRef.COMPONENT.ToolWidgetBase,
} )

Vue.component( 'identify-panel', {
    extends: smkRef.COMPONENT.ToolPanelBase,
    template: panelIdentifyHtml,
    props: [ 'tool', 'layers', 'highlightId', 'command', 'radius', 'radiusUnit' ],
    methods: {
        formatNumber( value: number, fractionPlaces: number ) {
            const i = Math.floor( value )
            const f = value - i
            return i.toString() + f.toFixed( fractionPlaces ).substr( 1 )
        },
    },
} )

const factory = Tool.define( 'IdentifyListTool',
    function ( this: any ) {
        smkRef.TYPE.ToolWidget.call( this, 'identify-widget' )
        smkRef.TYPE.ToolPanel.call( this, 'identify-panel' )
        smkRef.TYPE.ToolInternalLayers.call( this )
        smkRef.TYPE.ToolFeatureList.call( this, function ( smk: any ) { return smk.$viewer.identified } )

        this.defineProp( 'tool' )
        this.defineProp( 'command' )
        this.defineProp( 'radius' )
        this.defineProp( 'radiusUnit' )

        this.tool       = {}
        this.command    = { select: true, radius: false, radiusUnit: false, nearBy: true }
        this.radius     = 5
        this.radiusUnit = 'px'

        // Internal layers required by ToolFeatureList (highlight) and identify (search area etc.)
        this.internalLayers.push(
            { id: 'highlight-polygon', style: { fill: true, stroke: true, fillColor: 'white', fillOpacity: 0.5, strokeColor: 'black', strokeWidth: 3, strokeOpacity: 0.8 } },
            { id: 'highlight-line',    style: { stroke: true, strokeColor: 'black', strokeWidth: 3, strokeOpacity: 0.8 } },
            { id: 'highlight-point',   style: { markerSize: [ 25, 41 ], markerOffset: [ 12, 41 ], shadowSize: [ 41, 41 ] } },
            { id: 'search-area',       style: { stroke: false, fill: true, fillColor: 'white', fillOpacity: 0.5 } },
            { id: 'search-border-1',   style: { strokeWidth: 6, strokeColor: 'black', strokeOpacity: 1, strokeCap: 'butt' } },
            { id: 'search-border-2',   style: { strokeWidth: 6, strokeColor: 'white', strokeOpacity: 1, strokeCap: 'butt' } },
            { id: 'location',          title: 'Identify Location', style: { markerSize: [ 40, 40 ], markerOffset: [ 20, 20 ] }, legend: { point: true } },
            { id: 'edit-search-area',  style: { strokeWidth: 3, strokeColor: 'red', strokeOpacity: 1 } },
        )
    },
    function ( this: any, smk: any ) {
        const self = this

        // Register the display context so setInternalLayerVisible can use it.
        // In the old AMD build this was done by tool-identify-config.js pushing
        // to SMK.CONFIG.viewer.displayContext; in the Vite/TS build we do it here.
        smk.$viewer.setDisplayContextItems( this.type, [ {
            id:         this.id,
            type:       'group',
            title:      this.title,
            isVisible:  false,
            isInternal: true,
            showItem:   false,
            items:      this.internalLayers.map( ( ly: any ) => ( { id: ly.id } ) ),
        } ] )

        // --- radius helpers ---------------------------------------------------

        this.getRadiusMeters = function ( location?: any ) {
            return smk.$viewer.distanceToMeters( self.radius, self.radiusUnit, location )
        }

        this.setRadiusMeters = function ( radiusMeters: number, location?: any ) {
            self.radius = smk.$viewer.distanceFromMeters( radiusMeters, self.radiusUnit, location )
        }

        this.bufferDistance = function () {
            return smk.$viewer.distanceToMeters( 20, 'px' )
        }

        // --- search-area geometry helpers -------------------------------------

        // Matches the JS API: makeSearchLocationCircle( radiusMeters?, steps? )
        // Uses this.searchLocation internally.
        this.makeSearchLocationCircle = function ( radiusMeters?: number, steps?: number ) {
            return turf.circle(
                [ self.searchLocation.map.longitude, self.searchLocation.map.latitude ],
                ( radiusMeters != null ? radiusMeters : self.getRadiusMeters( self.searchLocation ) ) / 1000,
                { steps: steps || 64 }
            )
        }

        this.closestPointOnBoundary = function ( latLng: any ) {
            if ( !self.searchArea ) return
            const ls = turf.polygonToLine( self.searchArea )
            const pt = turf.nearestPointOnLine( ls, [ latLng.lng, latLng.lat ] )
            return [ pt.geometry.coordinates[ 1 ], pt.geometry.coordinates[ 0 ] ]
        }

        this.displayEditSearchArea = function ( editArea?: any ) {
            self.clearInternalLayer( 'edit-search-area' )
            if ( editArea ) self.loadInternalLayer( 'edit-search-area', editArea )
        }

        this.displaySearchArea = function () {
            self.trackMouse = false
            if ( !self.searchLocation ) return

            self.searchArea = self.makeSearchLocationCircle()

            const borders: any[][] = [ [], [] ]
            turf.segmentEach( self.searchArea, function ( seg: any, _fi: any, _mfi: any, _gi: any, si: number ) {
                borders[ Math.trunc( ( si + 4 ) / 8 ) % 2 ].push( seg.geometry )
            } )

            self.setInternalLayerVisible( true )
            self.displayEditSearchArea()

            self.clearInternalLayer( 'search-area' )
            self.loadInternalLayer( 'search-area', self.searchArea )

            self.clearInternalLayer( 'search-border-1' )
            self.loadInternalLayer( 'search-border-1', turf.geometryCollection( borders[ 0 ] ) )

            self.clearInternalLayer( 'search-border-2' )
            self.loadInternalLayer( 'search-border-2', turf.geometryCollection( borders[ 1 ] ) )

            self.clearInternalLayer( 'location' )
            self.loadInternalLayer( 'location', turf.point( [ self.searchLocation.map.longitude, self.searchLocation.map.latitude ] ) )

            self.trackMouse = true
        }

        // --- identify flow ----------------------------------------------------

        this.identifyStarts = 0
        this.trackMouse     = false

        this.startIdentify = function ( location: any ) {
            if ( self.getRadiusMeters() < 0.1 ) {
                self.showStatusMessage( 'Identify radius must be > 0', 'warning' )
                self.busy = false
                self.searchArea = null
                self.searchLocation = null
                self.trackMouse = false
                if ( self.clearMarker ) self.clearMarker()
                self.setInternalLayerVisible( false )
                smk.$viewer.identifyFeatures()
                smk.$viewer.identified.clear()
                smk.$viewer.identified.pick()
                return Promise.resolve()
            }

            self.busy = true
            self.searchLocation = location
            self.showStatusMessage( 'Fetching features', 'progress', null )
            self.displaySearchArea()
            self.identifyStarts += 1
            if ( self.startedIdentify ) self.startedIdentify()

            const area = self.makeSearchLocationCircle( null, 16 )
            return smk.$viewer.identifyFeatures( location, area )
                .then( function () {
                    self.busy = false

                    if ( smk.$viewer.identified.isEmpty() ) {
                        smk.$sidepanel?.setExpand( 0 )
                        self.setInternalLayerVisible( false )
                        self.showStatusMessage( 'No features found', 'warning' )
                    } else {
                        self.active = true
                        const stat = smk.$viewer.identified.getStats()
                        let sub = smkRef.UTIL.grammaticalNumber( stat.layerCount, null, null, 'on {} layers' )
                        if ( sub !== '' ) sub = '<div>' + sub + '</div>'
                        self.showStatusMessage(
                            '<div>Identified ' + smkRef.UTIL.grammaticalNumber( stat.featureCount, null, 'a feature', '{} features' ) + '</div>' + sub
                        )
                        if ( stat.featureCount === 1 )
                            smk.$viewer.identified.pick( self.firstId )
                    }

                    if ( self.finishedIdentify ) self.finishedIdentify()
                } )
                .catch( function ( e: any ) {
                    console.warn( 'identify failed', e )
                    if ( e.discarded ) {
                        if ( self.identifyStarts === 1 ) self.showStatusMessage()
                        return
                    }
                    self.setInternalLayerVisible( false )
                    self.showStatusMessage( e.toString(), 'error' )
                } )
                .finally( function () {
                    self.identifyStarts -= 1
                } )
        }

        this.restartIdentify = function () {
            if ( self.searchLocation ) self.startIdentify( self.searchLocation )
        }

        // --- pick handlers ----------------------------------------------------

        // fallback handler if nothing else uses pick
        smk.$viewer.handlePick( 0, function ( location: any ) {
            return self.startIdentify( location )
                .then( function () { return true }, function () { return true } )
        } )

        smk.$viewer.handlePick( 2, function ( location: any ) {
            if ( !self.active ) return
            return self.startIdentify( location )
                .then( function () { return true }, function () { return true } )
        } )

        // --- group / visible -------------------------------------------------

        this.changedGroup( function () {
            if ( !self.group ) {
                self.busy = false
                self.searchArea = null
                self.searchLocation = null
                self.trackMouse = false
                self.setInternalLayerVisible( false )
                self.clearInternalLayer( 'search-area' )
                self.clearInternalLayer( 'search-border-1' )
                self.clearInternalLayer( 'search-border-2' )
                self.clearInternalLayer( 'location' )
                smk.$viewer.identifyFeatures()
                smk.$viewer.identified.clear()
                smk.$viewer.identified.pick()
            }
        } )

        this.changedVisible( function () {
            self.setInternalLayerVisible( self.visible )
        } )

        // --- events -----------------------------------------------------------

        smk.on( this.id, {
            'add-all': function () {
                const lyfts = self.layers.map( function ( ly: any ) {
                    return [ ly.id, ly.features.map( function ( ft: any ) {
                        return smk.$viewer.identified.get( ft.id )
                    } ) ]
                } )
                lyfts.forEach( function ( lf: any[] ) {
                    smk.$viewer.selected.add( lf[ 0 ], lf[ 1 ] )
                } )
            },
            'clear': function () {
                self.showStatusMessage( 'Click on map to identify features.' )
            },
            'swipe-up': function () {
                smk.$sidepanel?.setExpand( 2 )
            },
            'swipe-down': function () {
                smk.$sidepanel?.incrExpand( -1 )
            },
            'change': function ( ev: any ) {
                Object.assign( self, ev )
                self.restartIdentify()
            },
            'changeUnit': function ( ev: any ) {
                const d = self.getRadiusMeters()
                Object.assign( self, ev )
                self.setRadiusMeters( d )
            },
            'current-location': function () {
                self.busy = true
                self.showStatusMessage( 'Finding current location...', 'progress', null )
                return smk.$viewer.getCurrentLocation()
                    .then( function ( res: any ) {
                        self.busy = false
                        self.showStatusMessage()
                        return self.startIdentify( { map: res } )
                            .then( function () {
                                smk.$viewer.panToFeature( self.searchArea, true )
                            } )
                    } )
                    .catch( function () {
                        self.busy = false
                        self.showStatusMessage( 'Unable to get current location', 'error' )
                    } )
            },
        } )
    }
)

smkRef.TYPE[ 'tool-identify-list' ] = factory
export default factory
