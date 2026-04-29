###### [SMK](../../..) / [Configuration](..) / [Layers](.)

# Vector Layer

This is default configuration for the Vector layer.
Click on a property name for more information:
<pre>
{ "layers": [ {
    <a href="#type-property"                >"type"</a>:                "vector",
    <a href="#id-property"                  >"id"</a>:                  null,
    <a href="#title-property"               >"title"</a>:               null,
    <a href="#opacity-property"             >"opacity"</a>:             null,
    <a href="#isvisible-property"           >"isVisible"</a>:           false,
    <a href="#isqueryable-property"         >"isQueryable"</a>:         true,
    <a href="#minscale-property"            >"minScale"</a>:            null,
    <a href="#maxscale-property"            >"maxScale"</a>:            null,
    <a href="#metadataurl-property"         >"metadataUrl"</a>:         null,
    <a href="#popuptemplate-property"       >"popupTemplate"</a>:       null,
    <a href="#titleattribute-property"      >"titleAttribute"</a>:      null,
    <a href="#attributes-property"          >"attributes"</a>:          null,
    <a href="#queries-property"             >"queries"</a>:             null,
    <a href="#useclustering-property"       >"useClustering"</a>:       false,
    <a href="#useheatmap-property"          >"useHeatmap"</a>:          false,
    <a href="#style-property"               >"style"</a>:               null,
    <a href="#label-property"               >"label"</a>:               null,
    <a href="#dataUrl-property"             >"dataUrl"</a>:             null
} ] }
</pre>

{% include_relative include/type-property.md %}
{% include_relative include/id-property.md %}
{% include_relative include/title-property.md %}
{% include_relative include/opacity-property.md %}
{% include_relative include/is-visible-property.md %}
{% include_relative include/is-queryable-property.md %}
{% include_relative include/min-scale-property.md %}
{% include_relative include/max-scale-property.md %}
{% include_relative include/metadata-url-property.md %}
{% include_relative include/popup-template-property.md %}
{% include_relative include/title-attribute-property.md %}
{% include_relative include/attributes-property.md %}
{% include_relative include/queries-property.md %}


## UseClustering Property
`"useClustering": Boolean`

If `true`, the layer should use point clustering.
Only relevant for point geometry layers.
The default is `false`.


## UseHeatmap Property
`"useHeatmap": Boolean`

If `true`, the layer should use heatmap clustering.
Only relevant for point geometry layers.
The default is `false`.


## Style Property
`"style": Object | Array`

The [style object](style) used to render the features from this data source.


## Label Property
`"label": String | Object`

Render a permanent text label on each feature.

Shorthand: a string is treated as the name of an attribute to use as the label
text — `"label": "NAME"` is equivalent to `"label": { "field": "NAME" }`.

Object form supports:

| Property        | Type      | Description |
|-----------------|-----------|-------------|
| `field`         | `String`  | Attribute name. Used as the label when `format` is not supplied. |
| `format`        | `String`  | Template string. Tokens of the form `{attr}` are replaced with the feature's property values. Overrides `field`. |
| `color`         | `String`  | CSS colour for the label text. Defaults to `#222`. |
| `size`          | `Number`  | Font size in pixels. Defaults to `12`. |
| `haloColor`     | `String`  | CSS colour for the text halo / outline. Defaults to `#fff`. |
| `haloWidth`     | `Number`  | Halo width in pixels. Defaults to `1.5`. |
| `font`          | `Array`   | (MapLibre only) An ordered list of font names available in the map style's glyphs. |
| `anchor`        | `String`  | (MapLibre) Text anchor — `center`, `top`, `bottom`, `left`, etc. |
| `direction`     | `String`  | (Leaflet) Tooltip direction — `center`, `top`, `bottom`, `left`, `right`, `auto`. |
| `offset`        | `Array`   | `[x, y]` pixel offset. |
| `placement`     | `String`  | (MapLibre) `point`, `line`, or `line-center`. Defaults to `point`. |
| `minZoom`       | `Number`  | (MapLibre) Smallest zoom at which the label is visible. |
| `maxZoom`       | `Number`  | (MapLibre) Largest zoom at which the label is visible. |
| `allowOverlap`  | `Boolean` | (MapLibre) If `true`, labels are drawn even when they overlap. Defaults to `false`. |
| `opacity`       | `Number`  | Label opacity, `0` – `1`. Defaults to `1`. |
| `className`     | `String`  | (Leaflet) Extra CSS class to apply to the tooltip element. |

Example:

```json
{
    "type":    "vector",
    "id":      "parks",
    "dataUrl": "/data/parks.geojson",
    "label": {
        "format":    "{NAME} ({AREA_HA} ha)",
        "color":     "#003366",
        "size":      13,
        "haloColor": "#ffffff",
        "haloWidth": 2
    }
}
```


## DataUrl Property
`"dataUrl": String`

The URL that points to a GeoJSON data source.




