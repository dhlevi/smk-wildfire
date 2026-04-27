/**
 * component-select-dropdown — dropdown selector with v-model support.
 */
import template from './component-select-dropdown.html?raw'
declare const Vue: any

Vue.component( 'select-dropdown', {
    template,
    props: {
        options: { type: Array, default: () => [] },
        value:   {},
    },
    model: {
        prop:  'value',
        event: 'change',
    },
    methods: {
        clickOption( this: any, value: any ) {
            this.$emit( 'change', value )
        },
    },
} )
