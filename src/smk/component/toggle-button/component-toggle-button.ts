/**
 * component-toggle-button — on/off toggle with v-model support.
 */
import template from './component-toggle-button.html?raw'
declare const Vue: any

Vue.component( 'toggle-button', {
    template,
    props: {
        value:    { type: Boolean, default: false },
        iconOff:  { type: String, default: 'toggle_off' },
        iconOn:   { type: String, default: 'toggle_on' },
        titleOff: { type: String, default: 'Off. Click to turn on' },
        titleOn:  { type: String, default: 'On. Click to turn off' },
    },
    model: {
        prop:  'value',
        event: 'change',
    },
    methods: {
        clickToggle( this: any ) {
            this.$emit( 'change', !this.value )
        },
    },
} )
