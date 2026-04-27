/**
 * component-feature-attributes — displays formatted feature attribute list.
 */
import template from './component-feature-attributes.html?raw'
declare const Vue: any

Vue.component( 'feature-attributes', {
    extends: ( window as any ).SMK?.COMPONENT?.FeatureBase,
    template,
} )
