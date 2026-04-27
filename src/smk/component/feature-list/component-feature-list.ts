/**
 * component-feature-list — displays a list of features from multiple layers.
 */
import template from './component-feature-list.html?raw'
declare const Vue: any

Vue.component( 'feature-list', {
    template,
    props: {
        layers:      Array,
        highlightId: String,
    },
    computed: {
        featureCount( this: any ): number {
            if ( !this.layers || this.layers.length === 0 ) return 0
            return this.layers.reduce( ( accum: number, ly: any ) => accum + ly.features.length, 0 )
        },
    },
} )
