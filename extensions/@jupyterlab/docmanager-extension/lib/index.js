// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.
/**
 * @packageDocumentation
 * @module docmanager-extension
 */
import { ILabShell, ILabStatus, JupyterLab } from '@jupyterlab/application';
import { addCommandToolbarButtonClass, CommandToolbarButtonComponent, Dialog, ICommandPalette, InputDialog, ISessionContextDialogs, Notification, ReactWidget, SessionContextDialogs, showDialog, showErrorMessage, UseSignal } from '@jupyterlab/apputils';
import { PathExt, Time } from '@jupyterlab/coreutils';
import { DocumentManager, IDocumentManager, IDocumentWidgetOpener, IRecentsManager, PathStatus, renameDialog, SavingStatus } from '@jupyterlab/docmanager';
import { ISettingRegistry } from '@jupyterlab/settingregistry';
import { IStatusBar } from '@jupyterlab/statusbar';
import { ITranslator, nullTranslator } from '@jupyterlab/translation';
import { saveIcon } from '@jupyterlab/ui-components';
import { some } from '@lumino/algorithm';
import { JSONExt } from '@lumino/coreutils';
import { Signal } from '@lumino/signaling';
import { Widget } from '@lumino/widgets';
import * as React from 'react';
import { recentsManagerPlugin } from './recents';
/**
 * The command IDs used by the document manager plugin.
 */
var CommandIDs;
(function (CommandIDs) {
    CommandIDs.clone = 'docmanager:clone';
    CommandIDs.deleteFile = 'docmanager:delete-file';
    CommandIDs.newUntitled = 'docmanager:new-untitled';
    CommandIDs.open = 'docmanager:open';
    CommandIDs.openBrowserTab = 'docmanager:open-browser-tab';
    CommandIDs.reload = 'docmanager:reload';
    CommandIDs.rename = 'docmanager:rename';
    CommandIDs.del = 'docmanager:delete';
    CommandIDs.duplicate = 'docmanager:duplicate';
    CommandIDs.restoreCheckpoint = 'docmanager:restore-checkpoint';
    CommandIDs.save = 'docmanager:save';
    CommandIDs.saveAll = 'docmanager:save-all';
    CommandIDs.saveAs = 'docmanager:save-as';
    CommandIDs.download = 'docmanager:download';
    CommandIDs.toggleAutosave = 'docmanager:toggle-autosave';
    CommandIDs.showInFileBrowser = 'docmanager:show-in-file-browser';
})(CommandIDs || (CommandIDs = {}));
/**
 * The id of the document manager plugin.
 */
const docManagerPluginId = '@jupyterlab/docmanager-extension:plugin';
/**
 * A plugin to open documents in the main area.
 *
 */
const openerPlugin = {
    id: '@jupyterlab/docmanager-extension:opener',
    description: 'Provides the widget opener.',
    autoStart: true,
    provides: IDocumentWidgetOpener,
    activate: (app) => {
        const { shell } = app;
        return new (class {
            constructor() {
                this._opened = new Signal(this);
            }
            open(widget, options) {
                if (!widget.id) {
                    widget.id = `document-manager-${++Private.id}`;
                }
                widget.title.dataset = {
                    type: 'document-title',
                    ...widget.title.dataset
                };
                if (!widget.isAttached) {
                    shell.add(widget, 'main', options || {});
                }
                shell.activateById(widget.id);
                this._opened.emit(widget);
            }
            get opened() {
                return this._opened;
            }
        })();
    }
};
/**
 * A plugin to handle dirty states for open documents.
 */
const contextsPlugin = {
    id: '@jupyterlab/docmanager-extension:contexts',
    description: 'Adds the handling of opened documents dirty state.',
    autoStart: true,
    requires: [IDocumentManager, IDocumentWidgetOpener],
    optional: [ILabStatus],
    activate: (app, docManager, widgetOpener, status) => {
        const contexts = new WeakSet();
        widgetOpener.opened.connect((_, widget) => {
            // Handle dirty state for open documents.
            const context = docManager.contextForWidget(widget);
            if (context && !contexts.has(context)) {
                if (status) {
                    handleContext(status, context);
                }
                contexts.add(context);
            }
        });
    }
};
/**
 * A plugin providing the default document manager.
 */
const manager = {
    id: '@jupyterlab/docmanager-extension:manager',
    description: 'Provides the document manager.',
    provides: IDocumentManager,
    requires: [IDocumentWidgetOpener],
    optional: [
        ITranslator,
        ILabStatus,
        ISessionContextDialogs,
        JupyterLab.IInfo,
        IRecentsManager
    ],
    activate: (app, widgetOpener, translator_, status, sessionDialogs_, info, recentsManager) => {
        var _a;
        const { serviceManager: manager, docRegistry: registry } = app;
        const translator = translator_ !== null && translator_ !== void 0 ? translator_ : nullTranslator;
        const sessionDialogs = sessionDialogs_ !== null && sessionDialogs_ !== void 0 ? sessionDialogs_ : new SessionContextDialogs({ translator });
        const when = app.restored.then(() => void 0);
        const docManager = new DocumentManager({
            registry,
            manager,
            opener: widgetOpener,
            when,
            setBusy: (_a = (status && (() => status.setBusy()))) !== null && _a !== void 0 ? _a : undefined,
            sessionDialogs,
            translator: translator !== null && translator !== void 0 ? translator : nullTranslator,
            isConnectedCallback: () => {
                if (info) {
                    return info.isConnected;
                }
                return true;
            },
            recentsManager: recentsManager !== null && recentsManager !== void 0 ? recentsManager : undefined
        });
        return docManager;
    }
};
/**
 * The default document manager provider commands and settings.
 */
const docManagerPlugin = {
    id: docManagerPluginId,
    description: 'Adds commands and settings to the document manager.',
    autoStart: true,
    requires: [IDocumentManager, IDocumentWidgetOpener, ISettingRegistry],
    optional: [ITranslator, ICommandPalette, ILabShell],
    activate: (app, docManager, widgetOpener, settingRegistry, translator, palette, labShell) => {
        translator = translator !== null && translator !== void 0 ? translator : nullTranslator;
        const trans = translator.load('jupyterlab');
        const registry = app.docRegistry;
        // Register the file operations commands.
        addCommands(app, docManager, widgetOpener, settingRegistry, translator, labShell, palette);
        // Keep up to date with the settings registry.
        const onSettingsUpdated = (settings) => {
            // Handle whether to autosave
            const autosave = settings.get('autosave').composite;
            docManager.autosave =
                autosave === true || autosave === false ? autosave : true;
            app.commands.notifyCommandChanged(CommandIDs.toggleAutosave);
            const confirmClosingDocument = settings.get('confirmClosingDocument')
                .composite;
            docManager.confirmClosingDocument = confirmClosingDocument !== null && confirmClosingDocument !== void 0 ? confirmClosingDocument : true;
            // Handle autosave interval
            const autosaveInterval = settings.get('autosaveInterval').composite;
            docManager.autosaveInterval = autosaveInterval || 120;
            // Handle last modified timestamp check margin
            const lastModifiedCheckMargin = settings.get('lastModifiedCheckMargin')
                .composite;
            docManager.lastModifiedCheckMargin = lastModifiedCheckMargin || 500;
            const renameUntitledFile = settings.get('renameUntitledFileOnSave')
                .composite;
            docManager.renameUntitledFileOnSave = renameUntitledFile !== null && renameUntitledFile !== void 0 ? renameUntitledFile : true;
            // Handle default widget factory overrides.
            const defaultViewers = settings.get('defaultViewers').composite;
            const overrides = {};
            // Filter the defaultViewers and file types for existing ones.
            Object.keys(defaultViewers).forEach(ft => {
                if (!registry.getFileType(ft)) {
                    console.warn(`File Type ${ft} not found`);
                    return;
                }
                if (!registry.getWidgetFactory(defaultViewers[ft])) {
                    console.warn(`Document viewer ${defaultViewers[ft]} not found`);
                }
                overrides[ft] = defaultViewers[ft];
            });
            // Set the default factory overrides. If not provided, this has the
            // effect of unsetting any previous overrides.
            for (const ft of registry.fileTypes()) {
                try {
                    registry.setDefaultWidgetFactory(ft.name, overrides[ft.name]);
                }
                catch (_a) {
                    console.warn(`Failed to set default viewer ${overrides[ft.name]} for file type ${ft.name}`);
                }
            }
        };
        // Fetch the initial state of the settings.
        Promise.all([settingRegistry.load(docManagerPluginId), app.restored])
            .then(([settings]) => {
            settings.changed.connect(onSettingsUpdated);
            onSettingsUpdated(settings);
            const onStateChanged = (sender, change) => {
                if ([
                    'autosave',
                    'autosaveInterval',
                    'confirmClosingDocument',
                    'lastModifiedCheckMargin',
                    'renameUntitledFileOnSave'
                ].includes(change.name) &&
                    settings.get(change.name).composite !== change.newValue) {
                    settings.set(change.name, change.newValue).catch(reason => {
                        console.error(`Failed to set the setting '${change.name}':\n${reason}`);
                    });
                }
            };
            docManager.stateChanged.connect(onStateChanged);
        })
            .catch((reason) => {
            console.error(reason.message);
        });
        // Register a fetch transformer for the settings registry,
        // allowing us to dynamically populate a help string with the
        // available document viewers and file types for the default
        // viewer overrides.
        settingRegistry.transform(docManagerPluginId, {
            fetch: plugin => {
                // Get the available file types.
                const fileTypes = Array.from(registry.fileTypes())
                    .map(ft => ft.name)
                    .join('    \n');
                // Get the available widget factories.
                const factories = Array.from(registry.widgetFactories())
                    .map(f => f.name)
                    .join('    \n');
                // Generate the help string.
                const description = trans.__(`Overrides for the default viewers for file types.
Specify a mapping from file type name to document viewer name, for example:

defaultViewers: {
  markdown: "Markdown Preview"
}

If you specify non-existent file types or viewers, or if a viewer cannot
open a given file type, the override will not function.

Available viewers:
%1

Available file types:
%2`, factories, fileTypes);
                const schema = JSONExt.deepCopy(plugin.schema);
                schema.properties.defaultViewers.description = description;
                return { ...plugin, schema };
            }
        });
        // If the document registry gains or loses a factory or file type,
        // regenerate the settings description with the available options.
        registry.changed.connect(() => settingRegistry.load(docManagerPluginId, true));
    }
};
/**
 * A plugin for adding a saving status item to the status bar.
 */
export const savingStatusPlugin = {
    id: '@jupyterlab/docmanager-extension:saving-status',
    description: 'Adds a saving status indicator.',
    autoStart: true,
    requires: [IDocumentManager, ILabShell],
    optional: [ITranslator, IStatusBar],
    activate: (_, docManager, labShell, translator, statusBar) => {
        if (!statusBar) {
            // Automatically disable if statusbar missing
            return;
        }
        const saving = new SavingStatus({
            docManager,
            translator: translator !== null && translator !== void 0 ? translator : nullTranslator
        });
        // Keep the currently active widget synchronized.
        saving.model.widget = labShell.currentWidget;
        labShell.currentChanged.connect(() => {
            saving.model.widget = labShell.currentWidget;
        });
        statusBar.registerStatusItem(savingStatusPlugin.id, {
            item: saving,
            align: 'middle',
            isActive: () => saving.model !== null && saving.model.status !== null,
            activeStateChanged: saving.model.stateChanged
        });
    }
};
/**
 * A plugin providing a file path widget to the status bar.
 */
export const pathStatusPlugin = {
    id: '@jupyterlab/docmanager-extension:path-status',
    description: 'Adds a file path indicator in the status bar.',
    autoStart: true,
    requires: [IDocumentManager, ILabShell],
    optional: [IStatusBar],
    activate: (_, docManager, labShell, statusBar) => {
        if (!statusBar) {
            // Automatically disable if statusbar missing
            return;
        }
        const path = new PathStatus({ docManager });
        // Keep the file path widget up-to-date with the application active widget.
        path.model.widget = labShell.currentWidget;
        labShell.currentChanged.connect(() => {
            path.model.widget = labShell.currentWidget;
        });
        statusBar.registerStatusItem(pathStatusPlugin.id, {
            item: path,
            align: 'right',
            rank: 0
        });
    }
};
/**
 * A plugin providing download commands in the file menu and command palette.
 */
export const downloadPlugin = {
    id: '@jupyterlab/docmanager-extension:download',
    description: 'Adds command to download files.',
    autoStart: true,
    requires: [IDocumentManager],
    optional: [ITranslator, ICommandPalette],
    activate: (app, docManager, translator, palette) => {
        var _a;
        const trans = (translator !== null && translator !== void 0 ? translator : nullTranslator).load('jupyterlab');
        const { commands, shell } = app;
        const isEnabled = () => {
            const { currentWidget } = shell;
            return !!(currentWidget && docManager.contextForWidget(currentWidget));
        };
        commands.addCommand(CommandIDs.download, {
            label: trans.__('Download'),
            caption: trans.__('Download the file to your computer'),
            isEnabled,
            execute: () => {
                // Checks that shell.currentWidget is valid:
                if (isEnabled()) {
                    const context = docManager.contextForWidget(shell.currentWidget);
                    if (!context) {
                        return showDialog({
                            title: trans.__('Cannot Download'),
                            body: trans.__('No context found for current widget!'),
                            buttons: [Dialog.okButton()]
                        });
                    }
                    return context.download();
                }
            }
        });
        (_a = app.shell.currentChanged) === null || _a === void 0 ? void 0 : _a.connect(() => {
            app.commands.notifyCommandChanged(CommandIDs.download);
        });
        const category = trans.__('File Operations');
        if (palette) {
            palette.addItem({ command: CommandIDs.download, category });
        }
    }
};
/**
 * A plugin providing open-browser-tab commands.
 *
 * This is its own plugin in case you would like to disable this feature.
 * e.g. jupyter labextension disable @jupyterlab/docmanager-extension:open-browser-tab
 *
 * Note: If disabling this, you may also want to disable:
 * @jupyterlab/filebrowser-extension:open-browser-tab
 */
export const openBrowserTabPlugin = {
    id: '@jupyterlab/docmanager-extension:open-browser-tab',
    description: 'Adds command to open a browser tab.',
    autoStart: true,
    requires: [IDocumentManager],
    optional: [ITranslator],
    activate: (app, docManager, translator) => {
        const trans = (translator !== null && translator !== void 0 ? translator : nullTranslator).load('jupyterlab');
        const { commands } = app;
        commands.addCommand(CommandIDs.openBrowserTab, {
            execute: args => {
                const path = typeof args['path'] === 'undefined' ? '' : args['path'];
                if (!path) {
                    return;
                }
                return docManager.services.contents.getDownloadUrl(path).then(url => {
                    const opened = window.open();
                    if (opened) {
                        opened.opener = null;
                        opened.location.href = url;
                    }
                    else {
                        throw new Error('Failed to open new browser tab.');
                    }
                });
            },
            iconClass: args => args['icon'] || '',
            label: () => trans.__('Open in New Browser Tab')
        });
    }
};
/**
 * Export the plugins as default.
 */
const plugins = [
    manager,
    docManagerPlugin,
    contextsPlugin,
    pathStatusPlugin,
    savingStatusPlugin,
    downloadPlugin,
    openBrowserTabPlugin,
    openerPlugin,
    recentsManagerPlugin
];
export default plugins;
/**
 * Toolbar item factory
 */
export var ToolbarItems;
(function (ToolbarItems) {
    /**
     * Create save button toolbar item.
     *
     */
    function createSaveButton(commands, fileChanged) {
        return addCommandToolbarButtonClass(ReactWidget.create(React.createElement(UseSignal, { signal: fileChanged }, () => (React.createElement(CommandToolbarButtonComponent, { commands: commands, id: CommandIDs.save, label: '', args: { toolbar: true } })))));
    }
    ToolbarItems.createSaveButton = createSaveButton;
})(ToolbarItems || (ToolbarItems = {}));
/* Widget to display the revert to checkpoint confirmation. */
class RevertConfirmWidget extends Widget {
    /**
     * Construct a new revert confirmation widget.
     */
    constructor(checkpoint, trans, fileType = 'notebook') {
        super({
            node: Private.createRevertConfirmNode(checkpoint, fileType, trans)
        });
    }
}
// Returns the file type for a widget.
function fileType(widget, docManager) {
    if (!widget) {
        return 'File';
    }
    const context = docManager.contextForWidget(widget);
    if (!context) {
        return '';
    }
    const fts = docManager.registry.getFileTypesForPath(context.path);
    return fts.length && fts[0].displayName ? fts[0].displayName : 'File';
}
/**
 * Add the file operations commands to the application's command registry.
 */
function addCommands(app, docManager, widgetOpener, settingRegistry, translator, labShell, palette) {
    var _a;
    const trans = translator.load('jupyterlab');
    const { commands, shell } = app;
    const category = trans.__('File Operations');
    const isEnabled = () => {
        const { currentWidget } = shell;
        return !!(currentWidget && docManager.contextForWidget(currentWidget));
    };
    const isWritable = () => {
        var _a;
        const { currentWidget } = shell;
        if (!currentWidget) {
            return false;
        }
        const context = docManager.contextForWidget(currentWidget);
        return !!((_a = context === null || context === void 0 ? void 0 : context.contentsModel) === null || _a === void 0 ? void 0 : _a.writable);
    };
    const readonlyNotification = (contextPath) => {
        return Notification.warning(trans.__(`%1 is read-only. Use "Save as…" instead.`, contextPath), { autoClose: 5000 });
    };
    // If inside a rich application like JupyterLab, add additional functionality.
    if (labShell) {
        addLabCommands(app, docManager, labShell, widgetOpener, translator);
    }
    commands.addCommand(CommandIDs.deleteFile, {
        label: () => `Delete ${fileType(shell.currentWidget, docManager)}`,
        execute: args => {
            const path = typeof args['path'] === 'undefined' ? '' : args['path'];
            if (!path) {
                const command = CommandIDs.deleteFile;
                throw new Error(`A non-empty path is required for ${command}.`);
            }
            return docManager.deleteFile(path);
        }
    });
    commands.addCommand(CommandIDs.newUntitled, {
        execute: async (args) => {
            const errorTitle = args['error'] || trans.__('Error');
            const path = typeof args['path'] === 'undefined' ? '' : args['path'];
            const options = {
                type: args['type'],
                path
            };
            if (args['type'] === 'file') {
                options.ext = args['ext'] || '.txt';
            }
            return docManager.services.contents
                .newUntitled(options)
                .catch(error => showErrorMessage(errorTitle, error));
        },
        label: args => args['label'] || `New ${args['type']}`
    });
    commands.addCommand(CommandIDs.open, {
        execute: async (args) => {
            const path = typeof args['path'] === 'undefined' ? '' : args['path'];
            const factory = args['factory'] || void 0;
            const kernel = args === null || args === void 0 ? void 0 : args.kernel;
            const options = args['options'] || void 0;
            return docManager.services.contents
                .get(path, { content: false })
                .then(() => docManager.openOrReveal(path, factory, kernel, options));
        },
        iconClass: args => args['icon'] || '',
        label: args => {
            var _a;
            return ((_a = (args['label'] || args['factory'])) !== null && _a !== void 0 ? _a : trans.__('Open the provided `path`.'));
        },
        mnemonic: args => args['mnemonic'] || -1
    });
    commands.addCommand(CommandIDs.reload, {
        label: () => trans.__('Reload %1 from Disk', fileType(shell.currentWidget, docManager)),
        caption: trans.__('Reload contents from disk'),
        isEnabled,
        execute: () => {
            // Checks that shell.currentWidget is valid:
            if (!isEnabled()) {
                return;
            }
            const context = docManager.contextForWidget(shell.currentWidget);
            const type = fileType(shell.currentWidget, docManager);
            if (!context) {
                return showDialog({
                    title: trans.__('Cannot Reload'),
                    body: trans.__('No context found for current widget!'),
                    buttons: [Dialog.okButton()]
                });
            }
            if (context.model.dirty) {
                return showDialog({
                    title: trans.__('Reload %1 from Disk', type),
                    body: trans.__('Are you sure you want to reload the %1 from the disk?', type),
                    buttons: [
                        Dialog.cancelButton(),
                        Dialog.warnButton({ label: trans.__('Reload') })
                    ]
                }).then(result => {
                    if (result.button.accept && !context.isDisposed) {
                        return context.revert();
                    }
                });
            }
            else {
                if (!context.isDisposed) {
                    return context.revert();
                }
            }
        }
    });
    commands.addCommand(CommandIDs.restoreCheckpoint, {
        label: () => trans.__('Revert %1 to Checkpoint…', fileType(shell.currentWidget, docManager)),
        caption: trans.__('Revert contents to previous checkpoint'),
        isEnabled,
        execute: () => {
            // Checks that shell.currentWidget is valid:
            if (!isEnabled()) {
                return;
            }
            const context = docManager.contextForWidget(shell.currentWidget);
            if (!context) {
                return showDialog({
                    title: trans.__('Cannot Revert'),
                    body: trans.__('No context found for current widget!'),
                    buttons: [Dialog.okButton()]
                });
            }
            return context.listCheckpoints().then(async (checkpoints) => {
                const type = fileType(shell.currentWidget, docManager);
                if (checkpoints.length < 1) {
                    await showErrorMessage(trans.__('No checkpoints'), trans.__('No checkpoints are available for this %1.', type));
                    return;
                }
                const targetCheckpoint = checkpoints.length === 1
                    ? checkpoints[0]
                    : await Private.getTargetCheckpoint(checkpoints.reverse(), trans);
                if (!targetCheckpoint) {
                    return;
                }
                return showDialog({
                    title: trans.__('Revert %1 to checkpoint', type),
                    body: new RevertConfirmWidget(targetCheckpoint, trans, type),
                    buttons: [
                        Dialog.cancelButton(),
                        Dialog.warnButton({
                            label: trans.__('Revert'),
                            ariaLabel: trans.__('Revert to Checkpoint')
                        })
                    ]
                }).then(result => {
                    if (context.isDisposed) {
                        return;
                    }
                    if (result.button.accept) {
                        if (context.model.readOnly) {
                            return context.revert();
                        }
                        return context
                            .restoreCheckpoint(targetCheckpoint.id)
                            .then(() => context.revert());
                    }
                });
            });
        }
    });
    const caption = () => {
        if (shell.currentWidget) {
            const context = docManager.contextForWidget(shell.currentWidget);
            if (context === null || context === void 0 ? void 0 : context.model.collaborative) {
                return trans.__('In collaborative mode, the document is saved automatically after every change');
            }
            if (!isWritable()) {
                return trans.__(`Document is read-only. "Save" is disabled; use "Save as…" instead`);
            }
        }
        return trans.__('Save and create checkpoint');
    };
    const saveInProgress = new WeakSet();
    commands.addCommand(CommandIDs.save, {
        label: () => trans.__('Save %1', fileType(shell.currentWidget, docManager)),
        caption,
        icon: args => (args.toolbar ? saveIcon : undefined),
        isEnabled: args => {
            if (args._luminoEvent) {
                return args._luminoEvent.type ===
                    'keybinding'
                    ? true
                    : isWritable();
            }
            else {
                return isWritable();
            }
        },
        execute: async (args) => {
            var _a, _b, _c, _d, _e;
            // Checks that shell.currentWidget is valid:
            const widget = shell.currentWidget;
            const context = docManager.contextForWidget(widget);
            if (isEnabled()) {
                if (!context) {
                    return showDialog({
                        title: trans.__('Cannot Save'),
                        body: trans.__('No context found for current widget!'),
                        buttons: [Dialog.okButton()]
                    });
                }
                else {
                    if (saveInProgress.has(context)) {
                        return;
                    }
                    if (!((_a = context.contentsModel) === null || _a === void 0 ? void 0 : _a.writable) &&
                        !context.model.collaborative) {
                        let type = (_b = args._luminoEvent) === null || _b === void 0 ? void 0 : _b.type;
                        if (args._luminoEvent && type === 'keybinding') {
                            readonlyNotification(context.path);
                            return;
                        }
                        else {
                            return showDialog({
                                title: trans.__('Cannot Save'),
                                body: trans.__('Document is read-only'),
                                buttons: [Dialog.okButton()]
                            });
                        }
                    }
                    saveInProgress.add(context);
                    const oldName = PathExt.basename((_d = (_c = context.contentsModel) === null || _c === void 0 ? void 0 : _c.path) !== null && _d !== void 0 ? _d : '');
                    let newName = oldName;
                    if (docManager.renameUntitledFileOnSave &&
                        widget.isUntitled === true) {
                        const result = await InputDialog.getText({
                            title: trans.__('Rename file'),
                            okLabel: trans.__('Rename'),
                            placeholder: trans.__('File name'),
                            text: oldName,
                            selectionRange: oldName.length - PathExt.extname(oldName).length,
                            checkbox: {
                                label: trans.__('Do not ask me again.'),
                                caption: trans.__('If checked, you will not be asked to rename future untitled files when saving them.')
                            }
                        });
                        if (result.button.accept) {
                            newName = (_e = result.value) !== null && _e !== void 0 ? _e : oldName;
                            widget.isUntitled = false;
                            if (typeof result.isChecked === 'boolean') {
                                const currentSetting = (await settingRegistry.get(docManagerPluginId, 'renameUntitledFileOnSave')).composite;
                                if (result.isChecked === currentSetting) {
                                    settingRegistry
                                        .set(docManagerPluginId, 'renameUntitledFileOnSave', !result.isChecked)
                                        .catch(reason => {
                                        console.error(`Fail to set 'renameUntitledFileOnSave:\n${reason}`);
                                    });
                                }
                            }
                        }
                    }
                    try {
                        await context.save();
                        if (!(widget === null || widget === void 0 ? void 0 : widget.isDisposed)) {
                            return context.createCheckpoint();
                        }
                    }
                    catch (err) {
                        // If the save was canceled by user-action, do nothing.
                        if (err.name === 'ModalCancelError') {
                            return;
                        }
                        throw err;
                    }
                    finally {
                        saveInProgress.delete(context);
                        if (newName !== oldName) {
                            await context.rename(newName);
                        }
                    }
                }
            }
        }
    });
    commands.addCommand(CommandIDs.saveAll, {
        label: () => trans.__('Save All'),
        caption: trans.__('Save all open documents'),
        isEnabled: () => {
            return some(shell.widgets('main'), w => { var _a, _b, _c; return (_c = (_b = (_a = docManager.contextForWidget(w)) === null || _a === void 0 ? void 0 : _a.contentsModel) === null || _b === void 0 ? void 0 : _b.writable) !== null && _c !== void 0 ? _c : false; });
        },
        execute: () => {
            var _a;
            const promises = [];
            const paths = new Set(); // Cache so we don't double save files.
            for (const widget of shell.widgets('main')) {
                const context = docManager.contextForWidget(widget);
                if (context && !paths.has(context.path)) {
                    if ((_a = context.contentsModel) === null || _a === void 0 ? void 0 : _a.writable) {
                        paths.add(context.path);
                        promises.push(context.save());
                    }
                    else {
                        readonlyNotification(context.path);
                    }
                }
            }
            return Promise.all(promises);
        }
    });
    commands.addCommand(CommandIDs.saveAs, {
        label: () => trans.__('Save %1 As…', fileType(shell.currentWidget, docManager)),
        caption: trans.__('Save with new path'),
        isEnabled,
        execute: () => {
            // Checks that shell.currentWidget is valid:
            if (isEnabled()) {
                const context = docManager.contextForWidget(shell.currentWidget);
                if (!context) {
                    return showDialog({
                        title: trans.__('Cannot Save'),
                        body: trans.__('No context found for current widget!'),
                        buttons: [Dialog.okButton()]
                    });
                }
                const onChange = (sender, args) => {
                    if (args.type === 'save' &&
                        args.newValue &&
                        args.newValue.path !== context.path) {
                        void docManager.closeFile(context.path);
                        void commands.execute(CommandIDs.open, {
                            path: args.newValue.path
                        });
                    }
                };
                docManager.services.contents.fileChanged.connect(onChange);
                void context
                    .saveAs()
                    .finally(() => docManager.services.contents.fileChanged.disconnect(onChange));
            }
        }
    });
    (_a = app.shell.currentChanged) === null || _a === void 0 ? void 0 : _a.connect(() => {
        [
            CommandIDs.reload,
            CommandIDs.restoreCheckpoint,
            CommandIDs.save,
            CommandIDs.saveAll,
            CommandIDs.saveAs
        ].forEach(cmd => {
            app.commands.notifyCommandChanged(cmd);
        });
    });
    commands.addCommand(CommandIDs.toggleAutosave, {
        label: trans.__('Autosave Documents'),
        isToggled: () => docManager.autosave,
        execute: () => {
            const value = !docManager.autosave;
            const key = 'autosave';
            return settingRegistry
                .set(docManagerPluginId, key, value)
                .catch((reason) => {
                console.error(`Failed to set ${docManagerPluginId}:${key} - ${reason.message}`);
            });
        }
    });
    if (palette) {
        [
            CommandIDs.reload,
            CommandIDs.restoreCheckpoint,
            CommandIDs.save,
            CommandIDs.saveAs,
            CommandIDs.toggleAutosave,
            CommandIDs.duplicate
        ].forEach(command => {
            palette.addItem({ command, category });
        });
    }
}
function addLabCommands(app, docManager, labShell, widgetOpener, translator) {
    const trans = translator.load('jupyterlab');
    const { commands } = app;
    // Returns the doc widget associated with the most recent contextmenu event.
    const contextMenuWidget = () => {
        var _a;
        const pathRe = /[Pp]ath:\s?(.*)\n?/;
        const test = (node) => { var _a; return !!((_a = node['title']) === null || _a === void 0 ? void 0 : _a.match(pathRe)); };
        const node = app.contextMenuHitTest(test);
        const pathMatch = node === null || node === void 0 ? void 0 : node['title'].match(pathRe);
        return ((_a = (pathMatch && docManager.findWidget(pathMatch[1], null))) !== null && _a !== void 0 ? _a : 
        // Fall back to active doc widget if path cannot be obtained from event.
        labShell.currentWidget);
    };
    // Returns `true` if the current widget has a document context.
    const isEnabled = () => {
        const { currentWidget } = labShell;
        return !!(currentWidget && docManager.contextForWidget(currentWidget));
    };
    commands.addCommand(CommandIDs.clone, {
        label: () => trans.__('New View for %1', fileType(contextMenuWidget(), docManager)),
        isEnabled,
        execute: args => {
            const widget = contextMenuWidget();
            const options = args['options'] || {
                mode: 'split-right'
            };
            if (!widget) {
                return;
            }
            // Clone the widget.
            const child = docManager.cloneWidget(widget);
            if (child) {
                widgetOpener.open(child, options);
            }
        }
    });
    commands.addCommand(CommandIDs.rename, {
        label: () => {
            let t = fileType(contextMenuWidget(), docManager);
            if (t) {
                t = ' ' + t;
            }
            return trans.__('Rename%1…', t);
        },
        isEnabled,
        execute: () => {
            // Implies contextMenuWidget() !== null
            if (isEnabled()) {
                const context = docManager.contextForWidget(contextMenuWidget());
                return renameDialog(docManager, context);
            }
        }
    });
    commands.addCommand(CommandIDs.duplicate, {
        label: () => trans.__('Duplicate %1', fileType(contextMenuWidget(), docManager)),
        isEnabled,
        execute: () => {
            if (isEnabled()) {
                const context = docManager.contextForWidget(contextMenuWidget());
                if (!context) {
                    return;
                }
                return docManager.duplicate(context.path);
            }
        }
    });
    commands.addCommand(CommandIDs.del, {
        label: () => trans.__('Delete %1', fileType(contextMenuWidget(), docManager)),
        isEnabled,
        execute: async () => {
            // Implies contextMenuWidget() !== null
            if (isEnabled()) {
                const context = docManager.contextForWidget(contextMenuWidget());
                if (!context) {
                    return;
                }
                const result = await showDialog({
                    title: trans.__('Delete'),
                    body: trans.__('Are you sure you want to delete %1', context.path),
                    buttons: [
                        Dialog.cancelButton(),
                        Dialog.warnButton({ label: trans.__('Delete') })
                    ]
                });
                if (result.button.accept) {
                    await app.commands.execute('docmanager:delete-file', {
                        path: context.path
                    });
                }
            }
        }
    });
    commands.addCommand(CommandIDs.showInFileBrowser, {
        label: () => trans.__('Show in File Browser'),
        isEnabled,
        execute: async () => {
            const widget = contextMenuWidget();
            const context = widget && docManager.contextForWidget(widget);
            if (!context) {
                return;
            }
            // 'activate' is needed if this command is selected in the "open tabs" sidebar
            await commands.execute('filebrowser:activate', { path: context.path });
            await commands.execute('filebrowser:go-to-path', { path: context.path });
        }
    });
    labShell.currentChanged.connect(() => {
        [
            CommandIDs.clone,
            CommandIDs.rename,
            CommandIDs.duplicate,
            CommandIDs.del,
            CommandIDs.showInFileBrowser
        ].forEach(cmd => {
            app.commands.notifyCommandChanged(cmd);
        });
    });
}
/**
 * Handle dirty state for a context.
 */
function handleContext(status, context) {
    let disposable = null;
    const onStateChanged = (sender, args) => {
        if (args.name === 'dirty') {
            if (args.newValue === true) {
                if (!disposable) {
                    disposable = status.setDirty();
                }
            }
            else if (disposable) {
                disposable.dispose();
                disposable = null;
            }
        }
    };
    void context.ready.then(() => {
        context.model.stateChanged.connect(onStateChanged);
        if (context.model.dirty) {
            disposable = status.setDirty();
        }
    });
    context.disposed.connect(() => {
        if (disposable) {
            disposable.dispose();
        }
    });
}
/**
 * A namespace for private module data.
 */
var Private;
(function (Private) {
    /**
     * A counter for unique IDs.
     */
    Private.id = 0;
    function createRevertConfirmNode(checkpoint, fileType, trans) {
        const body = document.createElement('div');
        const confirmMessage = document.createElement('p');
        const confirmText = document.createTextNode(trans.__('Are you sure you want to revert the %1 to checkpoint? ', fileType));
        const cannotUndoText = document.createElement('strong');
        cannotUndoText.textContent = trans.__('This cannot be undone.');
        confirmMessage.appendChild(confirmText);
        confirmMessage.appendChild(cannotUndoText);
        const lastCheckpointMessage = document.createElement('p');
        const lastCheckpointText = document.createTextNode(trans.__('The checkpoint was last updated at: '));
        const lastCheckpointDate = document.createElement('p');
        const date = new Date(checkpoint.last_modified);
        lastCheckpointDate.style.textAlign = 'center';
        lastCheckpointDate.textContent =
            Time.format(date) + ' (' + Time.formatHuman(date) + ')';
        lastCheckpointMessage.appendChild(lastCheckpointText);
        lastCheckpointMessage.appendChild(lastCheckpointDate);
        body.appendChild(confirmMessage);
        body.appendChild(lastCheckpointMessage);
        return body;
    }
    Private.createRevertConfirmNode = createRevertConfirmNode;
    /**
     * Ask user for a checkpoint to revert to.
     */
    async function getTargetCheckpoint(checkpoints, trans) {
        // the id could be too long to show so use the index instead
        const indexSeparator = '.';
        const items = checkpoints.map((checkpoint, index) => {
            const isoDate = Time.format(checkpoint.last_modified);
            const humanDate = Time.formatHuman(checkpoint.last_modified);
            return `${index}${indexSeparator} ${isoDate} (${humanDate})`;
        });
        const selectedItem = (await InputDialog.getItem({
            items: items,
            title: trans.__('Choose a checkpoint')
        })).value;
        if (!selectedItem) {
            return;
        }
        const selectedIndex = selectedItem.split(indexSeparator, 1)[0];
        return checkpoints[parseInt(selectedIndex, 10)];
    }
    Private.getTargetCheckpoint = getTargetCheckpoint;
})(Private || (Private = {}));
//# sourceMappingURL=index.js.map