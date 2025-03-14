import { IPlugin } from '@jupyterlite/core';
import { NotebookPanel } from '@jupyterlab/notebook';
import { Notebook } from '@jupyterlab/notebook';

const notebookExtension: IPlugin = {
  id: '@jupyterlite/notebook-extension',
  activate: (app) => {
    console.log('Activating notebook extension...');
    const notebookWidget = new NotebookPanel({
      context: app.context,
      model: new Notebook.Model(),
      contentFactory: Notebook.defaultContentFactory
    });
    app.shell.add(notebookWidget, 'main');
  }
};

export default notebookExtension;