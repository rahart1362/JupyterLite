/**
 * @packageDocumentation
 * @module mathjax-extension
 */
import { JupyterFrontEndPlugin } from '@jupyterlab/application';
import { ILatexTypesetter } from '@jupyterlab/rendermime';
export { MathJaxTypesetter } from './typesetter';
/**
 * The MathJax latexTypesetter plugin.
 */
declare const plugin: JupyterFrontEndPlugin<ILatexTypesetter>;
/**
 * Export the plugin as default.
 */
export default plugin;
