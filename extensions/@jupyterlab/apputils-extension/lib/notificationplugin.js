/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */
import { Notification, ReactWidget } from '@jupyterlab/apputils';
import { ISettingRegistry } from '@jupyterlab/settingregistry';
import { GroupItem, IStatusBar, showPopup, TextItem } from '@jupyterlab/statusbar';
import { ITranslator, nullTranslator } from '@jupyterlab/translation';
import { bellIcon, Button, closeIcon, deleteIcon, ToolbarButtonComponent, UseSignal, VDomModel } from '@jupyterlab/ui-components';
import { PromiseDelegate } from '@lumino/coreutils';
import { Widget } from '@lumino/widgets';
import * as React from 'react';
import { createRoot } from 'react-dom/client';
/**
 * Toast close button class
 */
const TOAST_CLOSE_BUTTON_CLASS = 'jp-Notification-Toast-Close';
/**
 * Toast close button class right margin required due to custom hover effect
 */
const TOAST_CLOSE_BUTTON_MARGIN_CLASS = 'jp-Notification-Toast-Close-Margin';
/**
 * Maximal number of characters displayed in a notification.
 */
const MAX_MESSAGE_LENGTH = 140;
var CommandIDs;
(function (CommandIDs) {
    /**
     * Dismiss a notification
     */
    CommandIDs.dismiss = 'apputils:dismiss-notification';
    /**
     * Display all notifications
     */
    CommandIDs.display = 'apputils:display-notifications';
    /**
     * Create a notification
     */
    CommandIDs.notify = 'apputils:notify';
    /**
     * Update a notification
     */
    CommandIDs.update = 'apputils:update-notification';
})(CommandIDs || (CommandIDs = {}));
/**
 * Half spacing between subitems in a status item.
 */
const HALF_SPACING = 4;
/**
 * Notification center view
 */
function NotificationCenter(props) {
    const { manager, onClose, trans } = props;
    // Markdown parsed notifications
    const [notifications, setNotifications] = React.useState([]);
    // Load asynchronously react-toastify icons
    const [icons, setIcons] = React.useState(null);
    React.useEffect(() => {
        async function onChanged() {
            setNotifications(await Promise.all(manager.notifications.map(async (n) => {
                return Object.freeze({
                    ...n
                });
            })));
        }
        if (notifications.length !== manager.count) {
            void onChanged();
        }
        manager.changed.connect(onChanged);
        return () => {
            manager.changed.disconnect(onChanged);
        };
    }, [manager]);
    React.useEffect(() => {
        Private.getIcons()
            .then(toastifyIcons => {
            setIcons(toastifyIcons);
        })
            .catch(r => {
            console.error(`Failed to get react-toastify icons:\n${r}`);
        });
    }, []);
    return (React.createElement(UseSignal, { signal: manager.changed }, () => (React.createElement(React.Fragment, null,
        React.createElement("h2", { className: "jp-Notification-Header jp-Toolbar" },
            React.createElement("span", { className: "jp-Toolbar-item" }, manager.count > 0
                ? trans._n('%1 notification', '%1 notifications', manager.count)
                : trans.__('No notifications')),
            React.createElement("span", { className: "jp-Toolbar-item jp-Toolbar-spacer" }),
            React.createElement(ToolbarButtonComponent, { noFocusOnClick: false, onClick: () => {
                    manager.dismiss();
                }, icon: deleteIcon, tooltip: trans.__('Dismiss all notifications'), enabled: manager.count > 0 }),
            React.createElement(ToolbarButtonComponent, { noFocusOnClick: false, onClick: onClose, icon: closeIcon, tooltip: trans.__('Hide notifications') })),
        React.createElement("ol", { className: "jp-Notification-List" }, notifications.map(notification => {
            var _a;
            const { id, message, type, options } = notification;
            const toastType = type === 'in-progress' ? 'default' : type;
            const closeNotification = () => {
                manager.dismiss(id);
            };
            const icon = type === 'default'
                ? null
                : type === 'in-progress'
                    ? (_a = icons === null || icons === void 0 ? void 0 : icons.spinner) !== null && _a !== void 0 ? _a : null
                    : icons && icons[type];
            return (React.createElement("li", { className: "jp-Notification-List-Item", key: notification.id, onClick: event => {
                    // Stop propagation to avoid closing the popup on click
                    event.stopPropagation();
                } },
                React.createElement("div", { className: `Toastify__toast Toastify__toast-theme--light Toastify__toast--${toastType} jp-Notification-Toast-${toastType}` },
                    React.createElement("div", { className: "Toastify__toast-body" },
                        icon && (React.createElement("div", { className: "Toastify__toast-icon" }, icon({ theme: 'light', type: toastType }))),
                        React.createElement("div", null, Private.createContent(message, closeNotification, options.actions))),
                    React.createElement(Private.CloseButton, { close: closeNotification, closeIcon: deleteIcon.react, title: trans.__('Dismiss notification'), closeIconMargin: true }))));
        }))))));
}
/**
 * Status widget model
 */
class NotificationStatusModel extends VDomModel {
    constructor(manager) {
        super();
        this.manager = manager;
        this._highlight = false;
        this._listOpened = false;
        this._doNotDisturbMode = false;
        this._count = manager.count;
        this.manager.changed.connect(this.onNotificationChanged, this);
    }
    /**
     * Number of notifications.
     */
    get count() {
        return this._count;
    }
    /**
     * Whether to silence all notifications or not.
     */
    get doNotDisturbMode() {
        return this._doNotDisturbMode;
    }
    set doNotDisturbMode(v) {
        this._doNotDisturbMode = v;
    }
    /**
     * Whether to highlight the status widget or not.
     */
    get highlight() {
        return this._highlight;
    }
    /**
     * Whether the popup is opened or not.
     */
    get listOpened() {
        return this._listOpened;
    }
    set listOpened(v) {
        this._listOpened = v;
        if (this._listOpened || this._highlight) {
            this._highlight = false;
        }
        this.stateChanged.emit();
    }
    onNotificationChanged(_, change) {
        // Set private attribute to trigger only once the signal emission
        this._count = this.manager.count;
        const { autoClose } = change.notification.options;
        const noToast = this.doNotDisturbMode ||
            (typeof autoClose === 'number' && autoClose <= 0);
        // Highlight if
        //   the list is not opened (the style change if list is opened due to clickedItem style in statusbar.)
        //   the change type is not removed
        //   the notification will be hidden
        if (!this._listOpened && change.type !== 'removed' && noToast) {
            this._highlight = true;
        }
        this.stateChanged.emit();
    }
}
/**
 * Status view
 */
function NotificationStatus(props) {
    return (React.createElement(GroupItem, { spacing: HALF_SPACING, onClick: () => {
            props.onClick();
        }, title: props.count > 0
            ? props.trans._n('%1 notification', '%1 notifications', props.count)
            : props.trans.__('No notifications') },
        React.createElement(TextItem, { className: "jp-Notification-Status-Text", source: `${props.count}` }),
        React.createElement(bellIcon.react, { top: '2px', stylesheet: 'statusBar' })));
}
/**
 * Add notification center and toast
 */
export const notificationPlugin = {
    id: '@jupyterlab/apputils-extension:notification',
    description: 'Add the notification center and its status indicator.',
    autoStart: true,
    optional: [IStatusBar, ISettingRegistry, ITranslator],
    activate: (app, statusBar, settingRegistry, translator) => {
        Private.translator = translator !== null && translator !== void 0 ? translator : nullTranslator;
        const trans = Private.translator.load('jupyterlab');
        const model = new NotificationStatusModel(Notification.manager);
        model.doNotDisturbMode = false;
        if (settingRegistry) {
            void Promise.all([
                settingRegistry.load(notificationPlugin.id),
                app.restored
            ]).then(([plugin]) => {
                const updateSettings = () => {
                    model.doNotDisturbMode = plugin.get('doNotDisturbMode')
                        .composite;
                };
                updateSettings();
                plugin.changed.connect(updateSettings);
            });
        }
        app.commands.addCommand(CommandIDs.notify, {
            label: trans.__('Emit a notification'),
            caption: trans.__('Notification is described by {message: string, type?: string, options?: {autoClose?: number | false, actions: {label: string, commandId: string, args?: ReadOnlyJSONObject, caption?: string, className?: string}[], data?: ReadOnlyJSONValue}}.'),
            execute: args => {
                var _a;
                const { message, type } = args;
                const options = (_a = args.options) !== null && _a !== void 0 ? _a : {};
                return Notification.manager.notify(message, type !== null && type !== void 0 ? type : 'default', {
                    ...options,
                    actions: options.actions
                        ? options.actions.map((action) => {
                            return {
                                ...action,
                                callback: () => {
                                    app.commands
                                        .execute(action.commandId, action.args)
                                        .catch(r => {
                                        console.error(`Failed to executed '${action.commandId}':\n${r}`);
                                    });
                                }
                            };
                        })
                        : null
                });
            }
        });
        app.commands.addCommand(CommandIDs.update, {
            label: trans.__('Update a notification'),
            caption: trans.__('Notification is described by {id: string, message: string, type?: string, options?: {autoClose?: number | false, actions: {label: string, commandId: string, args?: ReadOnlyJSONObject, caption?: string, className?: string}[], data?: ReadOnlyJSONValue}}.'),
            execute: args => {
                const { id, message, type, ...options } = args;
                return Notification.manager.update({
                    id,
                    message,
                    type: type !== null && type !== void 0 ? type : 'default',
                    ...options,
                    actions: options.actions
                        ? options.actions.map((action) => {
                            return {
                                ...action,
                                callback: () => {
                                    app.commands
                                        .execute(action.commandId, action.args)
                                        .catch(r => {
                                        console.error(`Failed to executed '${action.commandId}':\n${r}`);
                                    });
                                }
                            };
                        })
                        : null
                });
            }
        });
        app.commands.addCommand(CommandIDs.dismiss, {
            label: trans.__('Dismiss a notification'),
            execute: args => {
                const { id } = args;
                Notification.manager.dismiss(id);
            }
        });
        let popup = null;
        model.listOpened = false;
        const notificationList = ReactWidget.create(React.createElement(NotificationCenter, { manager: Notification.manager, onClose: () => {
                popup === null || popup === void 0 ? void 0 : popup.dispose();
            }, trans: trans }));
        notificationList.addClass('jp-Notification-Center');
        async function onNotification(manager, change) {
            var _a;
            if (model.doNotDisturbMode || (popup !== null && !popup.isDisposed)) {
                return;
            }
            const { message, type, options, id } = change.notification;
            if (typeof options.autoClose === 'number' && options.autoClose <= 0) {
                // If the notification is silent, bail early.
                return;
            }
            switch (change.type) {
                case 'added':
                    await Private.createToast(id, message, type, options);
                    break;
                case 'updated':
                    {
                        const toast = await Private.toast();
                        const actions = options.actions;
                        const autoClose = (_a = options.autoClose) !== null && _a !== void 0 ? _a : (actions && actions.length > 0 ? false : null);
                        if (toast.isActive(id)) {
                            // Update existing toast
                            const closeToast = () => {
                                // Dismiss the displayed toast
                                toast.dismiss(id);
                                // Dismiss the notification from the queue
                                manager.dismiss(id);
                            };
                            toast.update(id, {
                                type: type === 'in-progress' ? null : type,
                                isLoading: type === 'in-progress',
                                autoClose: autoClose,
                                render: Private.createContent(message, closeToast, options.actions)
                            });
                        }
                        else {
                            // Needs to recreate a closed toast
                            await Private.createToast(id, message, type, options);
                        }
                    }
                    break;
                case 'removed':
                    await Private.toast().then(t => {
                        t.dismiss(id);
                    });
                    break;
            }
        }
        Notification.manager.changed.connect(onNotification);
        const displayNotifications = () => {
            if (popup) {
                popup.dispose();
                popup = null;
            }
            else {
                popup = showPopup({
                    body: notificationList,
                    anchor: notificationStatus,
                    align: 'right',
                    hasDynamicSize: true,
                    startHidden: true
                });
                // Dismiss all toasts when opening the notification center
                Private.toast()
                    .then(t => {
                    t.dismiss();
                })
                    .catch(r => {
                    console.error(`Failed to dismiss all toasts:\n${r}`);
                })
                    .finally(() => {
                    popup === null || popup === void 0 ? void 0 : popup.launch();
                    // Focus on the pop-up
                    notificationList.node.focus();
                    popup === null || popup === void 0 ? void 0 : popup.disposed.connect(() => {
                        model.listOpened = false;
                        popup = null;
                    });
                });
            }
            model.listOpened = popup !== null;
        };
        app.commands.addCommand(CommandIDs.display, {
            label: trans.__('Show Notifications'),
            execute: displayNotifications
        });
        const notificationStatus = ReactWidget.create(React.createElement(UseSignal, { signal: model.stateChanged }, () => {
            if (model.highlight || (popup && !popup.isDisposed)) {
                notificationStatus.addClass('jp-mod-selected');
            }
            else {
                notificationStatus.removeClass('jp-mod-selected');
            }
            return (React.createElement(NotificationStatus, { count: model.count, highlight: model.highlight, trans: trans, onClick: displayNotifications }));
        }));
        notificationStatus.addClass('jp-Notification-Status');
        if (statusBar) {
            statusBar.registerStatusItem(notificationPlugin.id, {
                item: notificationStatus,
                align: 'right',
                rank: -1
            });
        }
        else {
            notificationStatus.addClass('jp-ThemedContainer');
            // if the status bar is not available, position the notification
            // status in the bottom right corner of the page
            notificationStatus.node.style.position = 'fixed';
            notificationStatus.node.style.bottom = '0';
            // 10px is the default padding for the status bar
            notificationStatus.node.style.right = '10px';
            Widget.attach(notificationStatus, document.body);
            notificationStatus.show();
        }
    }
};
var Private;
(function (Private) {
    /**
     * Translator object for private namespace
     */
    Private.translator = nullTranslator;
    /**
     * Pointer to asynchronously loaded react-toastify
     */
    let toastify = null;
    function CloseButton(props) {
        var _a;
        return (React.createElement("button", { className: `jp-Button jp-mod-minimal ${TOAST_CLOSE_BUTTON_CLASS}${props.closeIconMargin ? ` ${TOAST_CLOSE_BUTTON_MARGIN_CLASS}` : ''}`, title: (_a = props.title) !== null && _a !== void 0 ? _a : '', onClick: props.close },
            React.createElement(props.closeIcon, { className: "jp-icon-hover", tag: "span" })));
    }
    Private.CloseButton = CloseButton;
    function ToastifyCloseButton(props) {
        const trans = Private.translator.load('jupyterlab');
        return (React.createElement(CloseButton, { close: props.closeToast, closeIcon: closeIcon.react, title: trans.__('Hide notification') }));
    }
    let waitForToastify = null;
    /**
     * Asynchronously load the toast container
     *
     * @returns The toast object
     */
    async function toast() {
        if (waitForToastify === null) {
            waitForToastify = new PromiseDelegate();
        }
        else {
            await waitForToastify.promise;
        }
        if (toastify === null) {
            toastify = await import('react-toastify');
            const container = document.body.appendChild(document.createElement('div'));
            container.id = 'react-toastify-container';
            container.classList.add('jp-ThemedContainer');
            const root = createRoot(container);
            root.render(React.createElement(toastify.ToastContainer, { draggable: false, closeOnClick: false, hideProgressBar: true, newestOnTop: true, pauseOnFocusLoss: true, pauseOnHover: true, position: "bottom-right", className: "jp-toastContainer", transition: toastify.Slide, closeButton: ToastifyCloseButton }));
            waitForToastify.resolve();
        }
        return toastify.toast;
    }
    Private.toast = toast;
    /**
     * react-toastify icons loader
     */
    async function getIcons() {
        if (toastify === null) {
            await toast();
        }
        return toastify.Icons;
    }
    Private.getIcons = getIcons;
    const displayType2Class = {
        accent: 'jp-mod-accept',
        link: 'jp-mod-link',
        warn: 'jp-mod-warn',
        default: ''
    };
    /**
     * Create a button with customized callback in a toast
     */
    function ToastButton({ action, closeToast }) {
        var _a, _b;
        const clickHandler = (event) => {
            action.callback(event);
            if (!event.defaultPrevented) {
                closeToast();
            }
        };
        const classes = [
            'jp-toast-button',
            displayType2Class[(_a = action.displayType) !== null && _a !== void 0 ? _a : 'default']
        ].join(' ');
        return (React.createElement(Button, { title: (_b = action.caption) !== null && _b !== void 0 ? _b : action.label, className: classes, onClick: clickHandler, small: true }, action.label));
    }
    /**
     * Helper function to construct the notification content
     *
     * @param message Message to print in the notification
     * @param closeHandler Function closing the notification
     * @param actions Toast actions
     */
    function createContent(message, closeHandler, actions) {
        var _a;
        const shortenMessage = message.length > MAX_MESSAGE_LENGTH
            ? message.slice(0, MAX_MESSAGE_LENGTH) + '…'
            : message;
        return (React.createElement(React.Fragment, null,
            React.createElement("div", { className: "jp-toast-message" }, shortenMessage.split('\n').map((part, index) => (React.createElement(React.Fragment, { key: `part-${index}` },
                index > 0 ? React.createElement("br", null) : null,
                part)))),
            ((_a = actions === null || actions === void 0 ? void 0 : actions.length) !== null && _a !== void 0 ? _a : 0) > 0 && (React.createElement("div", { className: "jp-toast-buttonBar" },
                React.createElement("div", { className: "jp-toast-spacer" }),
                actions.map((action, idx) => {
                    return (React.createElement(ToastButton, { key: 'button-' + idx, action: action, closeToast: closeHandler }));
                })))));
    }
    Private.createContent = createContent;
    /**
     * Create a toast notification
     *
     * @param toastId Toast unique id
     * @param message Toast message
     * @param type Toast type
     * @param options Toast options
     * @returns Toast id
     */
    async function createToast(toastId, message, type, options = {}) {
        const { actions, autoClose, data } = options;
        const t = await toast();
        const toastOptions = {
            autoClose: autoClose !== null && autoClose !== void 0 ? autoClose : (actions && actions.length > 0 ? false : undefined),
            data: data,
            className: `jp-Notification-Toast-${type}`,
            toastId,
            type: type === 'in-progress' ? null : type,
            isLoading: type === 'in-progress'
        };
        return t(({ closeToast }) => createContent(message, () => {
            if (closeToast)
                closeToast();
            Notification.manager.dismiss(toastId);
        }, actions), toastOptions);
    }
    Private.createToast = createToast;
})(Private || (Private = {}));
//# sourceMappingURL=notificationplugin.js.map