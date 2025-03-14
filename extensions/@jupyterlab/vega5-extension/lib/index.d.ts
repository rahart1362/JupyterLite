/**
 * @packageDocumentation
 * @module vega5-extension
 */
import { IRenderMime } from '@jupyterlab/rendermime-interfaces';
import { Widget } from '@lumino/widgets';
/**
 * The MIME type for Vega.
 *
 * #### Notes
 * The version of this follows the major version of Vega.
 */
export declare const VEGA_MIME_TYPE = "application/vnd.vega.v5+json";
/**
 * The MIME type for Vega-Lite.
 *
 * #### Notes
 * The version of this follows the major version of Vega-Lite.
 */
export declare const VEGALITE3_MIME_TYPE = "application/vnd.vegalite.v3+json";
/**
 * The MIME type for Vega-Lite.
 *
 * #### Notes
 * The version of this follows the major version of Vega-Lite.
 */
export declare const VEGALITE4_MIME_TYPE = "application/vnd.vegalite.v4+json";
/**
 * The MIME type for Vega-Lite.
 *
 * #### Notes
 * The version of this follows the major version of Vega-Lite.
 */
export declare const VEGALITE5_MIME_TYPE = "application/vnd.vegalite.v5+json";
/**
 * A widget for rendering Vega or Vega-Lite data, for usage with rendermime.
 */
export declare class RenderedVega extends Widget implements IRenderMime.IRenderer {
    private _result;
    /**
     * Create a new widget for rendering Vega/Vega-Lite.
     */
    constructor(options: IRenderMime.IRendererOptions);
    /**
     * Render Vega/Vega-Lite into this widget's node.
     */
    renderModel(model: IRenderMime.IMimeModel): Promise<void>;
    dispose(): void;
    private _mimeType;
    private _resolver;
}
/**
 * A mime renderer factory for vega data.
 */
export declare const rendererFactory: IRenderMime.IRendererFactory;
declare const extension: IRenderMime.IExtension;
export default extension;
