/**
 * component-feature-description — displays feature description HTML.
 */
import template from './component-feature-description.html?raw'
declare const Vue: any

Vue.component( 'feature-description', {
    extends: ( window as any ).SMK?.COMPONENT?.FeatureBase,
    template,
} )
