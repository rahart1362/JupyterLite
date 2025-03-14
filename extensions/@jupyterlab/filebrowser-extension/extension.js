import { IPlugin } from '@jupyterlite/core';
import { FileBrowser } from '@jupyterlab/filebrowser';
import { FileBrowserModel } from '@jupyterlab/filebrowser';

const fileBrowserExtension: IPlugin = {
  id: '@jupyterlite/filebrowser-extension',
  activate: (app) => {
    console.log('Activating file browser extension...');
    const fileBrowserModel = new FileBrowserModel({
      manager: app.contentsManager
    });
    const fileBrowser = new FileBrowser({
      model: fileBrowserModel,
      commands: app.commands
    });
    app.shell.add(fileBrowser, 'left');
  }
};

export default fileBrowserExtension;
