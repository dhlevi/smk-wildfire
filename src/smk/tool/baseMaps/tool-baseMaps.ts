/**
 * tool-baseMaps — Base maps switcher tool.
 * Converted from tool/baseMaps/tool-baseMaps.js.
 */

import Tool from '../../tool'
import panelBaseMapsHtml from './panel-base-maps.html?raw'
import { SMK } from '../../smk-ref'

declare const Vue: any
declare const L: any

const smkRef = SMK

Vue.component( 'base-maps-widget', {
    extends: smkRef.COMPONENT.ToolWidgetBase,
} )

Vue.component( 'base-maps-panel', {
    extends: smkRef.COMPONENT.ToolPanelBase,
    template: panelBaseMapsHtml,
    props: [ 'current', 'basemaps', 'mapStyle' ],
} )

const factory = ( Tool as any ).define( 'BaseMapsTool',
    function ( this: any ) {
        smkRef.TYPE.ToolWidget.call( this, 'base-maps-widget' )
        smkRef.TYPE.ToolPanel.call( this, 'base-maps-panel' )
        this.defineProp( 'current' )
        this.defineProp( 'basemaps' )
        this.defineProp( 'mapStyle' )
        this.basemaps = []
        this.mapStyle = { width: '110px', height: '110px' }
    },
    function ( this: any, smk: any ) {
        const self = this

        this.basemaps = smk.$viewer.getBasemapIds()
            .map( function ( id: string ) {
                return smk.$viewer.getBasemapConfig( id )
            } )
            .filter( function ( config: any ) {
                if ( !self.choices || self.choices.length === 0 ) return !config.internal && !config.deprecated
                if ( self.choices.some( ( c: string ) => c.toLowerCase() === config.id ) ) return true
                if ( smk.viewer.baseMap.toLowerCase() === config.id ) return true
                return false
            } )
            .sort( ( a: any, b: any ) => a.order - b.order )
            .map( function ( config: any ) {
                if ( config.optionImageUrl ) {
                    return { id: config.id, title: config.title, optionImageUrl: config.optionImageUrl, update() {} }
                }

                let map: any
                return {
                    id: config.id,
                    title: config.title,
                    createContent( el: HTMLElement ) {
                        map = L.map( el, {
                            attributionControl: false,
                            zoomControl:        false,
                            dragging:           false,
                            keyboard:           false,
                            scrollWheelZoom:    false,
                            zoom:               10,
                            zoomSnap:           0,
                        } )
                        const bmLayers = smk.$viewer.createBasemapLayer( config.id )
                        map.addLayer( bmLayers[ 0 ] )
                    },
                    update() {
                        if ( !map ) return
                        const v = smk.$viewer.getView()
                        if ( !v ) return
                        map.invalidateSize()
                        map.setView( [ v.center.latitude, v.center.longitude ], v.zoom )
                    },
                }
            } )

        this.current = smk.viewer.baseMap

        this.changedActive( function () {
            if ( self.active ) {
                if ( self.showPanel === false ) {
                    smkRef.HANDLER.get( self.id, 'triggered' )( smk, self )
                } else {
                    smkRef.HANDLER.get( self.id, 'activated' )( smk, self )
                    Vue.nextTick( function () {
                        self.basemaps.forEach( ( bm: any ) => bm.update() )
                    } )
                }
            } else {
                smkRef.HANDLER.get( self.id, 'deactivated' )( smk, self )
            }
        } )

        smk.on( this.id, {
            'activate': function () {
                if ( !self.enabled ) return
                if ( self.showPanel === false ) {
                    self.active = false
                    const i = self.basemaps.findIndex( ( b: any ) => b.id === self.current )
                    setBasemap( self.basemaps[ ( i + 1 ) % self.basemaps.length ].id )
                }
            },
            'set-base-map': function ( ev: any ) {
                setBasemap( ev )
            },
        } )

        function setBasemap( basemapId: string ) {
            smk.$viewer.setBasemap( basemapId )
        }

        smk.$viewer.changedBaseMap( function ( ev: any ) {
            self.current = ev.baseMap
            const bm = self.basemaps.find( ( b: any ) => b.id === self.current )
            if ( bm ) {
                self.status = 'basemap-' + bm.id
                self.title  = 'Base Map: ' + bm.title
            }
        } )

        smk.$viewer.changedView( function () {
            if ( !self.active ) return
            self.basemaps.forEach( ( bm: any ) => bm.update() )
        } )

        smk.$viewer.setBasemap( smk.viewer.baseMap )
    }
)

smkRef.TYPE[ 'tool-baseMaps' ] = factory
export default factory
