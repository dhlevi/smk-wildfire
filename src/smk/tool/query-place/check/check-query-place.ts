// AMD check function — creates child query-results and query-feature tool instances
// for query-place tool setup. AMD legacy; runtime wiring handled by TS tool class.
export function checkQueryPlace( smk: any, tool: any ): void {
    smk.tools.push( Object.assign( {}, tool, {
        id:       'query-results--place',
        type:     'query-results',
        instance: 'place',
        enabled:  true,
        parentId: tool.id,
    } ) )

    smk.tools.push( Object.assign( {}, tool, {
        id:       'query-feature--place',
        type:     'query-feature',
        instance: 'place',
        enabled:  true,
        parentId: 'query-results--place',
    } ) )
}
export default checkQueryPlace
