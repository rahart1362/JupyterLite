// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.
/**
 * @packageDocumentation
 * @module terminal-extension
 */
import { ILayoutRestorer } from '@jupyterlab/application';
import { Clipboard, ICommandPalette, IThemeManager, MainAreaWidget, WidgetTracker } from '@jupyterlab/apputils';
import { ILauncher } from '@jupyterlab/launcher';
import { IMainMenu } from '@jupyterlab/mainmenu';
import { IRunningSessionManagers } from '@jupyterlab/running';
import { TerminalAPI } from '@jupyterlab/services';
import { ISettingRegistry } from '@jupyterlab/settingregistry';
import { ITerminalTracker, Terminal as XTerm } from '@jupyterlab/terminal';
import { ITranslator } from '@jupyterlab/translation';
import { copyIcon, pasteIcon, refreshIcon, terminalIcon } from '@jupyterlab/ui-components';
import { Menu } from '@lumino/widgets';
/**
 * The command IDs used by the terminal plugin.
 */
var CommandIDs;
(function (CommandIDs) {
    CommandIDs.copy = 'terminal:copy';
    CommandIDs.createNew = 'terminal:create-new';
    CommandIDs.open = 'terminal:open';
    CommandIDs.refresh = 'terminal:refresh';
    CommandIDs.increaseFont = 'terminal:increase-font';
    CommandIDs.decreaseFont = 'terminal:decrease-font';
    CommandIDs.paste = 'terminal:paste';
    CommandIDs.setTheme = 'terminal:set-theme';
    CommandIDs.shutdown = 'terminal:shut-down';
})(CommandIDs || (CommandIDs = {}));
/**
 * The default terminal extension.
 */
const plugin = {
    activate,
    id: '@jupyterlab/terminal-extension:plugin',
    description: 'Adds terminal and provides its tracker.',
    provides: ITerminalTracker,
    requires: [ISettingRegistry, ITranslator],
    optional: [
        ICommandPalette,
        ILauncher,
        ILayoutRestorer,
        IMainMenu,
        IThemeManager,
        IRunningSessionManagers
    ],
    autoStart: true
};
/**
 * Export the plugin as default.
 */
export default plugin;
/**
 * Activate the terminal plugin.
 */
function activate(app, settingRegistry, translator, palette, launcher, restorer, mainMenu, themeManager, runningSessionManagers) {
    const trans = translator.load('jupyterlab');
    const { serviceManager, commands } = app;
    const category = trans.__('Terminal');
    const namespace = 'terminal';
    const tracker = new WidgetTracker({
        namespace
    });
    // Bail if there are no terminals available.
    if (!serviceManager.terminals.isAvailable()) {
        console.warn('Disabling terminals plugin because they are not available on the server');
        return tracker;
    }
    // Handle state restoration.
    if (restorer) {
        void restorer.restore(tracker, {
            command: CommandIDs.createNew,
            args: widget => ({ name: widget.content.session.name }),
            name: widget => widget.content.session.name
        });
    }
    // The cached terminal options from the setting editor.
    const options = {};
    /**
     * Update the cached option values.
     */
    function updateOptions(settings) {
        // Update the cached options by doing a shallow copy of key/values.
        // This is needed because options is passed and used in addcommand-palette and needs
        // to reflect the current cached values.
        Object.keys(settings.composite).forEach((key) => {
            options[key] = settings.composite[key];
        });
    }
    /**
     * Update terminal
     */
    function updateTerminal(widget) {
        const terminal = widget.content;
        if (!terminal) {
            return;
        }
        Object.keys(options).forEach((key) => {
            terminal.setOption(key, options[key]);
        });
    }
    /**
     * Update the settings of the current tracker instances.
     */
    function updateTracker() {
        tracker.forEach(widget => updateTerminal(widget));
    }
    // Fetch the initial state of the settings.
    settingRegistry
        .load(plugin.id)
        .then(settings => {
        updateOptions(settings);
        updateTracker();
        settings.changed.connect(() => {
            updateOptions(settings);
            updateTracker();
        });
    })
        .catch(Private.showErrorMessage);
    // Subscribe to changes in theme. This is needed as the theme
    // is computed dynamically based on the string value and DOM
    // properties.
    themeManager === null || themeManager === void 0 ? void 0 : themeManager.themeChanged.connect((sender, args) => {
        tracker.forEach(widget => {
            const terminal = widget.content;
            if (terminal.getOption('theme') === 'inherit') {
                terminal.setOption('theme', 'inherit');
            }
        });
    });
    addCommands(app, tracker, settingRegistry, translator, options);
    if (mainMenu) {
        // Add "Terminal Theme" menu below "Theme" menu.
        const themeMenu = new Menu({ commands });
        themeMenu.title.label = trans._p('menu', 'Terminal Theme');
        themeMenu.addItem({
            command: CommandIDs.setTheme,
            args: {
                theme: 'inherit',
                displayName: trans.__('Inherit'),
                isPalette: false
            }
        });
        themeMenu.addItem({
            command: CommandIDs.setTheme,
            args: {
                theme: 'light',
                displayName: trans.__('Light'),
                isPalette: false
            }
        });
        themeMenu.addItem({
            command: CommandIDs.setTheme,
            args: { theme: 'dark', displayName: trans.__('Dark'), isPalette: false }
        });
        // Add some commands to the "View" menu.
        mainMenu.settingsMenu.addGroup([
            { command: CommandIDs.increaseFont },
            { command: CommandIDs.decreaseFont },
            { type: 'submenu', submenu: themeMenu }
        ], 40);
        // Add terminal creation to the file menu.
        mainMenu.fileMenu.newMenu.addItem({
            command: CommandIDs.createNew,
            rank: 20
        });
        // Add terminal close-and-shutdown to the file menu.
        mainMenu.fileMenu.closeAndCleaners.add({
            id: CommandIDs.shutdown,
            isEnabled: (w) => tracker.currentWidget !== null && tracker.has(w)
        });
    }
    if (palette) {
        // Add command palette items.
        [
            CommandIDs.createNew,
            CommandIDs.refresh,
            CommandIDs.increaseFont,
            CommandIDs.decreaseFont
        ].forEach(command => {
            palette.addItem({ command, category, args: { isPalette: true } });
        });
        palette.addItem({
            command: CommandIDs.setTheme,
            category,
            args: {
                theme: 'inherit',
                displayName: trans.__('Inherit'),
                isPalette: true
            }
        });
        palette.addItem({
            command: CommandIDs.setTheme,
            category,
            args: { theme: 'light', displayName: trans.__('Light'), isPalette: true }
        });
        palette.addItem({
            command: CommandIDs.setTheme,
            category,
            args: { theme: 'dark', displayName: trans.__('Dark'), isPalette: true }
        });
    }
    // Add a launcher item if the launcher is available.
    if (launcher) {
        launcher.add({
            command: CommandIDs.createNew,
            category: trans.__('Other'),
            rank: 0
        });
    }
    // Add a sessions manager if the running extension is available
    if (runningSessionManagers) {
        addRunningSessionManager(runningSessionManagers, app, translator);
    }
    return tracker;
}
/**
 * Add the running terminal manager to the running panel.
 */
function addRunningSessionManager(managers, app, translator) {
    const trans = translator.load('jupyterlab');
    const manager = app.serviceManager.terminals;
    class RunningTerminal {
        constructor(model) {
            this._model = model;
        }
        open() {
            void app.commands.execute('terminal:open', { name: this._model.name });
        }
        icon() {
            return terminalIcon;
        }
        label() {
            return `terminals/${this._model.name}`;
        }
        shutdown() {
            return manager.shutdown(this._model.name);
        }
    }
    managers.add({
        name: trans.__('Terminals'),
        supportsMultipleViews: false,
        running: () => Array.from(manager.running()).map(model => new RunningTerminal(model)),
        shutdownAll: () => manager.shutdownAll(),
        refreshRunning: () => manager.refreshRunning(),
        runningChanged: manager.runningChanged,
        shutdownLabel: trans.__('Shut Down'),
        shutdownAllLabel: trans.__('Shut Down All'),
        shutdownAllConfirmationText: trans.__('Are you sure you want to permanently shut down all running terminals?')
    });
}
/**
 * Add the commands for the terminal.
 */
function addCommands(app, tracker, settingRegistry, translator, options) {
    var _a;
    const trans = translator.load('jupyterlab');
    const { commands, serviceManager } = app;
    const isEnabled = () => tracker.currentWidget !== null &&
        tracker.currentWidget === app.shell.currentWidget;
    // Add terminal commands.
    commands.addCommand(CommandIDs.createNew, {
        label: args => args['isPalette'] ? trans.__('New Terminal') : trans.__('Terminal'),
        caption: trans.__('Start a new terminal session'),
        icon: args => (args['isPalette'] ? undefined : terminalIcon),
        execute: async (args) => {
            const name = args['name'];
            const cwd = args['cwd'];
            const localPath = cwd
                ? serviceManager.contents.localPath(cwd)
                : undefined;
            let session;
            if (name) {
                const models = await TerminalAPI.listRunning(serviceManager.serverSettings);
                if (models.map(d => d.name).includes(name)) {
                    // we are restoring a terminal widget and the corresponding terminal exists
                    // let's connect to it
                    session = serviceManager.terminals.connectTo({ model: { name } });
                }
                else {
                    // we are restoring a terminal widget but the corresponding terminal was closed
                    // let's start a new terminal with the original name
                    session = await serviceManager.terminals.startNew({
                        name,
                        cwd: localPath
                    });
                }
            }
            else {
                // we are creating a new terminal widget with a new terminal
                // let the server choose the terminal name
                session = await serviceManager.terminals.startNew({ cwd: localPath });
            }
            const term = new XTerm(session, options, translator);
            term.title.icon = terminalIcon;
            term.title.label = '...';
            const main = new MainAreaWidget({ content: term, reveal: term.ready });
            app.shell.add(main, 'main', { type: 'Terminal' });
            void tracker.add(main);
            app.shell.activateById(main.id);
            return main;
        }
    });
    commands.addCommand(CommandIDs.open, {
        label: trans.__('Open a terminal by its `name`.'),
        execute: args => {
            const name = args['name'];
            // Check for a running terminal with the given name.
            const widget = tracker.find(value => {
                const content = value.content;
                return content.session.name === name || false;
            });
            if (widget) {
                app.shell.activateById(widget.id);
            }
            else {
                // Otherwise, create a new terminal with a given name.
                return commands.execute(CommandIDs.createNew, { name });
            }
        }
    });
    commands.addCommand(CommandIDs.refresh, {
        label: trans.__('Refresh Terminal'),
        caption: trans.__('Refresh the current terminal session'),
        execute: async () => {
            const current = tracker.currentWidget;
            if (!current) {
                return;
            }
            app.shell.activateById(current.id);
            try {
                await current.content.refresh();
                if (current) {
                    current.content.activate();
                }
            }
            catch (err) {
                Private.showErrorMessage(err);
            }
        },
        icon: args => args['isPalette']
            ? undefined
            : refreshIcon.bindprops({ stylesheet: 'menuItem' }),
        isEnabled
    });
    /**
     * Add copy command
     */
    commands.addCommand(CommandIDs.copy, {
        execute: () => {
            var _a;
            const widget = (_a = tracker.currentWidget) === null || _a === void 0 ? void 0 : _a.content;
            if (!widget) {
                return;
            }
            const text = widget.getSelection();
            if (text) {
                Clipboard.copyToSystem(text);
                // Focus the widget to ensure user can continue typing
                widget.activate();
            }
        },
        isEnabled: () => {
            var _a;
            if (!isEnabled()) {
                return false;
            }
            const widget = (_a = tracker.currentWidget) === null || _a === void 0 ? void 0 : _a.content;
            if (!widget) {
                return false;
            }
            // Enable command if there is a text selection in the terminal
            return widget.hasSelection();
        },
        icon: copyIcon.bindprops({ stylesheet: 'menuItem' }),
        label: trans.__('Copy')
    });
    /**
     * Add paste command
     */
    commands.addCommand(CommandIDs.paste, {
        execute: async () => {
            var _a;
            const widget = (_a = tracker.currentWidget) === null || _a === void 0 ? void 0 : _a.content;
            if (!widget) {
                return;
            }
            // Get data from clipboard
            const clipboard = window.navigator.clipboard;
            const clipboardData = await clipboard.readText();
            if (clipboardData) {
                // Paste data to the terminal
                widget.paste(clipboardData);
                // Focus the widget to ensure user can continue typing
                widget.activate();
            }
        },
        isEnabled: () => { var _a; return Boolean(isEnabled() && ((_a = tracker.currentWidget) === null || _a === void 0 ? void 0 : _a.content)); },
        icon: pasteIcon.bindprops({ stylesheet: 'menuItem' }),
        label: trans.__('Paste')
    });
    commands.addCommand(CommandIDs.shutdown, {
        label: trans.__('Shutdown Terminal'),
        execute: () => {
            const current = tracker.currentWidget;
            if (!current) {
                return;
            }
            // The widget is automatically disposed upon session shutdown.
            return current.content.session.shutdown();
        },
        isEnabled
    });
    commands.addCommand(CommandIDs.increaseFont, {
        label: trans.__('Increase Terminal Font Size'),
        execute: async () => {
            const { fontSize } = options;
            if (fontSize && fontSize < 72) {
                try {
                    await settingRegistry.set(plugin.id, 'fontSize', fontSize + 1);
                }
                catch (err) {
                    Private.showErrorMessage(err);
                }
            }
        }
    });
    commands.addCommand(CommandIDs.decreaseFont, {
        label: trans.__('Decrease Terminal Font Size'),
        execute: async () => {
            const { fontSize } = options;
            if (fontSize && fontSize > 9) {
                try {
                    await settingRegistry.set(plugin.id, 'fontSize', fontSize - 1);
                }
                catch (err) {
                    Private.showErrorMessage(err);
                }
            }
        }
    });
    const themeDisplayedName = {
        inherit: trans.__('Inherit'),
        light: trans.__('Light'),
        dark: trans.__('Dark')
    };
    commands.addCommand(CommandIDs.setTheme, {
        label: args => {
            if (args.theme === undefined) {
                return trans.__('Set terminal theme to the provided `theme`.');
            }
            const theme = args['theme'];
            const displayName = theme in themeDisplayedName
                ? themeDisplayedName[theme]
                : trans.__(theme[0].toUpperCase() + theme.slice(1));
            return args['isPalette']
                ? trans.__('Use Terminal Theme: %1', displayName)
                : displayName;
        },
        caption: trans.__('Set the terminal theme'),
        isToggled: args => {
            const { theme } = options;
            return args['theme'] === theme;
        },
        execute: async (args) => {
            const theme = args['theme'];
            try {
                await settingRegistry.set(plugin.id, 'theme', theme);
                commands.notifyCommandChanged(CommandIDs.setTheme);
            }
            catch (err) {
                console.log(err);
                Private.showErrorMessage(err);
            }
        }
    });
    // All commands with isEnabled defined directly or in a semantic commands
    const commandIds = [
        CommandIDs.refresh,
        CommandIDs.copy,
        CommandIDs.paste,
        CommandIDs.shutdown
    ];
    const notify = () => {
        commandIds.forEach(id => commands.notifyCommandChanged(id));
    };
    tracker.currentChanged.connect(notify);
    (_a = app.shell.currentChanged) === null || _a === void 0 ? void 0 : _a.connect(notify);
}
/**
 * A namespace for private data.
 */
var Private;
(function (Private) {
    /**
     *  Utility function for consistent error reporting
     */
    function showErrorMessage(error) {
        console.error(`Failed to configure ${plugin.id}: ${error.message}`);
    }
    Private.showErrorMessage = showErrorMessage;
})(Private || (Private = {}));
//# sourceMappingURL=index.js.map