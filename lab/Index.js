(async () => {
  try {
    // Load the main JupyterLite application module.
    const { JupyterLiteApp } = await import('@jupyterlite/application');

    // Load the necessary plugins.
//    const pluginManager = await import('@jupyterlite/plugin-manager-extension');
//    const contents = await import('@jupyterlite/contents');
//    const server = await import('@jupyterlite/server-extension');
//    const pyodideKernel = await import('@jupyterlite/pyodide-kernel-extension');

    // Load federated extensions.
    const apputils = await import('./extensions/@jupyterlab/apputils-extension');
    const notebook = await import('./extensions/@jupyterlab/notebook-extension');
    const console = await import('./extensions/@jupyterlab/console-extension');
    const filebrowser = await import('./extensions/@jupyterlab/filebrowser-extension');
    const terminal = await import('./extensions/@jupyterlab/terminal-extension');
    const docmanager = await import('./extensions/@jupyterlab/docmanager-extension');
    const uiComponents = await import('./extensions/@jupyterlab/ui-components-extension');
    const csvviewer = await import('./extensions/@jupyterlab/csvviewer-extension');
    const markdownviewer = await import('./extensions/@jupyterlab/markdownviewer-extension');
    const plotly = await import('./extensions/@jupyterlab/plotly-extension');
    const mathjax2 = await import('./extensions/@jupyterlab/mathjax2-extension');
    const toc = await import('./extensions/@jupyterlab/toc-extension');
    const vega5 = await import('./extensions/@jupyterlab/vega5-extension');
    const git = await import('./extensions/@jupyterlab/git-extension');

    // Load the configuration from jupyter-lite.json.
    const response = await fetch('../jupyter-lite.json');
    const config = await response.json();

    // Create the JupyterLite application instance.
    const app = new JupyterLiteApp({
      litePlugins: {
        '@jupyterlite/plugin-manager-extension': pluginManager,
        '@jupyterlite/contents': contents,
        '@jupyterlite/server-extension': server,
        '@jupyterlite/pyodide-kernel-extension': pyodideKernel,
      },
      federated_extensions: [
        apputils,
        notebook,
        console,
        filebrowser,
        terminal,
        docmanager,
        uiComponents,
        csvviewer,
        markdownviewer,
        plotly,
        mathjax2,
        toc,
        vega5,
        git,
      ],
      pyodide: config.pyodide, // Pass the pyodide configuration
    });

    // Start the application.
    await app.start();
  } catch (err) {
    console.error('Error initializing JupyterLite:', err);
    // Optionally display an error message to the user.
    const errorDiv = document.createElement('div');
    errorDiv.style.color = 'red';
    errorDiv.textContent = `Failed to initialize JupyterLite: ${err.message}`;
    document.getElementById('jupyterlab').appendChild(errorDiv);
  }
})();
