// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.
/**
 * @packageDocumentation
 * @module csvviewer-extension
 */
import { ILayoutRestorer } from '@jupyterlab/application';
import { createToolbarFactory, InputDialog, IThemeManager, IToolbarWidgetRegistry, WidgetTracker } from '@jupyterlab/apputils';
import { CSVViewerFactory, TSVViewerFactory } from '@jupyterlab/csvviewer/lib/widget';
import { CSVDelimiter } from '@jupyterlab/csvviewer/lib/toolbar';
import { ISearchProviderRegistry } from '@jupyterlab/documentsearch';
import { IMainMenu } from '@jupyterlab/mainmenu';
import { ISettingRegistry } from '@jupyterlab/settingregistry';
import { ITranslator } from '@jupyterlab/translation';
/**
 * The name of the factories that creates widgets.
 */
const FACTORY_CSV = 'CSVTable';
const FACTORY_TSV = 'TSVTable';
/**
 * The command IDs used by the csvviewer plugins.
 */
var CommandIDs;
(function (CommandIDs) {
    CommandIDs.CSVGoToLine = 'csv:go-to-line';
    CommandIDs.TSVGoToLine = 'tsv:go-to-line';
})(CommandIDs || (CommandIDs = {}));
/**
 * The CSV file handler extension.
 */
const csv = {
    activate: activateCsv,
    id: '@jupyterlab/csvviewer-extension:csv',
    description: 'Adds viewer for CSV file types',
    requires: [ITranslator],
    optional: [
        ILayoutRestorer,
        IThemeManager,
        IMainMenu,
        ISearchProviderRegistry,
        ISettingRegistry,
        IToolbarWidgetRegistry
    ],
    autoStart: true
};
/**
 * The TSV file handler extension.
 */
const tsv = {
    activate: activateTsv,
    id: '@jupyterlab/csvviewer-extension:tsv',
    description: 'Adds viewer for TSV file types.',
    requires: [ITranslator],
    optional: [
        ILayoutRestorer,
        IThemeManager,
        IMainMenu,
        ISearchProviderRegistry,
        ISettingRegistry,
        IToolbarWidgetRegistry
    ],
    autoStart: true
};
/**
 * Activate cssviewer extension for CSV files
 */
function activateCsv(app, translator, restorer, themeManager, mainMenu, searchRegistry, settingRegistry, toolbarRegistry) {
    var _a;
    const { commands, shell } = app;
    let toolbarFactory;
    if (toolbarRegistry) {
        toolbarRegistry.addFactory(FACTORY_CSV, 'delimiter', widget => new CSVDelimiter({
            widget: widget.content,
            translator
        }));
        if (settingRegistry) {
            toolbarFactory = createToolbarFactory(toolbarRegistry, settingRegistry, FACTORY_CSV, csv.id, translator);
        }
    }
    const trans = translator.load('jupyterlab');
    const factory = new CSVViewerFactory({
        name: FACTORY_CSV,
        label: trans.__('CSV Viewer'),
        fileTypes: ['csv'],
        defaultFor: ['csv'],
        readOnly: true,
        toolbarFactory,
        translator
    });
    const tracker = new WidgetTracker({
        namespace: 'csvviewer'
    });
    // The current styles for the data grids.
    let style = Private.LIGHT_STYLE;
    let rendererConfig = Private.LIGHT_TEXT_CONFIG;
    if (restorer) {
        // Handle state restoration.
        void restorer.restore(tracker, {
            command: 'docmanager:open',
            args: widget => ({ path: widget.context.path, factory: FACTORY_CSV }),
            name: widget => widget.context.path
        });
    }
    app.docRegistry.addWidgetFactory(factory);
    const ft = app.docRegistry.getFileType('csv');
    let searchProviderInitialized = false;
    factory.widgetCreated.connect(async (sender, widget) => {
        // Track the widget.
        void tracker.add(widget);
        // Notify the widget tracker if restore data needs to update.
        widget.context.pathChanged.connect(() => {
            void tracker.save(widget);
        });
        if (ft) {
            widget.title.icon = ft.icon;
            widget.title.iconClass = ft.iconClass;
            widget.title.iconLabel = ft.iconLabel;
        }
        // Delay await to execute `widget.title` setters (above) synchronously
        if (searchRegistry && !searchProviderInitialized) {
            const { CSVSearchProvider } = await import('./searchprovider');
            searchRegistry.add('csv', CSVSearchProvider);
            searchProviderInitialized = true;
        }
        // Set the theme for the new widget; requires `.content` to be loaded.
        await widget.content.ready;
        widget.content.style = style;
        widget.content.rendererConfig = rendererConfig;
    });
    // Keep the themes up-to-date.
    const updateThemes = () => {
        const isLight = themeManager && themeManager.theme
            ? themeManager.isLight(themeManager.theme)
            : true;
        style = isLight ? Private.LIGHT_STYLE : Private.DARK_STYLE;
        rendererConfig = isLight
            ? Private.LIGHT_TEXT_CONFIG
            : Private.DARK_TEXT_CONFIG;
        tracker.forEach(async (grid) => {
            await grid.content.ready;
            grid.content.style = style;
            grid.content.rendererConfig = rendererConfig;
        });
    };
    if (themeManager) {
        themeManager.themeChanged.connect(updateThemes);
    }
    // Add commands
    const isEnabled = () => tracker.currentWidget !== null &&
        tracker.currentWidget === shell.currentWidget;
    commands.addCommand(CommandIDs.CSVGoToLine, {
        label: trans.__('Go to Line'),
        execute: async () => {
            const widget = tracker.currentWidget;
            if (widget === null) {
                return;
            }
            const result = await InputDialog.getNumber({
                title: trans.__('Go to Line'),
                value: 0
            });
            if (result.button.accept && result.value !== null) {
                widget.content.goToLine(result.value);
            }
        },
        isEnabled
    });
    if (mainMenu) {
        // Add go to line capability to the edit menu.
        mainMenu.editMenu.goToLiners.add({
            id: CommandIDs.CSVGoToLine,
            isEnabled
        });
    }
    const notify = () => {
        commands.notifyCommandChanged(CommandIDs.CSVGoToLine);
    };
    tracker.currentChanged.connect(notify);
    (_a = shell.currentChanged) === null || _a === void 0 ? void 0 : _a.connect(notify);
}
/**
 * Activate cssviewer extension for TSV files
 */
function activateTsv(app, translator, restorer, themeManager, mainMenu, searchRegistry, settingRegistry, toolbarRegistry) {
    const { commands, shell } = app;
    let toolbarFactory;
    if (toolbarRegistry) {
        toolbarRegistry.addFactory(FACTORY_TSV, 'delimiter', widget => new CSVDelimiter({
            widget: widget.content,
            translator
        }));
        if (settingRegistry) {
            toolbarFactory = createToolbarFactory(toolbarRegistry, settingRegistry, FACTORY_TSV, tsv.id, translator);
        }
    }
    const trans = translator.load('jupyterlab');
    const factory = new TSVViewerFactory({
        name: FACTORY_TSV,
        label: trans.__('TSV Viewer'),
        fileTypes: ['tsv'],
        defaultFor: ['tsv'],
        readOnly: true,
        toolbarFactory,
        translator
    });
    const tracker = new WidgetTracker({
        namespace: 'tsvviewer'
    });
    // The current styles for the data grids.
    let style = Private.LIGHT_STYLE;
    let rendererConfig = Private.LIGHT_TEXT_CONFIG;
    if (restorer) {
        // Handle state restoration.
        void restorer.restore(tracker, {
            command: 'docmanager:open',
            args: widget => ({ path: widget.context.path, factory: FACTORY_TSV }),
            name: widget => widget.context.path
        });
    }
    app.docRegistry.addWidgetFactory(factory);
    const ft = app.docRegistry.getFileType('tsv');
    let searchProviderInitialized = false;
    factory.widgetCreated.connect(async (sender, widget) => {
        // Track the widget.
        void tracker.add(widget);
        // Notify the widget tracker if restore data needs to update.
        widget.context.pathChanged.connect(() => {
            void tracker.save(widget);
        });
        if (ft) {
            widget.title.icon = ft.icon;
            widget.title.iconClass = ft.iconClass;
            widget.title.iconLabel = ft.iconLabel;
        }
        // Delay await to execute `widget.title` setters (above) synchronously
        if (searchRegistry && !searchProviderInitialized) {
            const { CSVSearchProvider } = await import('./searchprovider');
            searchRegistry.add('tsv', CSVSearchProvider);
            searchProviderInitialized = true;
        }
        // Set the theme for the new widget; requires `.content` to be loaded.
        await widget.content.ready;
        widget.content.style = style;
        widget.content.rendererConfig = rendererConfig;
    });
    // Keep the themes up-to-date.
    const updateThemes = () => {
        const isLight = themeManager && themeManager.theme
            ? themeManager.isLight(themeManager.theme)
            : true;
        style = isLight ? Private.LIGHT_STYLE : Private.DARK_STYLE;
        rendererConfig = isLight
            ? Private.LIGHT_TEXT_CONFIG
            : Private.DARK_TEXT_CONFIG;
        tracker.forEach(async (grid) => {
            await grid.content.ready;
            grid.content.style = style;
            grid.content.rendererConfig = rendererConfig;
        });
    };
    if (themeManager) {
        themeManager.themeChanged.connect(updateThemes);
    }
    // Add commands
    const isEnabled = () => tracker.currentWidget !== null &&
        tracker.currentWidget === shell.currentWidget;
    commands.addCommand(CommandIDs.TSVGoToLine, {
        label: trans.__('Go to Line'),
        execute: async () => {
            const widget = tracker.currentWidget;
            if (widget === null) {
                return;
            }
            const result = await InputDialog.getNumber({
                title: trans.__('Go to Line'),
                value: 0
            });
            if (result.button.accept && result.value !== null) {
                widget.content.goToLine(result.value);
            }
        },
        isEnabled
    });
    if (mainMenu) {
        // Add go to line capability to the edit menu.
        mainMenu.editMenu.goToLiners.add({
            id: CommandIDs.TSVGoToLine,
            isEnabled
        });
    }
    tracker.currentChanged.connect(() => {
        commands.notifyCommandChanged(CommandIDs.TSVGoToLine);
    });
}
/**
 * Export the plugins as default.
 */
const plugins = [csv, tsv];
export default plugins;
/**
 * A namespace for private data.
 */
var Private;
(function (Private) {
    /**
     * The light theme for the data grid.
     */
    Private.LIGHT_STYLE = {
        voidColor: '#F3F3F3',
        backgroundColor: 'white',
        headerBackgroundColor: '#EEEEEE',
        gridLineColor: 'rgba(20, 20, 20, 0.15)',
        headerGridLineColor: 'rgba(20, 20, 20, 0.25)',
        rowBackgroundColor: i => (i % 2 === 0 ? '#F5F5F5' : 'white')
    };
    /**
     * The dark theme for the data grid.
     */
    Private.DARK_STYLE = {
        voidColor: 'black',
        backgroundColor: '#111111',
        headerBackgroundColor: '#424242',
        gridLineColor: 'rgba(235, 235, 235, 0.15)',
        headerGridLineColor: 'rgba(235, 235, 235, 0.25)',
        rowBackgroundColor: i => (i % 2 === 0 ? '#212121' : '#111111')
    };
    /**
     * The light config for the data grid renderer.
     */
    Private.LIGHT_TEXT_CONFIG = {
        textColor: '#111111',
        matchBackgroundColor: '#FFFFE0',
        currentMatchBackgroundColor: '#FFFF00',
        horizontalAlignment: 'right'
    };
    /**
     * The dark config for the data grid renderer.
     */
    Private.DARK_TEXT_CONFIG = {
        textColor: '#F5F5F5',
        matchBackgroundColor: '#838423',
        currentMatchBackgroundColor: '#A3807A',
        horizontalAlignment: 'right'
    };
})(Private || (Private = {}));
//# sourceMappingURL=index.js.map