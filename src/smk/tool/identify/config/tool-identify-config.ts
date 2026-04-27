// Tool default config — AMD legacy, not used in Vite/TS build.
export const config = {
    type:     'identify',
    enabled:  false,
    order:    5,
    position: 'list-menu',
    icon:     'info_outline',
    title:    'Identify Features',
    command: {
        navigator:  true,
        zoom:       true,
        select:     true,
        attributeMode: false,
        radius:     false,
        radiusUnit: false,
        nearBy:     true,
    },
    radius:     5,
    radiusUnit: 'px',
    internalLayers: [
        {
            id: 'search-area',
            style: { stroke: false, fill: true, fillColor: 'white', fillOpacity: 0.5 },
        },
        {
            id: 'search-border-1',
            style: { strokeWidth: 6, strokeColor: 'black', strokeOpacity: 1, strokeCap: 'butt' },
        },
        {
            id: 'search-border-2',
            style: { strokeWidth: 6, strokeColor: 'white', strokeOpacity: 1, strokeCap: 'butt' },
        },
        {
            id:    'location',
            title: 'Identify Location',
            style: { markerSize: [ 40, 40 ], markerOffset: [ 20, 20 ] },
            legend: { point: true },
        },
        {
            id: 'edit-search-area',
            style: { strokeWidth: 3, strokeColor: 'red', strokeOpacity: 1 },
        },
    ],
}
export default config
