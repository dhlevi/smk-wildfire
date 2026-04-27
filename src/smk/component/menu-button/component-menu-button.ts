/**
 * component-menu-button — button that reveals a dropdown menu.
 */
import template from './component-menu-button.html?raw'
declare const Vue: any

Vue.component( 'menu-button', {
    template,
    props: {
        title:     { type: String },
        disabled:  { type: Boolean, default: false },
        icon:      { type: String },
        menuItems: { type: Array },
    },
    data() {
        return { menuVisible: false }
    },
    methods: {
        onToggleMenu( this: any ) {
            this.menuVisible = !this.menuVisible
        },
        onClick( this: any, menuItem: any ) {
            if ( this.disabled ) return
            this.$emit( 'click', menuItem )
            this.menuVisible = false
        },
        onBackdropClick( this: any ) {
            this.menuVisible = false
        },
        onMove() {},
    },
} )
