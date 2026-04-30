/**
 * tool-layers — Layers panel tool.
 * Converted from tool/layers/tool-layers.js.
 */

import Tool from '../../tool'
import panelLayersHtml from './panel-layers.html?raw'
import layerDisplayHtml from './layer-display.html?raw'
import { SMK } from '../../smk-ref'

declare const Vue: any

const smkRef = SMK

Vue.component( 'layer-display', {
    mixins: [ smkRef.COMPONENT.ToolEmit ],
    template: layerDisplayHtml,
    props: {
        id:      { type: String },
        display: { type: Object },
        glyph:   { type: Object },
        inGroup: { type: Boolean, default: false },
    },
} )

Vue.component( 'layers-widget', {
    extends: smkRef.COMPONENT.ToolWidgetBase,
} )

Vue.component( 'layers-panel', {
    extends: smkRef.COMPONENT.ToolPanelBase,
    template: panelLayersHtml,
    props: [ 'contexts', 'allVisible', 'glyph', 'command', 'filter', 'legend' ],
} )

const factory = Tool.define( 'LayersTool',
    function ( this: any ) {
        smkRef.TYPE.ToolWidget.call( this, 'layers-widget' )
        smkRef.TYPE.ToolPanel.call( this, 'layers-panel' )

        this.defineProp( 'contexts' )
        this.defineProp( 'allVisible' )
        this.defineProp( 'glyph' )
        this.defineProp( 'command' )
        this.defineProp( 'filter' )
        this.defineProp( 'legend' )

        this.contexts   = []
        this.allVisible = true
        this.legend     = false
        this.command    = { allVisibility: true, filter: true, legend: true, themes: false }
        this.glyph      = { visible: 'check_box', hidden: 'check_box_outline_blank' }
    },
    function ( this: any, smk: any ) {
        const self = this

        self.changedActive( function () {
            if ( self.active ) {
                self.contexts = smk.$viewer.getDisplayContexts()
                smkRef.HANDLER.get( self.id, 'activated' )( smk, self )
            } else {
                smkRef.HANDLER.get( self.id, 'deactivated' )( smk, self )
            }
        } )

        smk.on( this.id, {
            'activate': function () {
                if ( !self.enabled ) return
                if ( !self.active ) return

                smk.$viewer.setDisplayContextLegendsVisible( true )

                if ( !self.legend ) Vue.nextTick( function () {
                    smk.$viewer.setDisplayContextLegendsVisible( false )
                } )
            },

            'change': function ( ev: any ) {
                Object.assign( self, ev )

                smk.$viewer.setDisplayContextLegendsVisible( self.legend )

                let re: RegExp
                if ( !self.filter || !self.filter.trim() ) {
                    re = /.*/
                } else {
                    const f = self.filter.trim()
                    re = new RegExp(
                        f.toLowerCase().split( /\s+/ ).map( ( part: string ) => '(?=.*' + part + ')' ).join( '' ),
                        'i'
                    )
                }
                smk.$viewer.displayContext.layers.setFilter( re )
            },

            'set-all-layers-visible': function ( ev: any ) {
                smk.$viewer.displayContext.layers.setItemVisible(
                    smk.$viewer.displayContext.layers.root.id, ev.visible, ev.deep
                )
            },

            'set-item-visible': function ( ev: any ) {
                smk.$viewer.displayContext.layers.setItemVisible( ev.id, ev.visible, ev.deep )
            },

            'layer-click': function ( ev: any ) {
                if ( ev.metadataUrl ) window.open( ev.metadataUrl, '_blank' )
            },

            'folder-click': function ( ev: any ) {
                smk.$viewer.setDisplayContextFolderExpanded( ev.id, !ev.isExpanded )
            },

            'group-click': function ( _ev: any ) {
                // no-op
            },

            'swipe-up': function ( _ev: any ) {
                smk.$sidepanel.setExpand( 2 )
            },

            'swipe-down': function ( _ev: any ) {
                smk.$sidepanel.incrExpand( -1 )
            },

            'pick-theme': function ( ev: any ) {
                ev.theme.layers.forEach( ( layerId: string ) => {
                    smk.$viewer.displayContext.layers.setItemVisible( layerId, true )
                } )
            },
        } )

        smk.$viewer.changedLayerVisibility( function () {
            self.allVisible = smk.$viewer.displayContext.layers.isItemVisible(
                smk.$viewer.displayContext.layers.root.id
            )
        } )

        smk.$viewer.startedLoading( function ( _ev: any ) {
            self.busy = true
        } )

        smk.$viewer.finishedLoading( function ( _ev: any ) {
            self.busy = false
        } )
    }
)

smkRef.TYPE[ 'tool-layers' ] = factory
export default factory
