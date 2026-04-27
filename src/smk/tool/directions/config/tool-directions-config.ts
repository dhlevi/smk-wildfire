// Tool default config — AMD legacy, not used in Vite/TS build.
export const config = {
    type:     'directions',
    enabled:  false,
    order:    4,
    position: [ 'shortcut-menu', 'list-menu' ],
    icon:     'directions_car',
    title:    'Route Planner',
    optimal:  false,
    geocoderService:    {} as Record<string, unknown>,
    routePlannerService: {} as Record<string, unknown>,
    segmentLayers: [
        {
            id:    '@segments',
            title: 'Segments',
            style: {
                strokeColor:   'blue',
                strokeWidth:   8,
                strokeOpacity: 0.8,
            },
            legend: { line: true },
        },
    ],
    waypointLayers: [
        {
            id:    '@waypoint-start',
            title: 'Starting Route Location',
            style: {
                markerSize:   [ 25, 41 ],
                markerOffset: [ 12, 41 ],
                shadowSize:   [ 41, 41 ],
                popupOffset:  [ 1, -34 ],
            },
            legend:      { title: 'Starting Route Location', point: true },
            isDraggable: true,
            isQueryable: false,
        },
        {
            id:    '@waypoint-end',
            title: 'Ending Route Location',
            style: {
                markerSize:   [ 25, 41 ],
                markerOffset: [ 12, 41 ],
                shadowSize:   [ 41, 41 ],
                popupOffset:  [ 1, -34 ],
            },
            legend:      { title: 'Ending Route Location', point: true },
            isDraggable: true,
            isQueryable: false,
        },
        {
            id:    '@waypoint-middle',
            title: 'Waypoint on Route',
            style: {
                markerSize:   [ 25, 41 ],
                markerOffset: [ 12, 41 ],
                shadowSize:   [ 41, 41 ],
                popupOffset:  [ 1, -34 ],
            },
            legend:      { title: 'Waypoint on Route', point: true },
            isDraggable: true,
            isQueryable: false,
        },
    ],
}
export default config
