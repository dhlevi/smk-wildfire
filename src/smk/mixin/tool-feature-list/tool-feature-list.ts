/**
 * tool-feature-list mixin — manages a feature result list for a Tool.
 * Converted from mixin/tool-feature-list/tool-feature-list.js.
 */

declare const Vue: any
declare const turf: any

export function ToolFeatureList( this: any, featureSetCallback: ( this: any, smk: any ) => any ): void {
    this.defineProp( 'layers' )
    this.defineProp( 'highlightId' )

    this.layers = []

    this.$initializers.push( function ( this: any, smk: any ) {
        const self = this

        this.featureSet = featureSetCallback.call( this, smk )

        smk.on( this.id, {
            'active': function ( ev: any ) {
                self.featureSet.pick( ev.featureId )
            },
            'hover': function ( ev: any ) {
                self.featureSet.highlight( ev.features && ev.features.map( ( f: any ) => f.id ) )
            },
            'clear': function () {
                self.featureSet.clear()
            },
            'remove': function ( ev: any ) {
                self.featureSet.remove( [ ev.featureId ] )
            },
            'swipe-up': function () {
                smk.$sidepanel.setExpand( 2 )
            },
            'swipe-down': function () {
                smk.$sidepanel.incrExpand( -1 )
            }
        } )

        self.featureSet.addedFeatures( function ( ev: any ) {
            self.active = true

            const ly    = smk.$viewer.layerId[ ev.layerId ]
            const index = smk.$viewer.displayContext.layers.getLayerIndex( ev.layerId ) || 0

            self.modifyComponentProp( 'layers', function ( prop: any ) {
                if ( !prop[ index ] )
                    Vue.set( prop, index, {
                        id:       ly.id,
                        title:    ly.config.title,
                        features: [],
                    } )

                Vue.set( prop[ index ], 'features', prop[ index ].features.concat(
                    ev.features.map( ( ft: any ) => {
                        if ( !self.firstId ) self.firstId = ft.id
                        return { id: ft.id, title: ft.title }
                    } )
                ) )
            } )
        } )

        self.featureSet.clearedFeatures( function () {
            self.layers    = []
            self.firstId   = null
            self.clearInternalLayer( 'highlight-polygon' )
            self.clearInternalLayer( 'highlight-line' )
            self.clearInternalLayer( 'highlight-point' )
        } )

        self.featureSet.removedFeatures( function ( ev: any ) {
            const index = smk.$viewer.displayContext.layers.getLayerIndex( ev.features[ 0 ].layerId ) || 0
            self.layers[ index ].features = self.layers[ index ].features.filter(
                ( ft: any ) => ft.id !== ev.features[ 0 ].id
            )
        } )

        self.featureSet.pickedFeature( function ( ev: any ) {
            self.clearInternalLayer( 'highlight-polygon' )
            self.clearInternalLayer( 'highlight-line' )
            self.clearInternalLayer( 'highlight-point' )
            if ( !ev.feature ) return
            displayFeature( ev.feature )
        } )

        self.featureSet.highlightedFeatures( function ( ev: any ) {
            self.clearInternalLayer( 'highlight-polygon' )
            self.clearInternalLayer( 'highlight-line' )
            self.clearInternalLayer( 'highlight-point' )

            if ( ev.features )
                ev.features.forEach( ( f: any ) => displayFeature( f ) )

            const picked = self.featureSet.getPicked()
            if ( picked ) displayFeature( picked )
        } )

        function displayFeature( feature: any ) {
            if ( feature.layerId ) {
                const ly = smk.$viewer.layerId[ feature.layerId ]
                if ( ly.config.isDisplayed === false ) return
            }

            switch ( turf.getType( feature ) ) {
                case 'Point':
                case 'MultiPoint':
                    self.loadInternalLayer( 'highlight-point', feature )
                    break
                case 'LineString':
                case 'MultiLineString':
                    self.loadInternalLayer( 'highlight-line', feature )
                    break
                case 'Polygon':
                case 'MultiPolygon':
                    self.loadInternalLayer( 'highlight-polygon', feature )
                    break
            }
        }
    } )
}

// Assign to SMK.TYPE for backward compat
if ( typeof window !== 'undefined' ) {
    const smk = ( window as any ).SMK
    if ( smk && smk.TYPE ) smk.TYPE.ToolFeatureList = ToolFeatureList
}

export default ToolFeatureList
