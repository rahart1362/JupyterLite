// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.
/**
 * @packageDocumentation
 * @module markdownviewer-extension
 */
import { ILayoutRestorer } from '@jupyterlab/application';
import { ISanitizer, WidgetTracker } from '@jupyterlab/apputils';
import { PathExt } from '@jupyterlab/coreutils';
import { IMarkdownViewerTracker, MarkdownViewer, MarkdownViewerFactory, MarkdownViewerTableOfContentsFactory } from '@jupyterlab/markdownviewer';
import { IRenderMimeRegistry, markdownRendererFactory } from '@jupyterlab/rendermime';
import { ISettingRegistry } from '@jupyterlab/settingregistry';
import { ITableOfContentsRegistry } from '@jupyterlab/toc';
import { ITranslator } from '@jupyterlab/translation';
/**
 * The command IDs used by the markdownviewer plugin.
 */
var CommandIDs;
(function (CommandIDs) {
    CommandIDs.markdownPreview = 'markdownviewer:open';
    CommandIDs.markdownEditor = 'markdownviewer:edit';
})(CommandIDs || (CommandIDs = {}));
/**
 * The name of the factory that creates markdown viewer widgets.
 */
const FACTORY = 'Markdown Preview';
/**
 * The markdown viewer plugin.
 */
const plugin = {
    activate,
    id: '@jupyterlab/markdownviewer-extension:plugin',
    description: 'Adds markdown file viewer and provides its tracker.',
    provides: IMarkdownViewerTracker,
    requires: [IRenderMimeRegistry, ITranslator],
    optional: [
        ILayoutRestorer,
        ISettingRegistry,
        ITableOfContentsRegistry,
        ISanitizer
    ],
    autoStart: true
};
/**
 * Activate the markdown viewer plugin.
 */
function activate(app, rendermime, translator, restorer, settingRegistry, tocRegistry, sanitizer) {
    const trans = translator.load('jupyterlab');
    const { commands, docRegistry } = app;
    // Add the markdown renderer factory.
    rendermime.addFactory(markdownRendererFactory);
    const namespace = 'markdownviewer-widget';
    const tracker = new WidgetTracker({
        namespace
    });
    let config = {
        ...MarkdownViewer.defaultConfig
    };
    /**
     * Update the settings of a widget.
     */
    function updateWidget(widget) {
        Object.keys(config).forEach((k) => {
            var _a;
            widget.setOption(k, (_a = config[k]) !== null && _a !== void 0 ? _a : null);
        });
    }
    if (settingRegistry) {
        const updateSettings = (settings) => {
            config = settings.composite;
            tracker.forEach(widget => {
                updateWidget(widget.content);
            });
        };
        // Fetch the initial state of the settings.
        settingRegistry
            .load(plugin.id)
            .then((settings) => {
            settings.changed.connect(() => {
                updateSettings(settings);
            });
            updateSettings(settings);
        })
            .catch((reason) => {
            console.error(reason.message);
        });
    }
    // Register the MarkdownViewer factory.
    const factory = new MarkdownViewerFactory({
        rendermime,
        name: FACTORY,
        label: trans.__('Markdown Preview'),
        primaryFileType: docRegistry.getFileType('markdown'),
        fileTypes: ['markdown'],
        defaultRendered: ['markdown']
    });
    factory.widgetCreated.connect((sender, widget) => {
        // Notify the widget tracker if restore data needs to update.
        widget.context.pathChanged.connect(() => {
            void tracker.save(widget);
        });
        // Handle the settings of new widgets.
        updateWidget(widget.content);
        void tracker.add(widget);
    });
    docRegistry.addWidgetFactory(factory);
    // Handle state restoration.
    if (restorer) {
        void restorer.restore(tracker, {
            command: 'docmanager:open',
            args: widget => ({ path: widget.context.path, factory: FACTORY }),
            name: widget => widget.context.path
        });
    }
    commands.addCommand(CommandIDs.markdownPreview, {
        label: trans.__('Markdown Preview'),
        execute: args => {
            const path = args['path'];
            if (typeof path !== 'string') {
                return;
            }
            return commands.execute('docmanager:open', {
                path,
                factory: FACTORY,
                options: args['options']
            });
        }
    });
    commands.addCommand(CommandIDs.markdownEditor, {
        execute: () => {
            const widget = tracker.currentWidget;
            if (!widget) {
                return;
            }
            const path = widget.context.path;
            return commands.execute('docmanager:open', {
                path,
                factory: 'Editor',
                options: {
                    mode: 'split-right'
                }
            });
        },
        isVisible: () => {
            const widget = tracker.currentWidget;
            return ((widget && PathExt.extname(widget.context.path) === '.md') || false);
        },
        label: trans.__('Show Markdown Editor')
    });
    if (tocRegistry) {
        tocRegistry.add(new MarkdownViewerTableOfContentsFactory(tracker, rendermime.markdownParser, sanitizer !== null && sanitizer !== void 0 ? sanitizer : rendermime.sanitizer));
    }
    return tracker;
}
/**
 * Export the plugin as default.
 */
export default plugin;
//# sourceMappingURL=index.js.map