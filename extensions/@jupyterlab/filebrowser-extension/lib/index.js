// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.
/**
 * @packageDocumentation
 * @module filebrowser-extension
 */
import { ILabShell, ILayoutRestorer, IRouter, ITreePathUpdater, JupyterFrontEnd, JupyterLab } from '@jupyterlab/application';
import { Clipboard, createToolbarFactory, ICommandPalette, InputDialog, IToolbarWidgetRegistry, setToolbar, showErrorMessage, WidgetTracker } from '@jupyterlab/apputils';
import { PageConfig, PathExt } from '@jupyterlab/coreutils';
import { IDocumentManager } from '@jupyterlab/docmanager';
import { FileBrowser, FileUploadStatus, FilterFileBrowserModel, IDefaultFileBrowser, IFileBrowserCommands, IFileBrowserFactory, Uploader } from '@jupyterlab/filebrowser';
import { ISettingRegistry } from '@jupyterlab/settingregistry';
import { IStateDB } from '@jupyterlab/statedb';
import { IStatusBar } from '@jupyterlab/statusbar';
import { ITranslator, nullTranslator } from '@jupyterlab/translation';
import { addIcon, closeIcon, copyIcon, cutIcon, downloadIcon, editIcon, fileIcon, filterIcon, folderIcon, linkIcon, markdownIcon, newFolderIcon, pasteIcon, refreshIcon, stopIcon, textEditorIcon } from '@jupyterlab/ui-components';
import { map } from '@lumino/algorithm';
import { CommandRegistry } from '@lumino/commands';
/**
 * Toolbar factory for the top toolbar in the widget
 */
const FILE_BROWSER_FACTORY = 'FileBrowser';
const FILE_BROWSER_PLUGIN_ID = '@jupyterlab/filebrowser-extension:browser';
/**
 * The command IDs used by the file browser plugin.
 */
var CommandIDs;
(function (CommandIDs) {
    CommandIDs.copy = 'filebrowser:copy';
    CommandIDs.copyDownloadLink = 'filebrowser:copy-download-link';
    CommandIDs.cut = 'filebrowser:cut';
    CommandIDs.del = 'filebrowser:delete';
    CommandIDs.download = 'filebrowser:download';
    CommandIDs.duplicate = 'filebrowser:duplicate';
    // For main browser only.
    CommandIDs.hideBrowser = 'filebrowser:hide-main';
    CommandIDs.goToPath = 'filebrowser:go-to-path';
    CommandIDs.goUp = 'filebrowser:go-up';
    CommandIDs.openPath = 'filebrowser:open-path';
    CommandIDs.openUrl = 'filebrowser:open-url';
    CommandIDs.open = 'filebrowser:open';
    CommandIDs.openBrowserTab = 'filebrowser:open-browser-tab';
    CommandIDs.paste = 'filebrowser:paste';
    CommandIDs.createNewDirectory = 'filebrowser:create-new-directory';
    CommandIDs.createNewFile = 'filebrowser:create-new-file';
    CommandIDs.createNewMarkdownFile = 'filebrowser:create-new-markdown-file';
    CommandIDs.refresh = 'filebrowser:refresh';
    CommandIDs.rename = 'filebrowser:rename';
    // For main browser only.
    CommandIDs.copyShareableLink = 'filebrowser:share-main';
    // For main browser only.
    CommandIDs.copyPath = 'filebrowser:copy-path';
    CommandIDs.showBrowser = 'filebrowser:activate';
    CommandIDs.shutdown = 'filebrowser:shutdown';
    // For main browser only.
    CommandIDs.toggleBrowser = 'filebrowser:toggle-main';
    CommandIDs.toggleFileFilter = 'filebrowser:toggle-file-filter';
    CommandIDs.toggleNavigateToCurrentDirectory = 'filebrowser:toggle-navigate-to-current-directory';
    CommandIDs.toggleLastModified = 'filebrowser:toggle-last-modified';
    CommandIDs.toggleShowFullPath = 'filebrowser:toggle-show-full-path';
    CommandIDs.toggleFileSize = 'filebrowser:toggle-file-size';
    CommandIDs.toggleSortNotebooksFirst = 'filebrowser:toggle-sort-notebooks-first';
    CommandIDs.search = 'filebrowser:search';
    CommandIDs.toggleHiddenFiles = 'filebrowser:toggle-hidden-files';
    CommandIDs.toggleSingleClick = 'filebrowser:toggle-single-click-navigation';
    CommandIDs.toggleFileCheckboxes = 'filebrowser:toggle-file-checkboxes';
})(CommandIDs || (CommandIDs = {}));
/**
 * The file browser namespace token.
 */
const namespace = 'filebrowser';
/**
 * The default file browser extension.
 */
const browser = {
    id: FILE_BROWSER_PLUGIN_ID,
    description: 'Set up the default file browser commands and state restoration',
    requires: [IDefaultFileBrowser, IFileBrowserFactory, ITranslator],
    optional: [
        ILayoutRestorer,
        ISettingRegistry,
        ITreePathUpdater,
        ICommandPalette
    ],
    provides: IFileBrowserCommands,
    autoStart: true,
    activate: async (app, defaultFileBrowser, factory, translator, restorer, settingRegistry, treePathUpdater, commandPalette) => {
        const browser = defaultFileBrowser;
        // Let the application restorer track the primary file browser (that is
        // automatically created) for restoration of application state (e.g. setting
        // the file browser as the current side bar widget).
        //
        // All other file browsers created by using the factory function are
        // responsible for their own restoration behavior, if any.
        if (restorer) {
            restorer.add(browser, namespace);
        }
        // Navigate to preferred-dir trait if found
        const preferredPath = PageConfig.getOption('preferredPath');
        if (preferredPath) {
            await browser.model.cd(preferredPath);
        }
        addCommands(app, browser, factory, translator, settingRegistry, commandPalette);
        void Promise.all([app.restored, browser.model.restored]).then(() => {
            if (treePathUpdater) {
                browser.model.pathChanged.connect((sender, args) => {
                    treePathUpdater(args.newValue);
                });
            }
        });
        return {
            openPath: CommandIDs.openPath
        };
    }
};
/**
 * Handle the file browser settings taking into account user defined settings.
 */
const browserSettings = {
    id: '@jupyterlab/filebrowser-extension:settings',
    description: 'Set up the default file browser settings',
    requires: [IDefaultFileBrowser],
    optional: [ISettingRegistry],
    autoStart: true,
    activate: (app, browser, settingRegistry) => {
        if (settingRegistry) {
            void settingRegistry.load(FILE_BROWSER_PLUGIN_ID).then(settings => {
                /**
                 * File browser default configuration.
                 */
                const defaultFileBrowserConfig = {
                    navigateToCurrentDirectory: false,
                    singleClickNavigation: false,
                    showLastModifiedColumn: true,
                    showFileSizeColumn: false,
                    showHiddenFiles: false,
                    showFileCheckboxes: false,
                    sortNotebooksFirst: false,
                    showFullPath: false
                };
                function onSettingsChanged(settings) {
                    let key;
                    for (key in defaultFileBrowserConfig) {
                        const value = settings.get(key).composite;
                        browser[key] = value;
                    }
                    const filterDirectories = settings.get('filterDirectories')
                        .composite;
                    const useFuzzyFilter = settings.get('useFuzzyFilter')
                        .composite;
                    browser.model.filterDirectories = filterDirectories;
                    browser.model.useFuzzyFilter = useFuzzyFilter;
                }
                settings.changed.connect(onSettingsChanged);
                onSettingsChanged(settings);
            });
        }
    }
};
/**
 * The default file browser factory provider.
 */
const factory = {
    id: '@jupyterlab/filebrowser-extension:factory',
    description: 'Provides the file browser factory.',
    provides: IFileBrowserFactory,
    requires: [IDocumentManager, ITranslator],
    optional: [IStateDB, JupyterLab.IInfo],
    activate: async (app, docManager, translator, stateDB, info) => {
        const tracker = new WidgetTracker({ namespace });
        const createFileBrowser = (id, options = {}) => {
            var _a;
            const state = options.state === null
                ? undefined
                : options.state || stateDB || undefined;
            const model = new FilterFileBrowserModel({
                translator: translator,
                auto: (_a = options.auto) !== null && _a !== void 0 ? _a : true,
                manager: docManager,
                driveName: options.driveName || '',
                refreshInterval: options.refreshInterval,
                refreshStandby: () => {
                    if (info) {
                        return !info.isConnected || 'when-hidden';
                    }
                    return 'when-hidden';
                },
                state
            });
            const restore = options.restore;
            const widget = new FileBrowser({ id, model, restore, translator, state });
            // Track the newly created file browser.
            void tracker.add(widget);
            return widget;
        };
        return { createFileBrowser, tracker };
    }
};
/**
 * The default file browser factory provider.
 */
const defaultFileBrowser = {
    id: '@jupyterlab/filebrowser-extension:default-file-browser',
    description: 'Provides the default file browser',
    provides: IDefaultFileBrowser,
    requires: [IFileBrowserFactory],
    optional: [IRouter, JupyterFrontEnd.ITreeResolver, ILabShell, ITranslator],
    activate: async (app, fileBrowserFactory, router, tree, labShell, translator) => {
        const { commands } = app;
        const trans = (translator !== null && translator !== void 0 ? translator : nullTranslator).load('jupyterlab');
        // Manually restore and load the default file browser.
        const defaultBrowser = fileBrowserFactory.createFileBrowser('filebrowser', {
            auto: false,
            restore: false
        });
        // Set attributes when adding the browser to the UI
        defaultBrowser.node.setAttribute('role', 'region');
        defaultBrowser.node.setAttribute('aria-label', trans.__('File Browser Section'));
        defaultBrowser.title.icon = folderIcon;
        // Show the current file browser shortcut in its title.
        const updateBrowserTitle = () => {
            const binding = app.commands.keyBindings.find(b => b.command === CommandIDs.toggleBrowser);
            if (binding) {
                const ks = binding.keys.map(CommandRegistry.formatKeystroke).join(', ');
                defaultBrowser.title.caption = trans.__('File Browser (%1)', ks);
            }
            else {
                defaultBrowser.title.caption = trans.__('File Browser');
            }
        };
        updateBrowserTitle();
        app.commands.keyBindingChanged.connect(() => {
            updateBrowserTitle();
        });
        void Private.restoreBrowser(defaultBrowser, commands, router, tree, app, labShell);
        return defaultBrowser;
    }
};
/**
 * A plugin providing download + copy download link commands in the context menu.
 *
 * Disabling this plugin will NOT disable downloading files from the server.
 * Users will still be able to retrieve files from the file download URLs the
 * server provides.
 */
const downloadPlugin = {
    id: '@jupyterlab/filebrowser-extension:download',
    description: 'Adds the download file commands. Disabling this plugin will NOT disable downloading files from the server, if the user enters the appropriate download URLs.',
    requires: [IFileBrowserFactory, ITranslator],
    autoStart: true,
    activate: (app, factory, translator) => {
        const trans = translator.load('jupyterlab');
        const { commands } = app;
        const { tracker } = factory;
        commands.addCommand(CommandIDs.download, {
            execute: () => {
                const widget = tracker.currentWidget;
                if (widget) {
                    return widget.download();
                }
            },
            icon: downloadIcon.bindprops({ stylesheet: 'menuItem' }),
            label: trans.__('Download')
        });
        commands.addCommand(CommandIDs.copyDownloadLink, {
            execute: () => {
                const widget = tracker.currentWidget;
                if (!widget) {
                    return;
                }
                return widget.model.manager.services.contents
                    .getDownloadUrl(widget.selectedItems().next().value.path)
                    .then(url => {
                    Clipboard.copyToSystem(url);
                });
            },
            isVisible: () => 
            // So long as this command only handles one file at time, don't show it
            // if multiple files are selected.
            !!tracker.currentWidget &&
                Array.from(tracker.currentWidget.selectedItems()).length === 1,
            icon: copyIcon.bindprops({ stylesheet: 'menuItem' }),
            label: trans.__('Copy Download Link'),
            mnemonic: 0
        });
    }
};
/**
 * A plugin to add the file browser widget to an ILabShell
 */
const browserWidget = {
    id: '@jupyterlab/filebrowser-extension:widget',
    description: 'Adds the file browser to the application shell.',
    requires: [
        IDocumentManager,
        IDefaultFileBrowser,
        IFileBrowserFactory,
        ISettingRegistry,
        IToolbarWidgetRegistry,
        ITranslator,
        ILabShell,
        IFileBrowserCommands
    ],
    optional: [ICommandPalette],
    autoStart: true,
    activate: (app, docManager, browser, factory, settingRegistry, toolbarRegistry, translator, labShell, 
    // Wait until file browser commands are ready before activating file browser widget
    fileBrowserCommands, commandPalette) => {
        const { commands } = app;
        const { tracker } = factory;
        const trans = translator.load('jupyterlab');
        // Top-level toolbar
        toolbarRegistry.addFactory(FILE_BROWSER_FACTORY, 'uploader', (browser) => new Uploader({ model: browser.model, translator }));
        setToolbar(browser, createToolbarFactory(toolbarRegistry, settingRegistry, FILE_BROWSER_FACTORY, browserWidget.id, translator));
        labShell.add(browser, 'left', { rank: 100, type: 'File Browser' });
        commands.addCommand(CommandIDs.toggleBrowser, {
            label: trans.__('File Browser'),
            execute: () => {
                if (browser.isHidden) {
                    return commands.execute(CommandIDs.showBrowser, void 0);
                }
                return commands.execute(CommandIDs.hideBrowser, void 0);
            }
        });
        commands.addCommand(CommandIDs.showBrowser, {
            label: trans.__('Open the file browser for the provided `path`.'),
            execute: args => {
                const path = args.path || '';
                const browserForPath = Private.getBrowserForPath(path, browser, factory);
                // Check for browser not found
                if (!browserForPath) {
                    return;
                }
                // Shortcut if we are using the main file browser
                if (browser === browserForPath) {
                    labShell.activateById(browser.id);
                    return;
                }
                else {
                    const areas = ['left', 'right'];
                    for (const area of areas) {
                        for (const widget of labShell.widgets(area)) {
                            if (widget.contains(browserForPath)) {
                                labShell.activateById(widget.id);
                                return;
                            }
                        }
                    }
                }
            }
        });
        commands.addCommand(CommandIDs.hideBrowser, {
            label: trans.__('Hide the file browser.'),
            execute: () => {
                const widget = tracker.currentWidget;
                if (widget && !widget.isHidden) {
                    labShell.collapseLeft();
                }
            }
        });
        commands.addCommand(CommandIDs.toggleNavigateToCurrentDirectory, {
            label: trans.__('Show Active File in File Browser'),
            isToggled: () => browser.navigateToCurrentDirectory,
            execute: () => {
                const value = !browser.navigateToCurrentDirectory;
                const key = 'navigateToCurrentDirectory';
                return settingRegistry
                    .set(FILE_BROWSER_PLUGIN_ID, key, value)
                    .catch((reason) => {
                    console.error(`Failed to set navigateToCurrentDirectory setting`);
                });
            }
        });
        if (commandPalette) {
            commandPalette.addItem({
                command: CommandIDs.toggleNavigateToCurrentDirectory,
                category: trans.__('File Operations')
            });
        }
        // If the layout is a fresh session without saved data and not in single document
        // mode, open file browser.
        void labShell.restored.then(layout => {
            if (layout.fresh && labShell.mode !== 'single-document') {
                void commands.execute(CommandIDs.showBrowser, void 0);
            }
        });
        void Promise.all([app.restored, browser.model.restored]).then(() => {
            // Whether to automatically navigate to a document's current directory
            labShell.currentChanged.connect(async (_, change) => {
                if (browser.navigateToCurrentDirectory && change.newValue) {
                    const { newValue } = change;
                    const context = docManager.contextForWidget(newValue);
                    if (context) {
                        const { path } = context;
                        try {
                            await Private.navigateToPath(path, browser, factory, translator);
                        }
                        catch (reason) {
                            console.warn(`${CommandIDs.goToPath} failed to open: ${path}`, reason);
                        }
                    }
                }
            });
        });
    }
};
/**
 * The default file browser share-file plugin
 *
 * This extension adds a "Copy Shareable Link" command that generates a copy-
 * pastable URL. This url can be used to open a particular file in JupyterLab,
 * handy for emailing links or bookmarking for reference.
 *
 * If you need to change how this link is generated (for instance, to copy a
 * /user-redirect URL for JupyterHub), disable this plugin and replace it
 * with another implementation.
 */
const shareFile = {
    id: '@jupyterlab/filebrowser-extension:share-file',
    description: 'Adds the "Copy Shareable Link" command; useful for JupyterHub deployment for example.',
    requires: [IFileBrowserFactory, ITranslator],
    autoStart: true,
    activate: (app, factory, translator) => {
        const trans = translator.load('jupyterlab');
        const { commands } = app;
        const { tracker } = factory;
        commands.addCommand(CommandIDs.copyShareableLink, {
            execute: () => {
                const widget = tracker.currentWidget;
                const model = widget === null || widget === void 0 ? void 0 : widget.selectedItems().next();
                if (model === undefined || model.done) {
                    return;
                }
                Clipboard.copyToSystem(PageConfig.getUrl({
                    workspace: PageConfig.defaultWorkspace,
                    treePath: model.value.path,
                    toShare: true
                }));
            },
            isVisible: () => !!tracker.currentWidget &&
                Array.from(tracker.currentWidget.selectedItems()).length === 1,
            icon: linkIcon.bindprops({ stylesheet: 'menuItem' }),
            label: trans.__('Copy Shareable Link')
        });
    }
};
/**
 * The "Open With" context menu.
 *
 * This is its own plugin in case you would like to disable this feature.
 * e.g. jupyter labextension disable @jupyterlab/filebrowser-extension:open-with
 */
const openWithPlugin = {
    id: '@jupyterlab/filebrowser-extension:open-with',
    description: 'Adds the open-with feature allowing an user to pick the non-preferred document viewer.',
    requires: [IFileBrowserFactory],
    autoStart: true,
    activate: (app, factory) => {
        const { docRegistry } = app;
        const { tracker } = factory;
        let items = [];
        function updateOpenWithMenu(contextMenu) {
            var _a, _b;
            const openWith = (_b = (_a = contextMenu.menu.items.find(item => {
                var _a;
                return item.type === 'submenu' &&
                    ((_a = item.submenu) === null || _a === void 0 ? void 0 : _a.id) === 'jp-contextmenu-open-with';
            })) === null || _a === void 0 ? void 0 : _a.submenu) !== null && _b !== void 0 ? _b : null;
            if (!openWith) {
                return; // Bail early if the open with menu is not displayed
            }
            // clear the current menu items
            items.forEach(item => item.dispose());
            items.length = 0;
            // Ensure that the menu is empty
            openWith.clearItems();
            // get the widget factories that could be used to open all of the items
            // in the current filebrowser selection
            const factories = tracker.currentWidget
                ? Private.OpenWith.intersection(map(tracker.currentWidget.selectedItems(), i => {
                    return Private.OpenWith.getFactories(docRegistry, i);
                }))
                : new Set();
            // make new menu items from the widget factories
            items = [...factories].map(factory => openWith.addItem({
                args: { factory: factory.name, label: factory.label || factory.name },
                command: CommandIDs.open
            }));
        }
        app.contextMenu.opened.connect(updateOpenWithMenu);
    }
};
/**
 * The "Open in New Browser Tab" context menu.
 *
 * This is its own plugin in case you would like to disable this feature.
 * e.g. jupyter labextension disable @jupyterlab/filebrowser-extension:open-browser-tab
 *
 * Note: If disabling this, you may also want to disable:
 * @jupyterlab/docmanager-extension:open-browser-tab
 */
const openBrowserTabPlugin = {
    id: '@jupyterlab/filebrowser-extension:open-browser-tab',
    description: 'Adds the open-in-new-browser-tab features.',
    requires: [IFileBrowserFactory, ITranslator],
    autoStart: true,
    activate: (app, factory, translator) => {
        const { commands } = app;
        const trans = translator.load('jupyterlab');
        const { tracker } = factory;
        commands.addCommand(CommandIDs.openBrowserTab, {
            execute: args => {
                const widget = tracker.currentWidget;
                if (!widget) {
                    return;
                }
                const mode = args['mode'];
                return Promise.all(Array.from(map(widget.selectedItems(), item => {
                    if (mode === 'single-document') {
                        const url = PageConfig.getUrl({
                            mode: 'single-document',
                            treePath: item.path
                        });
                        const opened = window.open();
                        if (opened) {
                            opened.opener = null;
                            opened.location.href = url;
                        }
                        else {
                            throw new Error('Failed to open new browser tab.');
                        }
                    }
                    else {
                        return commands.execute('docmanager:open-browser-tab', {
                            path: item.path
                        });
                    }
                })));
            },
            icon: addIcon.bindprops({ stylesheet: 'menuItem' }),
            label: args => args['mode'] === 'single-document'
                ? trans.__('Open in Simple Mode')
                : trans.__('Open in New Browser Tab'),
            mnemonic: 0
        });
    }
};
/**
 * A plugin providing file upload status.
 */
export const fileUploadStatus = {
    id: '@jupyterlab/filebrowser-extension:file-upload-status',
    description: 'Adds a file upload status widget.',
    autoStart: true,
    requires: [IFileBrowserFactory, ITranslator],
    optional: [IStatusBar],
    activate: (app, browser, translator, statusBar) => {
        if (!statusBar) {
            // Automatically disable if statusbar missing
            return;
        }
        const item = new FileUploadStatus({
            tracker: browser.tracker,
            translator
        });
        statusBar.registerStatusItem('@jupyterlab/filebrowser-extension:file-upload-status', {
            item,
            align: 'middle',
            isActive: () => {
                return !!item.model && item.model.items.length > 0;
            },
            activeStateChanged: item.model.stateChanged
        });
    }
};
/**
 * A plugin to open files from remote URLs
 */
const openUrlPlugin = {
    id: '@jupyterlab/filebrowser-extension:open-url',
    description: 'Adds the feature "Open files from remote URLs".',
    autoStart: true,
    requires: [IDefaultFileBrowser, ITranslator],
    optional: [ICommandPalette],
    activate: (app, browser, translator, palette) => {
        const { commands } = app;
        const trans = translator.load('jupyterlab');
        const command = CommandIDs.openUrl;
        commands.addCommand(command, {
            label: args => args.url ? trans.__('Open %1', args.url) : trans.__('Open from URL…'),
            caption: args => args.url ? trans.__('Open %1', args.url) : trans.__('Open from URL'),
            execute: async (args) => {
                var _a, _b, _c;
                let url = (_a = args === null || args === void 0 ? void 0 : args.url) !== null && _a !== void 0 ? _a : '';
                if (!url) {
                    url =
                        (_b = (await InputDialog.getText({
                            label: trans.__('URL'),
                            placeholder: 'https://example.com/path/to/file',
                            title: trans.__('Open URL'),
                            okLabel: trans.__('Open')
                        })).value) !== null && _b !== void 0 ? _b : undefined;
                }
                if (!url) {
                    return;
                }
                let type = '';
                let blob;
                // fetch the file from the URL
                try {
                    const req = await fetch(url);
                    blob = await req.blob();
                    type = (_c = req.headers.get('Content-Type')) !== null && _c !== void 0 ? _c : '';
                }
                catch (reason) {
                    if (reason.response && reason.response.status !== 200) {
                        reason.message = trans.__('Could not open URL: %1', url);
                    }
                    return showErrorMessage(trans.__('Cannot fetch'), reason);
                }
                // upload the content of the file to the server
                try {
                    const name = PathExt.basename(url);
                    const file = new File([blob], name, { type });
                    const model = await browser.model.upload(file);
                    return commands.execute('docmanager:open', {
                        path: model.path
                    });
                }
                catch (error) {
                    return showErrorMessage(trans._p('showErrorMessage', 'Upload Error'), error);
                }
            }
        });
        if (palette) {
            palette.addItem({
                command,
                category: trans.__('File Operations')
            });
        }
    }
};
/**
 * Add the main file browser commands to the application's command registry.
 */
function addCommands(app, browser, factory, translator, settingRegistry, commandPalette) {
    const trans = translator.load('jupyterlab');
    const { docRegistry: registry, commands } = app;
    const { tracker } = factory;
    commands.addCommand(CommandIDs.del, {
        execute: () => {
            const widget = tracker.currentWidget;
            if (widget) {
                return widget.delete();
            }
        },
        icon: closeIcon.bindprops({ stylesheet: 'menuItem' }),
        label: trans.__('Delete'),
        mnemonic: 0
    });
    commands.addCommand(CommandIDs.copy, {
        execute: () => {
            const widget = tracker.currentWidget;
            if (widget) {
                return widget.copy();
            }
        },
        icon: copyIcon.bindprops({ stylesheet: 'menuItem' }),
        label: trans.__('Copy'),
        mnemonic: 0
    });
    commands.addCommand(CommandIDs.cut, {
        execute: () => {
            const widget = tracker.currentWidget;
            if (widget) {
                return widget.cut();
            }
        },
        icon: cutIcon.bindprops({ stylesheet: 'menuItem' }),
        label: trans.__('Cut')
    });
    commands.addCommand(CommandIDs.duplicate, {
        execute: () => {
            const widget = tracker.currentWidget;
            if (widget) {
                return widget.duplicate();
            }
        },
        icon: copyIcon.bindprops({ stylesheet: 'menuItem' }),
        label: trans.__('Duplicate')
    });
    commands.addCommand(CommandIDs.goToPath, {
        label: trans.__('Update the file browser to display the provided `path`.'),
        execute: async (args) => {
            var _a;
            const path = args.path || '';
            const showBrowser = !((_a = args === null || args === void 0 ? void 0 : args.dontShowBrowser) !== null && _a !== void 0 ? _a : false);
            try {
                const item = await Private.navigateToPath(path, browser, factory, translator);
                if (item.type !== 'directory' && showBrowser) {
                    const browserForPath = Private.getBrowserForPath(path, browser, factory);
                    if (browserForPath) {
                        browserForPath.clearSelectedItems();
                        const parts = path.split('/');
                        const name = parts[parts.length - 1];
                        if (name) {
                            await browserForPath.selectItemByName(name);
                        }
                    }
                }
            }
            catch (reason) {
                console.warn(`${CommandIDs.goToPath} failed to go to: ${path}`, reason);
            }
            if (showBrowser) {
                return commands.execute(CommandIDs.showBrowser, { path });
            }
        }
    });
    commands.addCommand(CommandIDs.goUp, {
        label: 'go up',
        execute: async () => {
            const browserForPath = Private.getBrowserForPath('', browser, factory);
            if (!browserForPath) {
                return;
            }
            const { model } = browserForPath;
            await model.restored;
            void browserForPath.goUp();
        }
    });
    commands.addCommand(CommandIDs.openPath, {
        label: args => args.path ? trans.__('Open %1', args.path) : trans.__('Open from Path…'),
        caption: args => args.path ? trans.__('Open %1', args.path) : trans.__('Open from path'),
        execute: async (args) => {
            var _a;
            let path;
            if (args === null || args === void 0 ? void 0 : args.path) {
                path = args.path;
            }
            else {
                path =
                    (_a = (await InputDialog.getText({
                        label: trans.__('Path'),
                        placeholder: '/path/relative/to/jlab/root',
                        title: trans.__('Open Path'),
                        okLabel: trans.__('Open')
                    })).value) !== null && _a !== void 0 ? _a : undefined;
            }
            if (!path) {
                return;
            }
            try {
                const trailingSlash = path !== '/' && path.endsWith('/');
                if (trailingSlash) {
                    // The normal contents service errors on paths ending in slash
                    path = path.slice(0, path.length - 1);
                }
                const browserForPath = Private.getBrowserForPath(path, browser, factory);
                const { services } = browserForPath.model.manager;
                const item = await services.contents.get(path, {
                    content: false
                });
                if (trailingSlash && item.type !== 'directory') {
                    throw new Error(`Path ${path}/ is not a directory`);
                }
                await commands.execute(CommandIDs.goToPath, {
                    path,
                    dontShowBrowser: args.dontShowBrowser
                });
                if (item.type === 'directory') {
                    return;
                }
                return commands.execute('docmanager:open', { path });
            }
            catch (reason) {
                if (reason.response && reason.response.status === 404) {
                    reason.message = trans.__('Could not find path: %1', path);
                }
                return showErrorMessage(trans.__('Cannot open'), reason);
            }
        }
    });
    // Add the openPath command to the command palette
    if (commandPalette) {
        commandPalette.addItem({
            command: CommandIDs.openPath,
            category: trans.__('File Operations')
        });
    }
    commands.addCommand(CommandIDs.open, {
        execute: args => {
            const factory = args['factory'] || void 0;
            const widget = tracker.currentWidget;
            if (!widget) {
                return;
            }
            const { contents } = widget.model.manager.services;
            return Promise.all(Array.from(map(widget.selectedItems(), item => {
                if (item.type === 'directory') {
                    const localPath = contents.localPath(item.path);
                    return widget.model.cd(`/${localPath}`);
                }
                return commands.execute('docmanager:open', {
                    factory: factory,
                    path: item.path
                });
            })));
        },
        icon: args => {
            var _a;
            const factory = args['factory'] || void 0;
            if (factory) {
                // if an explicit factory is passed...
                const ft = registry.getFileType(factory);
                // ...set an icon if the factory name corresponds to a file type name...
                // ...or leave the icon blank
                return (_a = ft === null || ft === void 0 ? void 0 : ft.icon) === null || _a === void 0 ? void 0 : _a.bindprops({ stylesheet: 'menuItem' });
            }
            else {
                return folderIcon.bindprops({ stylesheet: 'menuItem' });
            }
        },
        label: args => (args['label'] || args['factory'] || trans.__('Open')),
        mnemonic: 0
    });
    commands.addCommand(CommandIDs.paste, {
        execute: () => {
            const widget = tracker.currentWidget;
            if (widget) {
                return widget.paste();
            }
        },
        icon: pasteIcon.bindprops({ stylesheet: 'menuItem' }),
        label: trans.__('Paste'),
        mnemonic: 0
    });
    commands.addCommand(CommandIDs.createNewDirectory, {
        execute: () => {
            const widget = tracker.currentWidget;
            if (widget) {
                return widget.createNewDirectory();
            }
        },
        icon: newFolderIcon.bindprops({ stylesheet: 'menuItem' }),
        label: trans.__('New Folder')
    });
    commands.addCommand(CommandIDs.createNewFile, {
        execute: () => {
            const widget = tracker.currentWidget;
            if (widget) {
                return widget.createNewFile({ ext: 'txt' });
            }
        },
        icon: textEditorIcon.bindprops({ stylesheet: 'menuItem' }),
        label: trans.__('New File')
    });
    commands.addCommand(CommandIDs.createNewMarkdownFile, {
        execute: () => {
            const widget = tracker.currentWidget;
            if (widget) {
                return widget.createNewFile({ ext: 'md' });
            }
        },
        icon: markdownIcon.bindprops({ stylesheet: 'menuItem' }),
        label: trans.__('New Markdown File')
    });
    commands.addCommand(CommandIDs.refresh, {
        execute: args => {
            const widget = tracker.currentWidget;
            if (widget) {
                return widget.model.refresh();
            }
        },
        icon: refreshIcon.bindprops({ stylesheet: 'menuItem' }),
        caption: trans.__('Refresh the file browser.'),
        label: trans.__('Refresh File List')
    });
    commands.addCommand(CommandIDs.rename, {
        execute: args => {
            const widget = tracker.currentWidget;
            if (widget) {
                return widget.rename();
            }
        },
        isVisible: () => 
        // So long as this command only handles one file at time, don't show it
        // if multiple files are selected.
        !!tracker.currentWidget &&
            Array.from(tracker.currentWidget.selectedItems()).length === 1,
        icon: editIcon.bindprops({ stylesheet: 'menuItem' }),
        label: trans.__('Rename'),
        mnemonic: 0
    });
    commands.addCommand(CommandIDs.copyPath, {
        execute: () => {
            var _a;
            const widget = tracker.currentWidget;
            if (!widget) {
                return;
            }
            const item = widget.selectedItems().next();
            if (item.done) {
                return;
            }
            if (PageConfig.getOption('copyAbsolutePath') === 'true') {
                const absolutePath = PathExt.joinWithLeadingSlash((_a = PageConfig.getOption('serverRoot')) !== null && _a !== void 0 ? _a : '', item.value.path);
                Clipboard.copyToSystem(absolutePath);
            }
            else {
                Clipboard.copyToSystem(item.value.path);
            }
        },
        isVisible: () => 
        // So long as this command only handles one file at time, don't show it
        // if multiple files are selected.
        !!tracker.currentWidget &&
            Array.from(tracker.currentWidget.selectedItems()).length === 1,
        icon: fileIcon.bindprops({ stylesheet: 'menuItem' }),
        label: trans.__('Copy Path')
    });
    commands.addCommand(CommandIDs.shutdown, {
        execute: () => {
            const widget = tracker.currentWidget;
            if (widget) {
                return widget.shutdownKernels();
            }
        },
        icon: stopIcon.bindprops({ stylesheet: 'menuItem' }),
        label: trans.__('Shut Down Kernel')
    });
    commands.addCommand(CommandIDs.toggleFileFilter, {
        execute: () => {
            // Update toggled state, then let the toolbar button update
            browser.showFileFilter = !browser.showFileFilter;
            commands.notifyCommandChanged(CommandIDs.toggleFileFilter);
        },
        isToggled: () => {
            const toggled = browser.showFileFilter;
            return toggled;
        },
        icon: filterIcon.bindprops({ stylesheet: 'menuItem' }),
        label: trans.__('Toggle File Filter')
    });
    commands.addCommand(CommandIDs.toggleLastModified, {
        label: trans.__('Show Last Modified Column'),
        isToggled: () => browser.showLastModifiedColumn,
        execute: () => {
            const value = !browser.showLastModifiedColumn;
            const key = 'showLastModifiedColumn';
            if (settingRegistry) {
                return settingRegistry
                    .set(FILE_BROWSER_PLUGIN_ID, key, value)
                    .catch((reason) => {
                    console.error(`Failed to set ${key} setting`);
                });
            }
        }
    });
    commands.addCommand(CommandIDs.toggleShowFullPath, {
        label: trans.__('Show Full Path'),
        isToggled: () => browser.showFullPath,
        execute: () => {
            const value = !browser.showFullPath;
            const key = 'showFullPath';
            if (settingRegistry) {
                return settingRegistry
                    .set(FILE_BROWSER_PLUGIN_ID, key, value)
                    .catch((reason) => {
                    console.error(`Failed to set ${key} setting`);
                });
            }
        }
    });
    commands.addCommand(CommandIDs.toggleSortNotebooksFirst, {
        label: trans.__('Sort Notebooks Above Files'),
        isToggled: () => browser.sortNotebooksFirst,
        execute: () => {
            const value = !browser.sortNotebooksFirst;
            const key = 'sortNotebooksFirst';
            if (settingRegistry) {
                return settingRegistry
                    .set(FILE_BROWSER_PLUGIN_ID, key, value)
                    .catch((reason) => {
                    console.error(`Failed to set ${key} setting`);
                });
            }
        }
    });
    commands.addCommand(CommandIDs.toggleFileSize, {
        label: trans.__('Show File Size Column'),
        isToggled: () => browser.showFileSizeColumn,
        execute: () => {
            const value = !browser.showFileSizeColumn;
            const key = 'showFileSizeColumn';
            if (settingRegistry) {
                return settingRegistry
                    .set(FILE_BROWSER_PLUGIN_ID, key, value)
                    .catch((reason) => {
                    console.error(`Failed to set ${key} setting`);
                });
            }
        }
    });
    commands.addCommand(CommandIDs.toggleSingleClick, {
        label: trans.__('Enable Single Click Navigation'),
        isToggled: () => browser.singleClickNavigation,
        execute: () => {
            const value = !browser.singleClickNavigation;
            const key = 'singleClickNavigation';
            if (settingRegistry) {
                return settingRegistry
                    .set(FILE_BROWSER_PLUGIN_ID, key, value)
                    .catch((reason) => {
                    console.error(`Failed to set singleClickNavigation setting`);
                });
            }
        }
    });
    commands.addCommand(CommandIDs.toggleHiddenFiles, {
        label: trans.__('Show Hidden Files'),
        isToggled: () => browser.showHiddenFiles,
        isVisible: () => PageConfig.getOption('allow_hidden_files') === 'true',
        execute: () => {
            const value = !browser.showHiddenFiles;
            const key = 'showHiddenFiles';
            if (settingRegistry) {
                return settingRegistry
                    .set(FILE_BROWSER_PLUGIN_ID, key, value)
                    .catch((reason) => {
                    console.error(`Failed to set showHiddenFiles setting`);
                });
            }
        }
    });
    commands.addCommand(CommandIDs.toggleFileCheckboxes, {
        label: trans.__('Show File Checkboxes'),
        isToggled: () => browser.showFileCheckboxes,
        execute: () => {
            const value = !browser.showFileCheckboxes;
            const key = 'showFileCheckboxes';
            if (settingRegistry) {
                return settingRegistry
                    .set(FILE_BROWSER_PLUGIN_ID, key, value)
                    .catch((reason) => {
                    console.error(`Failed to set showFileCheckboxes setting`);
                });
            }
        }
    });
    commands.addCommand(CommandIDs.search, {
        label: trans.__('Search on File Names'),
        execute: () => alert('search')
    });
}
/**
 * Export the plugins as default.
 */
const plugins = [
    factory,
    defaultFileBrowser,
    browser,
    browserSettings,
    shareFile,
    fileUploadStatus,
    downloadPlugin,
    browserWidget,
    openWithPlugin,
    openBrowserTabPlugin,
    openUrlPlugin
];
export default plugins;
/**
 * A namespace for private module data.
 */
var Private;
(function (Private) {
    /**
     * Get browser object given file path.
     */
    function getBrowserForPath(path, browser, factory) {
        const { tracker } = factory;
        const driveName = browser.model.manager.services.contents.driveName(path);
        if (driveName) {
            const browserForPath = tracker.find(_path => _path.model.driveName === driveName);
            if (!browserForPath) {
                // warn that no filebrowser could be found for this driveName
                console.warn(`${CommandIDs.goToPath} failed to find filebrowser for path: ${path}`);
                return;
            }
            return browserForPath;
        }
        // if driveName is empty, assume the main filebrowser
        return browser;
    }
    Private.getBrowserForPath = getBrowserForPath;
    /**
     * Navigate to a path or the path containing a file.
     */
    async function navigateToPath(path, browser, factory, translator) {
        const trans = translator.load('jupyterlab');
        const browserForPath = Private.getBrowserForPath(path, browser, factory);
        if (!browserForPath) {
            throw new Error(trans.__('No browser for path'));
        }
        const { services } = browserForPath.model.manager;
        const localPath = services.contents.localPath(path);
        await services.ready;
        const item = await services.contents.get(path, { content: false });
        const { model } = browserForPath;
        await model.restored;
        if (item.type === 'directory') {
            await model.cd(`/${localPath}`);
        }
        else {
            await model.cd(`/${PathExt.dirname(localPath)}`);
        }
        return item;
    }
    Private.navigateToPath = navigateToPath;
    /**
     * Restores file browser state and overrides state if tree resolver resolves.
     */
    async function restoreBrowser(browser, commands, router, tree, app, labShell) {
        const restoring = 'jp-mod-restoring';
        browser.addClass(restoring);
        if (!router) {
            await browser.model.restore(browser.id);
            await browser.model.refresh();
            browser.removeClass(restoring);
            return;
        }
        const listener = async () => {
            router.routed.disconnect(listener);
            const paths = await (tree === null || tree === void 0 ? void 0 : tree.paths);
            if ((paths === null || paths === void 0 ? void 0 : paths.file) || (paths === null || paths === void 0 ? void 0 : paths.browser)) {
                // Restore the model without populating it.
                await browser.model.restore(browser.id, false);
                if (paths.file) {
                    await commands.execute(CommandIDs.openPath, {
                        path: paths.file,
                        dontShowBrowser: true
                    });
                }
                if (paths.browser) {
                    await commands.execute(CommandIDs.openPath, {
                        path: paths.browser,
                        dontShowBrowser: true
                    });
                }
            }
            else {
                await browser.model.restore(browser.id);
                await browser.model.refresh();
            }
            browser.removeClass(restoring);
            if (labShell === null || labShell === void 0 ? void 0 : labShell.isEmpty('main')) {
                void commands.execute('launcher:create');
            }
        };
        router.routed.connect(listener);
    }
    Private.restoreBrowser = restoreBrowser;
    let OpenWith;
    (function (OpenWith) {
        /**
         * Get the factories for the selected item
         *
         * @param docRegistry Application document registry
         * @param item Selected item model
         * @returns Available factories for the model
         */
        function getFactories(docRegistry, item) {
            const factories = docRegistry.preferredWidgetFactories(item.path);
            const notebookFactory = docRegistry.getWidgetFactory('notebook');
            if (notebookFactory &&
                item.type === 'notebook' &&
                factories.indexOf(notebookFactory) === -1) {
                factories.unshift(notebookFactory);
            }
            return factories;
        }
        OpenWith.getFactories = getFactories;
        /**
         * Return the intersection of multiple iterables.
         *
         * @param iterables Iterator of iterables
         * @returns Set of common elements to all iterables
         */
        function intersection(iterables) {
            let accumulator = undefined;
            for (const current of iterables) {
                // Initialize accumulator.
                if (accumulator === undefined) {
                    accumulator = new Set(current);
                    continue;
                }
                // Return early if empty.
                if (accumulator.size === 0) {
                    return accumulator;
                }
                // Keep the intersection of accumulator and current.
                let intersection = new Set();
                for (const value of current) {
                    if (accumulator.has(value)) {
                        intersection.add(value);
                    }
                }
                accumulator = intersection;
            }
            return accumulator !== null && accumulator !== void 0 ? accumulator : new Set();
        }
        OpenWith.intersection = intersection;
    })(OpenWith = Private.OpenWith || (Private.OpenWith = {}));
})(Private || (Private = {}));
//# sourceMappingURL=index.js.map