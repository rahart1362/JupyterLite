/* -----------------------------------------------------------------------------
| Copyright (c) Jupyter Development Team.
| Distributed under the terms of the Modified BSD License.
|----------------------------------------------------------------------------*/
/**
 * @packageDocumentation
 * @module vega5-extension
 */
import { Widget } from '@lumino/widgets';
/**
 * The CSS class to add to the Vega and Vega-Lite widget.
 */
const VEGA_COMMON_CLASS = 'jp-RenderedVegaCommon5';
/**
 * The CSS class to add to the Vega.
 */
const VEGA_CLASS = 'jp-RenderedVega5';
/**
 * The CSS class to add to the Vega-Lite.
 */
const VEGALITE_CLASS = 'jp-RenderedVegaLite';
/**
 * The MIME type for Vega.
 *
 * #### Notes
 * The version of this follows the major version of Vega.
 */
export const VEGA_MIME_TYPE = 'application/vnd.vega.v5+json';
/**
 * The MIME type for Vega-Lite.
 *
 * #### Notes
 * The version of this follows the major version of Vega-Lite.
 */
export const VEGALITE3_MIME_TYPE = 'application/vnd.vegalite.v3+json';
/**
 * The MIME type for Vega-Lite.
 *
 * #### Notes
 * The version of this follows the major version of Vega-Lite.
 */
export const VEGALITE4_MIME_TYPE = 'application/vnd.vegalite.v4+json';
/**
 * The MIME type for Vega-Lite.
 *
 * #### Notes
 * The version of this follows the major version of Vega-Lite.
 */
export const VEGALITE5_MIME_TYPE = 'application/vnd.vegalite.v5+json';
/**
 * A widget for rendering Vega or Vega-Lite data, for usage with rendermime.
 */
export class RenderedVega extends Widget {
    /**
     * Create a new widget for rendering Vega/Vega-Lite.
     */
    constructor(options) {
        super();
        this._mimeType = options.mimeType;
        this._resolver = options.resolver;
        this.addClass(VEGA_COMMON_CLASS);
        this.addClass(this._mimeType === VEGA_MIME_TYPE ? VEGA_CLASS : VEGALITE_CLASS);
    }
    /**
     * Render Vega/Vega-Lite into this widget's node.
     */
    async renderModel(model) {
        const spec = model.data[this._mimeType];
        if (spec === undefined) {
            return;
        }
        const metadata = model.metadata[this._mimeType];
        const embedOptions = metadata && metadata.embed_options ? metadata.embed_options : {};
        // If the JupyterLab theme is dark, render this using a dark Vega theme.
        let bodyThemeDark = document.body.dataset.jpThemeLight === 'false';
        if (bodyThemeDark) {
            embedOptions.theme = 'dark';
        }
        const mode = this._mimeType === VEGA_MIME_TYPE ? 'vega' : 'vega-lite';
        const vega = Private.vega != null ? Private.vega : await Private.ensureVega();
        const el = document.createElement('div');
        // clear the output before attaching a chart
        this.node.textContent = '';
        this.node.appendChild(el);
        if (this._result) {
            this._result.finalize();
        }
        const loader = vega.vega.loader({
            http: { credentials: 'same-origin' }
        });
        const sanitize = async (uri, options) => {
            // Use the resolver for any URIs it wants to handle
            const resolver = this._resolver;
            if ((resolver === null || resolver === void 0 ? void 0 : resolver.isLocal) && resolver.isLocal(uri)) {
                const absPath = await resolver.resolveUrl(uri);
                uri = await resolver.getDownloadUrl(absPath);
            }
            return loader.sanitize(uri, options);
        };
        this._result = await vega.default(el, spec, {
            actions: true,
            defaultStyle: true,
            ...embedOptions,
            mode,
            loader: { ...loader, sanitize }
        });
        if (model.data['image/png']) {
            return;
        }
        // Add png representation of vega chart to output
        const imageURL = await this._result.view.toImageURL('png', typeof embedOptions.scaleFactor === 'number'
            ? embedOptions.scaleFactor
            : embedOptions.scaleFactor
                ? embedOptions.scaleFactor.png
                : embedOptions.scaleFactor);
        model.setData({
            data: { ...model.data, 'image/png': imageURL.split(',')[1] }
        });
    }
    dispose() {
        if (this._result) {
            this._result.finalize();
        }
        super.dispose();
    }
}
/**
 * A mime renderer factory for vega data.
 */
export const rendererFactory = {
    safe: true,
    mimeTypes: [
        VEGA_MIME_TYPE,
        VEGALITE3_MIME_TYPE,
        VEGALITE4_MIME_TYPE,
        VEGALITE5_MIME_TYPE
    ],
    createRenderer: options => new RenderedVega(options)
};
const extension = {
    id: '@jupyterlab/vega5-extension:factory',
    description: 'Provides a renderer for Vega 5 and Vega-Lite 3 to 5 content.',
    rendererFactory,
    rank: 57,
    dataType: 'json',
    documentWidgetFactoryOptions: [
        {
            name: 'Vega5',
            primaryFileType: 'vega5',
            fileTypes: ['vega5', 'json'],
            defaultFor: ['vega5']
        },
        {
            name: 'Vega-Lite5',
            primaryFileType: 'vega-lite5',
            fileTypes: ['vega-lite3', 'vega-lite4', 'vega-lite5', 'json'],
            defaultFor: ['vega-lite3', 'vega-lite4', 'vega-lite5']
        }
    ],
    fileTypes: [
        {
            mimeTypes: [VEGA_MIME_TYPE],
            name: 'vega5',
            extensions: ['.vg', '.vg.json', '.vega'],
            icon: 'ui-components:vega'
        },
        {
            mimeTypes: [VEGALITE5_MIME_TYPE],
            name: 'vega-lite5',
            extensions: ['.vl', '.vl.json', '.vegalite'],
            icon: 'ui-components:vega'
        },
        {
            mimeTypes: [VEGALITE4_MIME_TYPE],
            name: 'vega-lite4',
            extensions: [],
            icon: 'ui-components:vega'
        },
        {
            mimeTypes: [VEGALITE3_MIME_TYPE],
            name: 'vega-lite3',
            extensions: [],
            icon: 'ui-components:vega'
        }
    ]
};
export default extension;
/**
 * A namespace for private module data.
 */
var Private;
(function (Private) {
    /**
     * Lazy-load and cache the vega-embed library
     */
    function ensureVega() {
        if (Private.vegaReady) {
            return Private.vegaReady;
        }
        Private.vegaReady = import('vega-embed');
        return Private.vegaReady;
    }
    Private.ensureVega = ensureVega;
})(Private || (Private = {}));
//# sourceMappingURL=index.js.map