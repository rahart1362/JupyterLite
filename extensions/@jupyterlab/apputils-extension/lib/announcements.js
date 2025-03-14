/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */
import { Notification } from '@jupyterlab/apputils';
import { URLExt } from '@jupyterlab/coreutils';
import { ConfigSection, ServerConnection } from '@jupyterlab/services';
import { ISettingRegistry } from '@jupyterlab/settingregistry';
import { ITranslator, nullTranslator } from '@jupyterlab/translation';
const COMMAND_HELP_OPEN = 'help:open';
const NEWS_API_URL = '/lab/api/news';
const UPDATE_API_URL = '/lab/api/update';
const PRIVACY_URL = 'https://jupyterlab.readthedocs.io/en/stable/privacy_policies.html';
/**
 * Call the announcement API
 *
 * @param endpoint Endpoint to request
 * @param init Initial values for the request
 * @returns The response body interpreted as JSON
 */
async function requestAPI(endpoint, init = {}) {
    // Make request to Jupyter API
    const settings = ServerConnection.makeSettings();
    const requestUrl = URLExt.join(settings.baseUrl, endpoint);
    let response;
    try {
        response = await ServerConnection.makeRequest(requestUrl, init, settings);
    }
    catch (error) {
        throw new ServerConnection.NetworkError(error);
    }
    const data = await response.json();
    if (!response.ok) {
        throw new ServerConnection.ResponseError(response, data.message);
    }
    return data;
}
export const announcements = {
    id: '@jupyterlab/apputils-extension:announcements',
    description: 'Add the announcement feature. It will fetch news on the internet and check for application updates.',
    autoStart: true,
    optional: [ISettingRegistry, ITranslator],
    activate: (app, settingRegistry, translator) => {
        var _a;
        const CONFIG_SECTION_NAME = announcements.id.replace(/[^\w]/g, '');
        void Promise.all([
            app.restored,
            (_a = settingRegistry === null || settingRegistry === void 0 ? void 0 : settingRegistry.load('@jupyterlab/apputils-extension:notification')) !== null && _a !== void 0 ? _a : Promise.resolve(null),
            // Use config instead of state to store independently of the workspace
            // if a news has been displayed or not.
            ConfigSection.create({
                name: CONFIG_SECTION_NAME
            })
        ]).then(async ([_, settings, config]) => {
            const trans = (translator !== null && translator !== void 0 ? translator : nullTranslator).load('jupyterlab');
            // Store dismiss state
            Notification.manager.changed.connect((manager, change) => {
                var _a;
                if (change.type !== 'removed') {
                    return;
                }
                const { id, tags } = ((_a = change
                    .notification.options.data) !== null && _a !== void 0 ? _a : {});
                if ((tags !== null && tags !== void 0 ? tags : []).some(tag => ['news', 'update'].includes(tag)) && id) {
                    const update = {};
                    update[id] = { seen: true, dismissed: true };
                    config.update(update).catch(reason => {
                        console.error(`Failed to update the announcements config:\n${reason}`);
                    });
                }
            });
            const mustFetchNews = settings === null || settings === void 0 ? void 0 : settings.get('fetchNews').composite;
            if (mustFetchNews === 'none') {
                const notificationId = Notification.emit(trans.__('Would you like to get notified about official Jupyter news?'), 'default', {
                    autoClose: false,
                    actions: [
                        {
                            label: trans.__('Open privacy policy'),
                            caption: PRIVACY_URL,
                            callback: event => {
                                event.preventDefault();
                                if (app.commands.hasCommand(COMMAND_HELP_OPEN)) {
                                    void app.commands.execute(COMMAND_HELP_OPEN, {
                                        text: trans.__('Privacy policies'),
                                        url: PRIVACY_URL
                                    });
                                }
                                else {
                                    window.open(PRIVACY_URL, '_blank', 'noreferrer');
                                }
                            },
                            displayType: 'link'
                        },
                        {
                            label: trans.__('Yes'),
                            callback: () => {
                                Notification.dismiss(notificationId);
                                config
                                    .update({})
                                    .then(() => fetchNews())
                                    .catch(reason => {
                                    console.error(`Failed to get the news:\n${reason}`);
                                });
                                settings === null || settings === void 0 ? void 0 : settings.set('fetchNews', 'true').catch((reason) => {
                                    console.error(`Failed to save setting 'fetchNews':\n${reason}`);
                                });
                            }
                        },
                        {
                            label: trans.__('No'),
                            callback: () => {
                                Notification.dismiss(notificationId);
                                settings === null || settings === void 0 ? void 0 : settings.set('fetchNews', 'false').catch((reason) => {
                                    console.error(`Failed to save setting 'fetchNews':\n${reason}`);
                                });
                            }
                        }
                    ]
                });
            }
            else {
                await fetchNews();
            }
            async function fetchNews() {
                var _a, _b, _c, _d;
                if (((_a = settings === null || settings === void 0 ? void 0 : settings.get('fetchNews').composite) !== null && _a !== void 0 ? _a : 'false') === 'true') {
                    try {
                        const response = await requestAPI(NEWS_API_URL);
                        for (const { link, message, type, options } of response.news) {
                            // @ts-expect-error data has no index
                            const id = options.data['id'];
                            // Filter those notifications
                            const state = (_b = config.data[id]) !== null && _b !== void 0 ? _b : {
                                seen: false,
                                dismissed: false
                            };
                            if (!state.dismissed) {
                                options.actions = [
                                    {
                                        label: trans.__('Hide'),
                                        caption: trans.__('Never show this notification again.'),
                                        callback: () => {
                                            const update = {};
                                            update[id] = { seen: true, dismissed: true };
                                            config.update(update).catch(reason => {
                                                console.error(`Failed to update the announcements config:\n${reason}`);
                                            });
                                        }
                                    }
                                ];
                                if ((link === null || link === void 0 ? void 0 : link.length) === 2) {
                                    options.actions.push({
                                        label: link[0],
                                        caption: link[1],
                                        callback: () => {
                                            window.open(link[1], '_blank', 'noreferrer');
                                        },
                                        displayType: 'link'
                                    });
                                }
                                if (!state.seen) {
                                    options.autoClose = 5000;
                                    const update = {};
                                    update[id] = { seen: true };
                                    config.update(update).catch(reason => {
                                        console.error(`Failed to update the announcements config:\n${reason}`);
                                    });
                                }
                                Notification.emit(message, type, options);
                            }
                        }
                    }
                    catch (reason) {
                        console.log('Failed to get the announcements.', reason);
                    }
                }
                if ((_c = settings === null || settings === void 0 ? void 0 : settings.get('checkForUpdates').composite) !== null && _c !== void 0 ? _c : true) {
                    const response = await requestAPI(UPDATE_API_URL);
                    if (response.notification) {
                        const { link, message, type, options } = response.notification;
                        // @ts-expect-error data has no index
                        const id = options.data['id'];
                        const state = (_d = config.data[id]) !== null && _d !== void 0 ? _d : {
                            seen: false,
                            dismissed: false
                        };
                        if (!state.dismissed) {
                            let notificationId;
                            options.actions = [
                                {
                                    label: trans.__('Ignore all updates'),
                                    caption: trans.__('Do not prompt me if a new JupyterLab version is available.'),
                                    callback: () => {
                                        settings === null || settings === void 0 ? void 0 : settings.set('checkForUpdates', false).then(() => {
                                            Notification.dismiss(notificationId);
                                        }).catch((reason) => {
                                            console.error('Failed to set the `checkForUpdates` setting.', reason);
                                        });
                                    }
                                }
                            ];
                            if ((link === null || link === void 0 ? void 0 : link.length) === 2) {
                                options.actions.push({
                                    label: link[0],
                                    caption: link[1],
                                    callback: () => {
                                        window.open(link[1], '_blank', 'noreferrer');
                                    },
                                    // Because the link to the changelog is the primary option,
                                    // display it in an accent color.
                                    displayType: 'accent'
                                });
                            }
                            if (!state.seen) {
                                options.autoClose = 5000;
                                const update = {};
                                update[id] = { seen: true };
                                config.update(update).catch(reason => {
                                    console.error(`Failed to update the announcements config:\n${reason}`);
                                });
                            }
                            notificationId = Notification.emit(message, type, options);
                        }
                    }
                }
            }
        });
    }
};
//# sourceMappingURL=announcements.js.map