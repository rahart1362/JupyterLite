import { JupyterLite } from './jupyterlite.js';

(async () => {
  try {
    // Fetch config
    const response = await fetch('../jupyter-lite.json');
    const config = await response.json();

    // Create JupyterLite app instance
    const app = new JupyterLite();

    // Load config (pyodide URL, fallback, etc.)
    await app.loadConfig(config);

    // Start the application
    await app.start();
  } catch (err) {
    console.error('Error initializing JupyterLite:', err);
    const errorDiv = document.createElement('div');
    errorDiv.style.color = 'red';
    errorDiv.textContent = `Failed to initialize JupyterLite: ${err.message}`;
    document.getElementById('jupyterlab').appendChild(errorDiv);
  }
})();
