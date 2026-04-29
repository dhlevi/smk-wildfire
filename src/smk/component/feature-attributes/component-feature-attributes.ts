/**
 * component-feature-attributes — displays formatted feature attribute list.
 */
import template from './component-feature-attributes.html?raw'
import { SMK } from '../../smk-ref'
declare const Vue: any

Vue.component( 'feature-attributes', {
    extends: SMK?.COMPONENT?.FeatureBase,
    template,
} )
