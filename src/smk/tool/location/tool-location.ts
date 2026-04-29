/**
 * tool-location — Location / geocoder tool.
 * Converted from tool/location/tool-location.js.
 */

import Tool from '../../tool'
import panelLocationHtml from './panel-location.html?raw'
import { SMK } from '../../smk-ref'

declare const Vue: any

const smkRef = SMK

Vue.component( 'location-widget', {
    extends: smkRef.COMPONENT.ToolWidgetBase,
} )

Vue.component( 'location-panel', {
    extends: smkRef.COMPONENT.ToolPanelBase,
    template: panelLocationHtml,
    props: [ 'feature', 'tool', 'command', 'locationComponent', 'titleComp' ],
} )

const factory = ( Tool as any ).define( 'LocationTool',
    function ( this: any ) {
        smkRef.TYPE.ToolPanel.call( this, 'location-panel' )
        smkRef.TYPE.ToolInternalLayers.call( this )

        this.internalLayers.push(
            { id: 'location', style: { markerSize: [ 25, 41 ], markerOffset: [ 12, 41 ], shadowSize: [ 41, 41 ] }, legend: { point: true } },
        )

        this.defineProp( 'feature' )
        this.defineProp( 'tool' )
        this.defineProp( 'command' )
        this.defineProp( 'locationComponent' )
        this.defineProp( 'titleComp' )

        this.feature = {}
        this.tool = {}
        this.command = {}
        this.locationComponent = {}
        this.titleComp = {}
    },
    function ( this: any, smk: any ) {
        const self = this

        this.tool = smk.getToolTypesAvailable()

        smk.$viewer.handlePick( 1, function ( location: any ) {
            if ( !self.enabled ) return

            self.active = true

            self.clearInternalLayer( 'location' )

            self.feature = {
                geometry: { type: 'Point', coordinates: [ location.map.longitude, location.map.latitude ] },
                properties: location.map,
            }

            return true
        } )
    }
)

smkRef.TYPE[ 'tool-location' ] = factory
export default factory
