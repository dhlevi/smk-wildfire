/**
 * tool-search-location — Search location detail tool (part of search composite).
 * Converted from tool/search/tool-search-location.js.
 */

import Tool from '../../tool'
import panelSearchLocationHtml from './panel-search-location.html?raw'
import locationTitleHtml from './location-title.html?raw'
import locationAddressHtml from './location-address.html?raw'

declare const Vue: any

const smkRef = ( window as any ).SMK

Vue.component( 'search-location-panel', {
    extends: smkRef.COMPONENT.ToolPanelBase,
    template: panelSearchLocationHtml,
    props: [ 'feature', 'tool', 'command', 'locationComponent' ],
} )

const factory = ( Tool as any ).define( 'SearchLocationTool',
    function ( this: any ) {
        smkRef.TYPE.ToolPanel.call( this, 'search-location-panel' )

        this.defineProp( 'feature' )
        this.defineProp( 'tool' )
        this.defineProp( 'command' )
        this.defineProp( 'locationComponent' )

        this.feature          = {}
        this.tool             = {}
        this.command          = {}
        this.locationComponent = {}

        this.parentId = 'SearchListTool'
    },
    function ( this: any, smk: any ) {
        const self = this

        this.tool = smk.getToolTypesAvailable()

        self.changedActive( function () {
            if ( self.active )
                smk.$viewer.searched.highlight()
            else
                smk.$viewer.searched.pick()
        } )

        smk.on( this.id, {
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
        } )

        smk.$viewer.searched.pickedFeature( function ( ev: any ) {
            self.locationComponent = {
                name:     'location',
                template: locationAddressHtml,
                data() { return { feature: ev.feature } },
            }

            self.titleComp = {
                name:     'location-title',
                template: locationTitleHtml,
                data() { return Object.assign( { intersectionName: null }, ev.feature && ev.feature.properties ) },
            }

            if ( ev.feature && self.showLocation ) {
                self.active = true
            }
        } )
    }
)

smkRef.TYPE[ 'tool-search-location' ] = factory
export default factory
