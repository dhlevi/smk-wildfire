/**
 * tool-search-list — Search list tool (part of search composite).
 * Converted from tool/search/tool-search-list.js.
 */

import Tool from '../../tool'
import widgetSearchHtml from './widget-search.html?raw'
import panelSearchHtml from './panel-search.html?raw'

declare const Vue: any
declare const turf: any

const smkRef = ( window as any ).SMK

const precisionZoom: Record<string, number> = {
    INTERSECTION:  15,
    STREET:        13,
    BLOCK:         14,
    CIVIC_NUMBER:  15,
    _OTHER_:       12,
}

let request: any

function doAddressSearch( text: string ) {
    if ( request ) request.abort()

    const query = {
        ver:           1.2,
        maxResults:    10,
        outputSRS:     4326,
        addressString: text,
        autoComplete:  true,
    }

    return smkRef.UTIL.resolved()
        .then( function () {
            const ctrl = new AbortController()
            const timer = setTimeout( function () { ctrl.abort() }, 10 * 1000 )
            request = { abort: function () { ctrl.abort() } }

            const qs = new URLSearchParams( query as any ).toString()
            return fetch( 'https://geocoder.api.gov.bc.ca/addresses.geojson?' + qs, { signal: ctrl.signal } )
                .then( function ( r ) {
                    if ( !r.ok ) throw new Error( 'geocoder failed: ' + r.status )
                    return r.json()
                } )
                .finally( function () { clearTimeout( timer ) } )
        } )
        .then( function ( data: any ) {
            return ( data.features as any[] )
                .map( function ( feature: any ) {
                    if ( !feature.geometry.coordinates ) return null
                    if ( feature.properties.fullAddress === 'BC' ) return null

                    if ( feature.properties.intersectionName ) {
                        feature.title = feature.properties.intersectionName
                    } else if ( feature.properties.streetName ) {
                        feature.title = [
                            feature.properties.civicNumber,
                            feature.properties.streetName,
                            feature.properties.streetQualifier,
                            feature.properties.streetType,
                        ].filter( Boolean ).join( ' ' )
                    } else if ( feature.properties.localityName ) {
                        feature.title = feature.properties.localityName
                    }

                    return feature
                } )
                .filter( Boolean )
        } )
}

Vue.component( 'search-widget', {
    extends: smkRef.COMPONENT.ToolWidgetBase,
    template: widgetSearchHtml,
    props: [ 'initialSearch', 'results', 'highlightId', 'showPanel' ],
    data() { return { search: null } },
    watch: {
        initialSearch( val: string ) { ( this as any ).search = val },
    },
    computed: {
        classes( this: any ) {
            const c: Record<string, boolean> = {}
            c[ 'smk-' + this.type + '-tool' ] = true
            return Object.assign( c, {
                'smk-tool-active':   this.active,
                'smk-tool-visible':  this.visible,
                'smk-tool-enabled':  this.enabled,
            } )
        },
    },
    methods: {
        widgetWidth( this: any ) { return this.$refs.widget.clientWidth },
        focus( this: any ) {
            const inp = this.$refs[ 'search-input' ]
            if ( !this.active ) inp.focus()
            inp.setSelectionRange( 0, 0 )
            inp.setSelectionRange( 0, inp.value.length )
        },
        isEmpty( this: any ) { return !this.results || this.results.length === 0 },
    },
} )

Vue.component( 'search-panel', {
    extends: smkRef.COMPONENT.ToolPanelBase,
    template: panelSearchHtml,
    props: [ 'results', 'highlightId' ],
    methods: {
        isEmpty( this: any ) { return !this.results || this.results.length === 0 },
    },
    data() { return { search: null } },
} )

const factory = ( Tool as any ).define( 'SearchListTool',
    function ( this: any ) {
        smkRef.TYPE.ToolWidget.call( this, 'search-widget' )
        smkRef.TYPE.ToolPanel.call( this, 'search-panel' )
        smkRef.TYPE.ToolInternalLayers.call( this )

        this.internalLayers.push(
            { id: 'result-selected',  title: 'Selected Search Result',     style: { markerSize: [ 25, 41 ], markerOffset: [ 12, 41 ], shadowSize: [ 41, 41 ] }, legend: { point: true } },
            { id: 'result-highlight', title: 'Highlighted Search Result',   style: { markerSize: [ 40, 36 ], markerOffset: [ 20, 18 ], shadowSize: [ 31, 31 ] } },
            { id: 'results',          title: 'Search Results',              style: { markerSize: [ 25, 41 ], markerOffset: [ 12, 41 ], shadowSize: [ 41, 41 ] }, legend: { point: true } },
        )

        this.defineProp( 'results' )
        this.defineProp( 'highlightId' )
        this.defineProp( 'initialSearch' )

        this.results = []
    },
    function ( this: any, smk: any ) {
        const self = this

        smk.$container.classList.add( 'smk-tool-search' )

        this.changedActive( function () {
            if ( self.active )
                smkRef.HANDLER.get( self.id, 'activated' )( smk, self )
            else
                smkRef.HANDLER.get( self.id, 'deactivated' )( smk, self )
        } )

        this.changedGroup( function () {
            self.visible = self.group
        } )

        this.changedVisible( function () {
            self.setInternalLayerVisible( self.visible )
        } )

        smk.on( this.id, {
            'activate': function ( ev: any ) {
                if ( !ev.toggle ) self.active = true
            },

            'input-change': function ( ev: any ) {
                smk.$viewer.searched.clear()
                self.busy = true
                doAddressSearch( ev.text )
                    .then( function ( features: any[] ) {
                        self.active = true
                        smk.$viewer.searched.add( 'search', features, 'fullAddress' )
                        self.busy = false
                    } )
                    .catch( function ( e: any ) {
                        console.warn( 'search failure:', e )
                    } )
            },

            'hover': function ( ev: any ) {
                smk.$viewer.searched.highlight( ev.result ? [ ev.result.id ] : [] )
            },

            'pick': function ( ev: any ) {
                smk.$viewer.searched.pick( null )
                smk.$viewer.searched.pick( ev.result.id )
                if ( !self.showPanel ) {
                    self.active = false
                    self.initialSearch = ev.result.title
                }
            },

            'clear': function () {
                smk.$viewer.searched.clear()
                self.initialSearch = ' '
                Vue.nextTick( function () { self.initialSearch = '' } )
            },
        } )

        smk.$viewer.searched.addedFeatures( function ( ev: any ) {
            self.results = ev.features
            self.clearInternalLayer( 'results' )
            self.loadInternalLayer( 'results', turf.featureCollection( ev.features ) )
        } )

        smk.$viewer.searched.highlightedFeatures( function ( ev: any ) {
            self.clearInternalLayer( 'result-highlight' )
            if ( !ev.features || !ev.features.length ) return
            self.loadInternalLayer( 'result-highlight', turf.featureCollection( ev.features ) )
        } )

        smk.$viewer.searched.pickedFeature( function ( ev: any ) {
            self.highlightId = ev.feature && ev.feature.id
            self.clearInternalLayer( 'result-selected' )
            if ( !ev.feature ) return
            self.loadInternalLayer( 'result-selected', ev.feature )
            smk.$viewer.panToFeature(
                ev.feature,
                precisionZoom[ ev.feature.properties.matchPrecision ] || precisionZoom._OTHER_
            )
        } )

        smk.$viewer.searched.clearedFeatures( function () {
            self.results = []
            self.clearInternalLayer( 'result-selected' )
            self.clearInternalLayer( 'result-highlight' )
            self.clearInternalLayer( 'results' )
        } )
    }
)

smkRef.TYPE[ 'tool-search-list' ] = factory
export default factory
