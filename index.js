import { JupyterLite } from '@jupyterlite/core';
import { PluginManager } from '@jupyterlite/plugin-manager-extension';
import { ContentsManager } from '@jupyterlite/contents';
import { ServerExtension } from '@jupyterlite/server-extension';
import { PyodideKernelExtension } from '@jupyterlite/pyodide-kernel-extension';
import { NotebookExtension } from './extensions/@jupyterlab/notebook-extension/extension';
import { FileBrowserExtension } from './extensions/@jupyterlab/filebrowser-extension/extension';

const app = new JupyterLite({
  title: 'JupyterLite with Pyodide and Extensions',
  plugins: [
    PluginManager,
    ContentsManager,
    ServerExtension,
    PyodideKernelExtension
  ],
  federatedExtensions: [
    NotebookExtension,
    FileBrowserExtension
  ]
});

app.initialize().then(() => {
  console.log("JupyterLite has been initialized with Pyodide and extensions.");
});