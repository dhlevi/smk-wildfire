// Tool default config — AMD legacy, not used in Vite/TS build.
export const config = {
    type:     'layers',
    enabled:  false,
    order:    3,
    position: [ 'shortcut-menu', 'list-menu' ],
    icon:     'layers',
    title:    'Layers',
    command: {
        allVisibility: true,
        filter:        true,
        legend:        true,
        themes:        false,
    },
    glyph: {
        visible: 'visibility',
        hidden:  'visibility_off',
    },
}
export default config
