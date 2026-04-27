/**
 * tool-query-feature — Query feature detail tool (part of query composite).
 * Converted from tool/query/tool-query-feature.js.
 */

import Tool from '../../tool'

declare const Vue: any

const smkRef = ( window as any ).SMK

const factory = ( Tool as any ).define( 'QueryFeatureTool',
    function ( this: any ) {
        smkRef.TYPE.ToolPanel.call( this, 'tool-panel-feature' )
        smkRef.TYPE.ToolPanelFeature.call( this, function ( smk: any ) { return smk.$viewer.queried[ ( this as any ).instance ] } )

        this.parentId = 'QueryResultsTool'
    },
    function ( this: any, smk: any ) {
        const self = this

        this.title = smk.$viewer.query[ this.instance ].title

        let featureIds: string[] = []

        self.changedActive( function () {
            if ( self.active ) {
                self.featureSet.highlight()
                Vue.nextTick( function () {
                    smk.getToolById( self.parentId ).visible = true
                    if ( self.command.zoom === false )
                        self.featureSet.zoomTo( featureIds[ self.resultPosition ] )
                } )
            } else {
                self.featureSet.pick()
            }
        } )

        smk.on( this.id, {
            'previous-panel': function () {
                self.featureSet.pick()
            },
            'zoom': function () {
                self.featureSet.zoomTo( featureIds[ self.resultPosition ] )
            },
            'select': function () {
                const f = self.featureSet.get( featureIds[ self.resultPosition ] )
                smk.$viewer.selected.add( f.layerId, [ f ] )
            },
            'directions': console.log,
            'move-previous': function () {
                self.featureSet.pick( featureIds[ ( self.resultPosition + self.resultCount - 1 ) % self.resultCount ] )
                if ( self.command.zoom === false )
                    self.featureSet.zoomTo( featureIds[ self.resultPosition ] )
            },
            'move-next': function () {
                self.featureSet.pick( featureIds[ ( self.resultPosition + 1 ) % self.resultCount ] )
                if ( self.command.zoom === false )
                    self.featureSet.zoomTo( featureIds[ self.resultPosition ] )
            },
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

            self.resultCount    = self.featureSet.getStats().featureCount
            self.resultPosition = featureIds.indexOf( ev.feature.id )

            if ( self.command.zoom !== false ) smk.$viewer.panToFeature( ev.feature )
        } )

        self.featureSet.addedFeatures( function () {
            featureIds = Object.keys( self.featureSet.featureSet )
        } )
    }
)

smkRef.TYPE[ 'tool-query-feature' ] = factory
export default factory
