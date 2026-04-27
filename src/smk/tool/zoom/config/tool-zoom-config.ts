// Tool default config — AMD legacy, not used in Vite/TS build.
export const config = {
    type:        'zoom',
    position:    'actionbar',
    enabled:     false,
    order:       1,
    mouseWheel:  true,
    doubleClick: true,
    box:         true,
    control:     true,
    icon: {
        zoomIn:  'add',
        zoomOut: 'remove',
    },
    title: {
        zoomIn:  'Zoom In',
        zoomOut: 'Zoom Out',
    },
}
export default config
