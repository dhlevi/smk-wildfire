/**
 * tool-select-feature — Select feature detail tool (part of select composite).
 * Converted from tool/select/tool-select-feature.js.
 */

import Tool from '../../tool'

const smkRef = ( window as any ).SMK

const factory = ( Tool as any ).define( 'SelectFeatureTool',
    function ( this: any ) {
        smkRef.TYPE.ToolPanel.call( this, 'tool-panel-feature' )
        smkRef.TYPE.ToolPanelFeature.call( this, function ( smk: any ) { return smk.$viewer.selected } )

        this.parentId = 'SelectListTool'
    },
    function ( this: any, smk: any ) {
        const self = this

        let featureIds: string[] = []

        self.changedActive( function () {
            if ( self.active ) {
                smk.getToolById( 'SelectListTool' ).visible = true
                self.featureSet.highlight()
            } else {
                smk.getToolById( 'SelectListTool' ).visible = false
            }
        } )

        smk.on( this.id, {
            'zoom': function () {
                self.featureSet.zoomTo( featureIds[ self.resultPosition ] )
            },
            'move-previous': function () {
                self.featureSet.pick( featureIds[ ( self.resultPosition + self.resultCount - 1 ) % self.resultCount ] )
            },
            'move-next': function () {
                self.featureSet.pick( featureIds[ ( self.resultPosition + 1 ) % self.resultCount ] )
            },
        } )

        self.featureSet.addedFeatures( function () {
            self.resultCount = self.featureSet.getStats().featureCount
            featureIds = Object.keys( self.featureSet.featureSet )
        } )

        self.featureSet.removedFeatures( function () {
            self.resultCount = self.featureSet.getStats().featureCount
            featureIds = Object.keys( self.featureSet.featureSet )
        } )

        self.featureSet.clearedFeatures( function () {
            self.resultCount = 0
        } )

        self.featureSet.pickedFeature( function ( ev: any ) {
            if ( !ev.feature ) {
                self.feature = null
                self.layer   = null
                return
            }

            self.active = true

            const ly = smk.$viewer.layerId[ ev.feature.layerId ]
            self.layer = {
                id:         ev.feature.layerId,
                title:      ly.config.title,
                attributes: ly.config.attributes && ly.config.attributes.map( function ( at: any ) {
                    return { visible: at.visible, title: at.title, name: at.name, format: at.format, value: at.value }
                } ),
            }

            self.feature = {
                id:         ev.feature.id,
                title:      ev.feature.title,
                properties: Object.assign( {}, ev.feature.properties ),
            }

            self.setAttributeComponent( ly, ev.feature )

            self.resultPosition = featureIds.indexOf( ev.feature.id )
        } )
    }
)

smkRef.TYPE[ 'tool-select-feature' ] = factory
export default factory
