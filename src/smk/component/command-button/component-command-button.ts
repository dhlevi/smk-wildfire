/**
 * component-command-button — clickable action button component.
 */
import template from './component-command-button.html?raw'
declare const Vue: any

Vue.component( 'command-button', {
    template,
    props: {
        title:    { type: String },
        disabled: { type: Boolean, default: false },
        icon:     { type: String },
    },
    methods: {
        clickButton( this: any, ev: Event ) {
            if ( this.disabled ) return
            this.$emit( 'click', ev )
        },
    },
} )
