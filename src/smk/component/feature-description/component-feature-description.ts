/**
 * component-feature-description — displays feature description HTML.
 */
import template from './component-feature-description.html?raw'
import { SMK } from '../../smk-ref'
declare const Vue: any

Vue.component( 'feature-description', {
    extends: SMK?.COMPONENT?.FeatureBase,
    template,
} )
