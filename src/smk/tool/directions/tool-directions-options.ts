/**
 * tool-directions-options — Directions options panel tool.
 * Converted from tool/directions/tool-directions-options.js.
 */

import Tool from '../../tool'
import panelDirectionsOptionsHtml from './panel-directions-options.html?raw'
import { SMK } from '../../smk-ref'

declare const Vue: any

const smkRef = SMK

Vue.component( 'directions-options-panel', {
    extends: smkRef.COMPONENT.ToolPanelBase,
    template: panelDirectionsOptionsHtml,
    props: {
        truck:          Boolean,
        optimal:        Boolean,
        roundTrip:      Boolean,
        criteria:       String,
        truckRoute:     Number,
        truckHeight:    Number,
        truckWidth:     Number,
        truckLength:    Number,
        truckWeight:    Number,
        truckHeightUnit:Number,
        truckWidthUnit: Number,
        truckLengthUnit:Number,
        truckWeightUnit:Number,
        oversize:       Boolean,
        command:        Object,
        bespoke:        Object,
    },
    methods: {
        fromUnit( val: number, unit: number ) { return val * unit },
        toUnit( val: number, unit: number )   { return val / unit },
        formatNumber( value: number, fractionPlaces: number ) {
            const i = Math.floor( value )
            const f = value - i
            return i.toString() + f.toFixed( fractionPlaces ).substr( 1 )
        },
    },
} )

function positiveFloat( newVal: any, oldVal: any ) {
    const i = parseFloat( newVal )
    if ( !newVal || !i ) return null
    if ( i < 0 ) return oldVal
    return i
}

const factory = Tool.define( 'DirectionsOptionsTool',
    function ( this: any ) {
        smkRef.TYPE.ToolPanel.call( this, 'directions-options-panel' )

        this.defineProp( 'truck' )
        this.defineProp( 'optimal' )
        this.defineProp( 'roundTrip' )
        this.defineProp( 'criteria' )
        this.defineProp( 'truckRoute' )
        this.defineProp( 'truckHeight',     { validate: positiveFloat } )
        this.defineProp( 'truckWidth',      { validate: positiveFloat } )
        this.defineProp( 'truckLength',     { validate: positiveFloat } )
        this.defineProp( 'truckWeight',     { validate: positiveFloat } )
        this.defineProp( 'truckHeightUnit' )
        this.defineProp( 'truckWidthUnit' )
        this.defineProp( 'truckLengthUnit' )
        this.defineProp( 'truckWeightUnit' )
        this.defineProp( 'oversize' )
        this.defineProp( 'command' )
        this.defineProp( 'bespoke' )

        this.truck          = false
        this.optimal        = false
        this.roundTrip      = false
        this.criteria       = 'shortest'
        this.truckRoute     = null
        this.truckHeight    = null
        this.truckWidth     = null
        this.truckLength    = null
        this.truckWeight    = null
        this.truckHeightUnit  = 1
        this.truckWidthUnit   = 1
        this.truckLengthUnit  = 1
        this.truckWeightUnit  = 1
        this.oversize       = false
        this.command        = {}
        this.bespoke        = {}

        this.parentId = 'DirectionsWaypointsTool'
    },
    function ( this: any, smk: any ) {
        const self = this

        const directions = smk.getToolById( this.parentId )

        const findRouteDelayed = smkRef.UTIL.makeDelayedCall( function () {
            directions.findRoute()
        } )

        smk.on( this.id, {
            'change': function ( ev: any, comp: any ) {
                Object.assign( self, ev )
                comp.$forceUpdate()
                findRouteDelayed()
            },
        } )

        smk.$viewer.handlePick( 3, function () {
            if ( !self.active ) return
            directions.active = true
            return false
        } )

        this.bespoke.create = function ( el: any ) {
            smkRef.HANDLER.get( self.id, 'activated' )( smk, self, el )
        }
    }
)

smkRef.TYPE[ 'tool-directions-options' ] = factory
export default factory
