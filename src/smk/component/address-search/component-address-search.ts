/**
 * component-address-search — Vue component for geocoder address search.
 */
import template from './component-address-search.html?raw'
declare const Vue: any

Vue.component( 'address-search', {
    template,
    props: {
        placeholder:     { type: String },
        geocoderService: { type: Object, default: () => ( {} ) },
    },
    data( this: any ) {
        return {
            search:        '',
            list:          null as any[] | null,
            selectedIndex: null as number | null,
            expanded:      false,
            geocoder:      new ( window as any ).SMK.TYPE.Geocoder( this.geocoderService ),
        }
    },
    methods: {
        clear( this: any ) {
            this.search = ''
        },
        onChange( this: any, val: string ) {
            const self = this
            this.search = val
            this.list = null
            return this.geocoder.fetchAddresses( val, { maxResults: 5 } )
                .then( ( features: any[] ) => {
                    self.list = features
                    self.expanded = features.length > 0
                    self.selectedIndex = features.length > 0 ? 0 : null
                } )
        },
        onArrowDown( this: any ) {
            if ( !this.expanded && this.list ) {
                this.expanded = true
                this.selectedIndex = 0
                return
            }
            this.selectedIndex = ( ( this.selectedIndex || 0 ) + 1 ) % this.list.length
        },
        onArrowUp( this: any ) {
            if ( !this.expanded ) return
            this.selectedIndex = ( ( this.selectedIndex || 0 ) + this.list.length - 1 ) % this.list.length
        },
        onEnter( this: any ) {
            if ( !this.expanded ) return
            this.expanded = false
            this.$emit( 'update', this.list[ this.selectedIndex ] )
        },
        handleClickOutside( this: any, ev: MouseEvent ) {
            if ( this.$el.contains( ev.target ) ) return
            this.expanded = false
            this.selectedIndex = null
        },
    },
    mounted( this: any ) {
        document.addEventListener( 'click', this.handleClickOutside )
    },
    destroyed( this: any ) {
        document.removeEventListener( 'click', this.handleClickOutside )
    },
} )
