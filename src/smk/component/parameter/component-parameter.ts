/**
 * component-parameter — constant, input, and select parameter components.
 */
import constantTemplate from './component-parameter-constant.html?raw'
import inputTemplate    from './component-parameter-input.html?raw'
import selectTemplate   from './component-parameter-select.html?raw'
declare const Vue: any

Vue.component( 'parameter-constant', {
    template: constantTemplate,
    props: [ 'id', 'title', 'value', 'type', 'focus' ],
    mounted( this: any ) {
        this.$emit( 'mounted' )
    },
} )

Vue.component( 'parameter-input', {
    template: inputTemplate,
    props: [ 'id', 'title', 'value', 'type', 'focus' ],
    data( this: any ) {
        return { input: this.value || '' }
    },
    watch: {
        value( this: any, val: string ) {
            this.input = val || ''
        },
        focus( this: any ) {
            this.$refs.in.focus()
        },
    },
    mounted( this: any ) {
        this.$emit( 'mounted' )
    },
} )

Vue.component( 'parameter-select', {
    template: selectTemplate,
    props: [ 'id', 'title', 'choices', 'value', 'type', 'focus', 'useFallback' ],
    data( this: any ) {
        return { selected: this.value || '' }
    },
    watch: {
        value( this: any, val: string ) {
            this.selected = val || ''
        },
    },
    mounted( this: any ) {
        this.$emit( 'mounted' )
    },
    computed: {
        isEmpty( this: any ): boolean {
            return !this.choices || this.choices.length === 0
        },
    },
} )
