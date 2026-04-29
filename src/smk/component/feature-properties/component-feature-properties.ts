/**
 * component-feature-properties — displays raw feature GeoJSON properties.
 */
import template from './component-feature-properties.html?raw'
import { SMK } from '../../smk-ref'
declare const Vue: any

Vue.component( 'feature-properties', {
    extends: SMK?.COMPONENT?.FeatureBase,
    template,
    computed: {
        sortedProperties( this: any ): string[] {
            if ( !this.feature || !this.feature.properties ) return []
            return Object.keys( this.feature.properties ).sort()
        },
    },
} )
