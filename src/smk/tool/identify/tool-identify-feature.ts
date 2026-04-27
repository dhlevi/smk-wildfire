/**
 * tool-identify-feature — Identify feature detail tool (part of identify composite).
 * Converted from tool/identify/tool-identify-feature.js.
 */

import Tool from '../../tool'

declare const Vue: any

const smkRef = ( window as any ).SMK

const factory = ( Tool as any ).define( 'IdentifyFeatureTool',
    function ( this: any ) {
        smkRef.TYPE.ToolPanel.call( this, 'tool-panel-feature' )
        smkRef.TYPE.ToolPanelFeature.call( this, function ( smk: any ) { return smk.$viewer.identified } )

        this.parentId = 'IdentifyListTool'
    },
    function ( this: any, smk: any ) {
        const self = this

        let featureIds: string[] = []

        self.changedActive( function () {
            if ( self.active ) {
                self.featureSet.highlight()
                Vue.nextTick( function () {
                    smk.getToolById( self.parentId ).visible = true
                } )
            } else {
                self.featureSet.pick()
            }
        } )

        smk.on( this.id, {
            'zoom': function () {
                self.featureSet.zoomTo( featureIds[ self.resultPosition ] )
            },
            'select': function () {
                const f = self.featureSet.get( featureIds[ self.resultPosition ] )
                smk.$viewer.selected.add( f.layerId, [ f ] )
            },
            'directions': function () {
                smk.$tool.directions.active = true
                smk.$tool.directions.activating
                    .then( function () {
                        return smk.$tool.directions.startAtCurrentLocation()
                    } )
                    .then( function () {
                        return smkRef.UTIL.findNearestSite( {
                            latitude:  self.feature.geometry.coordinates[ 1 ],
                            longitude: self.feature.geometry.coordinates[ 0 ],
                        } )
                            .then( function ( site: any ) {
                                return smk.$tool.directions.addWaypoint( site )
                            } )
                            .catch( function ( err: any ) {
                                console.warn( err )
                                return smk.$tool.directions.addWaypoint()
                            } )
                    } )
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
                    return {
                        visible: at.visible,
                        title:   at.title,
                        name:    at.name,
                        format:  at.format,
                        value:   at.value,
                    }
                } ),
            }

            self.feature = {
                id:         ev.feature.id,
                title:      ev.feature.title,
                properties: Object.assign( {}, ev.feature.properties ),
            }

            self.setAttributeComponent( ly, ev.feature )

            self.resultPosition = featureIds.indexOf( ev.feature.id )

            smk.$viewer.panToFeature( ev.feature )
        } )

        self.featureSet.zoomToFeature( function ( ev: any ) {
            smk.$viewer.panToFeature( ev.feature, true )
        } )
    }
)

smkRef.TYPE[ 'tool-identify-feature' ] = factory
export default factory
