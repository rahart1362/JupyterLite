// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.
import { ICommandPalette } from '@jupyterlab/apputils';
import { ForeignHandler, IConsoleTracker } from '@jupyterlab/console';
import { ISettingRegistry } from '@jupyterlab/settingregistry';
import { ITranslator } from '@jupyterlab/translation';
import { AttachedProperty } from '@lumino/properties';
/**
 * The console foreign handler.
 */
export const foreign = {
    id: '@jupyterlab/console-extension:foreign',
    description: 'Add foreign handler of IOPub messages to the console.',
    requires: [IConsoleTracker, ISettingRegistry, ITranslator],
    optional: [ICommandPalette],
    activate: activateForeign,
    autoStart: true
};
export default foreign;
function activateForeign(app, tracker, settingRegistry, translator, palette) {
    var _a;
    const trans = translator.load('jupyterlab');
    const { shell } = app;
    tracker.widgetAdded.connect((sender, widget) => {
        const console = widget.console;
        const handler = new ForeignHandler({
            sessionContext: console.sessionContext,
            parent: console
        });
        Private.foreignHandlerProperty.set(console, handler);
        // Property showAllKernelActivity configures foreign handler enabled on start.
        void settingRegistry
            .get('@jupyterlab/console-extension:tracker', 'showAllKernelActivity')
            .then(({ composite }) => {
            const showAllKernelActivity = composite;
            handler.enabled = showAllKernelActivity;
        });
        console.disposed.connect(() => {
            handler.dispose();
        });
    });
    const { commands } = app;
    const category = trans.__('Console');
    const toggleShowAllActivity = 'console:toggle-show-all-kernel-activity';
    // Get the current widget and activate unless the args specify otherwise.
    function getCurrent(args) {
        const widget = tracker.currentWidget;
        const activate = args['activate'] !== false;
        if (activate && widget) {
            shell.activateById(widget.id);
        }
        return widget;
    }
    commands.addCommand(toggleShowAllActivity, {
        label: args => trans.__('Show All Kernel Activity'),
        execute: args => {
            const current = getCurrent(args);
            if (!current) {
                return;
            }
            const handler = Private.foreignHandlerProperty.get(current.console);
            if (handler) {
                handler.enabled = !handler.enabled;
            }
        },
        isToggled: () => {
            var _a;
            return tracker.currentWidget !== null &&
                !!((_a = Private.foreignHandlerProperty.get(tracker.currentWidget.console)) === null || _a === void 0 ? void 0 : _a.enabled);
        },
        isEnabled: () => tracker.currentWidget !== null &&
            tracker.currentWidget === shell.currentWidget
    });
    const notify = () => {
        commands.notifyCommandChanged(toggleShowAllActivity);
    };
    tracker.currentChanged.connect(notify);
    (_a = shell.currentChanged) === null || _a === void 0 ? void 0 : _a.connect(notify);
    if (palette) {
        palette.addItem({
            command: toggleShowAllActivity,
            category,
            args: { isPalette: true }
        });
    }
}
/*
 * A namespace for private data.
 */
var Private;
(function (Private) {
    /**
     * An attached property for a console's foreign handler.
     */
    Private.foreignHandlerProperty = new AttachedProperty({
        name: 'foreignHandler',
        create: () => undefined
    });
})(Private || (Private = {}));
//# sourceMappingURL=foreign.js.map