export class JupyterLite {
  constructor(options = {}) {
    this.options = options;
    this.app = null;
  }

  async loadConfig(externalConfig = null) {
    let config = externalConfig;
    if (!config) {
      const response = await fetch('../jupyter-lite.json');
      config = await response.json();
    }
    this.config = config;
  }

  async start() {
    if (!this.config) {
      throw new Error('Configuration not loaded. Call loadConfig() first.');
    }

    // Dynamically import the JupyterLite core application
    const { JupyterLiteApp } = await import('./extensions/@jupyterlite/application-extension/index.js');

    // Collect extensions automatically from the /extensions directory
    const extensionModules = await this._loadExtensions();

    // Create and start the app
    this.app = new JupyterLiteApp({
      litePlugins: [],
      federated_extensions: extensionModules
    });

    await this.app.start();
  }

  async _loadExtensions() {
    const extensions = [];
    const extensionList = [
      // List all extensions you expect to be under /lab/extensions/
      '@jupyterlab/apputils-extension',
      '@jupyterlab/notebook-extension',
      '@jupyterlab/console-extension',
      '@jupyterlab/filebrowser-extension',
      '@jupyterlab/terminal-extension',
      '@jupyterlab/docmanager-extension',
      '@jupyterlab/ui-components-extension',
      '@jupyterlab/csvviewer-extension',
      '@jupyterlab/markdownviewer-extension',
      '@jupyterlab/plotly-extension',
      '@jupyterlab/mathjax2-extension',
      '@jupyterlab/toc-extension',
      '@jupyterlab/vega5-extension',
      '@jupyterlab/git-extension',
      '@jupyterlite/pyodide-kernel-extension'
    ];

    for (const ext of extensionList) {
      try {
        const module = await import(`./extensions/${ext}/index.js`);
        extensions.push(module);
      } catch (err) {
        console.warn(`Failed to load extension: ${ext}`, err);
      }
    }

    return extensions;
  }
}
