"use strict";
// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const widgets_1 = require("@phosphor/widgets");
const plotly_1 = __importDefault(require("plotly.js/dist/plotly"));
require("../style/index.css");
/**
 * The CSS class to add to the Plotly Widget.
 */
const CSS_CLASS = 'jp-RenderedPlotly';
/**
 * The CSS class for a Plotly icon.
 */
const CSS_ICON_CLASS = 'jp-MaterialIcon jp-PlotlyIcon';
/**
 * The MIME type for Plotly.
 * The version of this follows the major version of Plotly.
 */
exports.MIME_TYPE = 'application/vnd.plotly.v1+json';
class RenderedPlotly extends widgets_1.Widget {
    /**
     * Create a new widget for rendering Plotly.
     */
    constructor(options) {
        super();
        this.addClass(CSS_CLASS);
        this._mimeType = options.mimeType;
    }
    /**
     * Render Plotly into this widget's node.
     */
    renderModel(model) {
        const { data, layout, frames, config } = model.data[this._mimeType];
        // const metadata = model.metadata[this._mimeType] as any || {};
        return plotly_1.default.react(this.node, data, layout, config).then(plot => {
            this.update();
            if (frames) {
                plotly_1.default.addFrames(this.node, frames).then(() => {
                    plotly_1.default.animate(this.node);
                });
            }
            if (this.node.offsetWidth > 0 && this.node.offsetHeight > 0) {
                plotly_1.default.toImage(plot, {
                    format: 'png',
                    width: this.node.offsetWidth,
                    height: this.node.offsetHeight
                }).then((url) => {
                    const imageData = url.split(',')[1];
                    if (model.data['image/png'] !== imageData) {
                        model.setData({
                            data: Object.assign({}, model.data, { 'image/png': imageData })
                        });
                    }
                });
            }
        });
    }
    /**
     * A message handler invoked on an `'after-show'` message.
     */
    onAfterShow(msg) {
        this.update();
    }
    /**
     * A message handler invoked on a `'resize'` message.
     */
    onResize(msg) {
        this.update();
    }
    /**
     * A message handler invoked on an `'update-request'` message.
     */
    onUpdateRequest(msg) {
        if (this.isVisible) {
            plotly_1.default.redraw(this.node).then(() => {
                plotly_1.default.Plots.resize(this.node);
            });
        }
    }
}
exports.RenderedPlotly = RenderedPlotly;
/**
 * A mime renderer factory for Plotly data.
 */
exports.rendererFactory = {
    safe: true,
    mimeTypes: [exports.MIME_TYPE],
    createRenderer: options => new RenderedPlotly(options)
};
const extensions = [
    {
        id: '@jupyterlab/plotly-extension:factory',
        rendererFactory: exports.rendererFactory,
        rank: 0,
        dataType: 'json',
        fileTypes: [
            {
                name: 'plotly',
                mimeTypes: [exports.MIME_TYPE],
                extensions: ['.plotly', '.plotly.json'],
                iconClass: CSS_ICON_CLASS
            }
        ],
        documentWidgetFactoryOptions: {
            name: 'Plotly',
            primaryFileType: 'plotly',
            fileTypes: ['plotly', 'json'],
            defaultFor: ['plotly']
        }
    }
];
exports.default = extensions;
