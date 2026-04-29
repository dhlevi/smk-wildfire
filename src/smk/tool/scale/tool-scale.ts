/**
 * tool-scale — Scale indicator tool.
 * Converted from tool/scale/tool-scale.js.
 */

import Tool from '../../tool'
import scaleHtml from './scale.html?raw'
import { SMK } from '../../smk-ref'

declare const Vue: any

const smkRef = SMK

const factory = ( Tool as any ).define( 'ScaleTool',
    function ( this: any ) {
        this.defineProp( 'showFactor' )
        this.defineProp( 'showBar' )
        this.defineProp( 'showZoom' )
    },
    function ( this: any, smk: any ) {
        const self = this

        this.model = {
            scaleDenom:        null,
            rulerSectionWidth: null,
            rulerLength:       null,
            rulerUnit:         null,
            zoomLevel:         null,
        }

        this.vm = new Vue( {
            el:   smk.addToStatus( scaleHtml ),
            data: this.model,
        } )

        smk.$viewer.changedView( () => { self.refresh() } )

        this.refresh = function () {
            this.model.scaleDenom       = null
            this.model.rulerSectionWidth = null
            this.model.rulerLength      = null

            const view = smk.$viewer.getView()
            if ( !view ) return

            if ( this.showFactor !== false && view.scale )
                this.model.scaleDenom = view.scale

            if ( this.showZoom !== false )
                this.model.zoomLevel = view.zoom

            if ( this.showBar !== false && view.metersPerPixel ) {
                const rulerMM = rounded( 200 * view.metersPerPixel * 1000 )
                this.model.rulerSectionWidth = rulerMM / 1000 / view.metersPerPixel / 4

                const dist = appropriateUnit( rulerMM )
                this.model.rulerLength = dist.value
                this.model.rulerUnit   = dist.unit
            }
        }

        const firstDigit = [ null, 1, 2, 3, 5, 5, 5, 5, 10, 10 ]

        function rounded( s: number ) {
            const f = firstDigit[ 1 * ( parseInt( s + '' ) ) ] as number
            return f * Math.pow( 10, ( Math.floor( s ) + '' ).length - 1 )
        }

        function appropriateUnit( mm: number ) {
            if ( mm <= 500 * 1000 ) return { value: mm / 1000, unit: 'm' }
            return { value: mm / 1000 / 1000, unit: 'km' }
        }

        self.refresh()
    }
)

smkRef.TYPE[ 'tool-scale' ] = factory
export default factory
