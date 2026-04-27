/**
 * component-feature-attribute — displays a single attribute row.
 */
import template from './component-feature-attribute.html?raw'
declare const Vue: any

Vue.component( 'feature-attribute', {
    template,
    props: {
        title: { type: String },
        value: { type: String },
    },
} )
