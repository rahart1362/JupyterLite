// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.
import { ILoggerRegistry } from '@jupyterlab/logconsole';
import { INotebookTracker } from '@jupyterlab/notebook';
import { KernelMessage } from '@jupyterlab/services';
/**
 * The Log Console extension.
 */
export const logNotebookOutput = {
    activate: activateNBOutput,
    id: '@jupyterlab/notebook-extension:log-output',
    description: 'Adds cell outputs log to the application logger.',
    requires: [INotebookTracker],
    optional: [ILoggerRegistry],
    autoStart: true
};
function activateNBOutput(app, nbtracker, loggerRegistry) {
    if (!loggerRegistry) {
        // Automatically disable if logconsole is missing
        return;
    }
    function registerNB(nb) {
        function logOutput(msg, levelNormal, levelError) {
            if (KernelMessage.isDisplayDataMsg(msg) ||
                KernelMessage.isStreamMsg(msg) ||
                KernelMessage.isErrorMsg(msg) ||
                KernelMessage.isExecuteResultMsg(msg)) {
                const logger = loggerRegistry.getLogger(nb.context.path);
                logger.rendermime = nb.content.rendermime;
                const data = {
                    ...msg.content,
                    output_type: msg.header.msg_type
                };
                let level = levelNormal;
                if (KernelMessage.isErrorMsg(msg) ||
                    (KernelMessage.isStreamMsg(msg) && msg.content.name === 'stderr')) {
                    level = levelError;
                }
                logger.log({ type: 'output', data, level });
            }
        }
        // There is overlap here since unhandled messages are also emitted in the
        // iopubMessage signal. However, unhandled messages warrant a higher log
        // severity, so we'll accept that they are logged twice.
        nb.context.sessionContext.iopubMessage.connect((_, msg) => logOutput(msg, 'info', 'info'));
        nb.context.sessionContext.unhandledMessage.connect((_, msg) => logOutput(msg, 'warning', 'error'));
    }
    nbtracker.forEach(nb => registerNB(nb));
    nbtracker.widgetAdded.connect((_, nb) => registerNB(nb));
}
//# sourceMappingURL=nboutput.js.map