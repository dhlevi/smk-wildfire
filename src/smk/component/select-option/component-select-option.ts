/**
 * component-select-option — radio-style option group with v-model support.
 */
import template from './component-select-option.html?raw'
declare const Vue: any

Vue.component( 'select-option', {
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
        clickOption( this: any, option: any ) {
            this.$emit( 'change', option.value )
        },
    },
} )
