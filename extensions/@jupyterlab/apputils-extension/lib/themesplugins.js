/* -----------------------------------------------------------------------------
| Copyright (c) Jupyter Development Team.
| Distributed under the terms of the Modified BSD License.
|----------------------------------------------------------------------------*/
import { JupyterFrontEnd } from '@jupyterlab/application';
import { ICommandPalette, ISplashScreen, IThemeManager, ThemeManager } from '@jupyterlab/apputils';
import { PageConfig, URLExt } from '@jupyterlab/coreutils';
import { IMainMenu } from '@jupyterlab/mainmenu';
import { ISettingRegistry } from '@jupyterlab/settingregistry';
import { ITranslator } from '@jupyterlab/translation';
import scrollbarStyleText from '../style/scrollbar.raw.css';
var CommandIDs;
(function (CommandIDs) {
    CommandIDs.changeTheme = 'apputils:change-theme';
    CommandIDs.changePreferredLightTheme = 'apputils:change-light-theme';
    CommandIDs.changePreferredDarkTheme = 'apputils:change-dark-theme';
    CommandIDs.toggleAdaptiveTheme = 'apputils:adaptive-theme';
    CommandIDs.themeScrollbars = 'apputils:theme-scrollbars';
    CommandIDs.changeFont = 'apputils:change-font';
    CommandIDs.incrFontSize = 'apputils:incr-font-size';
    CommandIDs.decrFontSize = 'apputils:decr-font-size';
})(CommandIDs || (CommandIDs = {}));
function createStyleSheet(text) {
    const style = document.createElement('style');
    style.setAttribute('type', 'text/css');
    style.appendChild(document.createTextNode(text));
    return style;
}
/**
 * The default theme manager provider.
 */
export const themesPlugin = {
    id: '@jupyterlab/apputils-extension:themes',
    description: 'Provides the theme manager.',
    requires: [ISettingRegistry, JupyterFrontEnd.IPaths, ITranslator],
    optional: [ISplashScreen],
    activate: (app, settings, paths, translator, splash) => {
        const trans = translator.load('jupyterlab');
        const host = app.shell;
        const commands = app.commands;
        const url = URLExt.join(PageConfig.getBaseUrl(), paths.urls.themes);
        const key = themesPlugin.id;
        const manager = new ThemeManager({
            key,
            host,
            settings,
            splash: splash !== null && splash !== void 0 ? splash : undefined,
            url
        });
        let scrollbarsStyleElement = null;
        // Keep a synchronously set reference to the current theme,
        // since the asynchronous setting of the theme in `changeTheme`
        // can lead to an incorrect toggle on the currently used theme.
        let currentTheme;
        manager.themeChanged.connect((sender, args) => {
            // Set data attributes on the application shell for the current theme.
            currentTheme = args.newValue;
            document.body.dataset.jpThemeLight = String(manager.isLight(currentTheme));
            document.body.dataset.jpThemeName = currentTheme;
            document.body.style.colorScheme = manager.isLight(currentTheme)
                ? 'light'
                : 'dark';
            if (document.body.dataset.jpThemeScrollbars !==
                String(manager.themeScrollbars(currentTheme))) {
                document.body.dataset.jpThemeScrollbars = String(manager.themeScrollbars(currentTheme));
                if (manager.themeScrollbars(currentTheme)) {
                    if (!scrollbarsStyleElement) {
                        scrollbarsStyleElement = createStyleSheet(scrollbarStyleText);
                    }
                    if (!scrollbarsStyleElement.parentElement) {
                        document.body.appendChild(scrollbarsStyleElement);
                    }
                }
                else {
                    if (scrollbarsStyleElement && scrollbarsStyleElement.parentElement) {
                        scrollbarsStyleElement.parentElement.removeChild(scrollbarsStyleElement);
                    }
                }
            }
            commands.notifyCommandChanged(CommandIDs.changeTheme);
        });
        commands.addCommand(CommandIDs.changeTheme, {
            label: args => {
                if (args.theme === undefined) {
                    return trans.__('Switch to the provided `theme`.');
                }
                const theme = args['theme'];
                const displayName = manager.getDisplayName(theme);
                return args['isPalette']
                    ? trans.__('Use Theme: %1', displayName)
                    : displayName;
            },
            isToggled: args => args['theme'] === currentTheme,
            execute: args => {
                const theme = args['theme'];
                if (theme === manager.theme) {
                    return;
                }
                // Disable adaptive theme if users decide to change the theme when adaptive theme is on
                if (manager.isToggledAdaptiveTheme()) {
                    return manager.toggleAdaptiveTheme();
                }
                return manager.setTheme(theme);
            }
        });
        commands.addCommand(CommandIDs.changePreferredLightTheme, {
            label: args => {
                if (args.theme === undefined) {
                    return trans.__('Switch to the provided light `theme`.');
                }
                const theme = args['theme'];
                const displayName = manager.getDisplayName(theme);
                return args['isPalette']
                    ? trans.__('Set Preferred Light Theme: %1', displayName)
                    : displayName;
            },
            isToggled: args => args['theme'] === manager.preferredLightTheme,
            execute: args => {
                const theme = args['theme'];
                if (theme === manager.preferredLightTheme) {
                    return;
                }
                return manager.setPreferredLightTheme(theme);
            }
        });
        commands.addCommand(CommandIDs.changePreferredDarkTheme, {
            label: args => {
                if (args.theme === undefined) {
                    return trans.__('Switch to the provided dark `theme`.');
                }
                const theme = args['theme'];
                const displayName = manager.getDisplayName(theme);
                return args['isPalette']
                    ? trans.__('Set Preferred Dark Theme: %1', displayName)
                    : displayName;
            },
            isToggled: args => args['theme'] === manager.preferredDarkTheme,
            execute: args => {
                const theme = args['theme'];
                if (theme === manager.preferredDarkTheme) {
                    return;
                }
                return manager.setPreferredDarkTheme(theme);
            }
        });
        commands.addCommand(CommandIDs.toggleAdaptiveTheme, {
            // Avoid lengthy option text in menu
            label: args => args['isPalette']
                ? trans.__('Synchronize Styling Theme with System Settings')
                : trans.__('Synchronize with System Settings'),
            isToggled: () => manager.isToggledAdaptiveTheme(),
            execute: () => {
                manager.toggleAdaptiveTheme().catch(console.warn);
            }
        });
        commands.addCommand(CommandIDs.themeScrollbars, {
            label: trans.__('Theme Scrollbars'),
            isToggled: () => manager.isToggledThemeScrollbars(),
            execute: () => manager.toggleThemeScrollbars()
        });
        commands.addCommand(CommandIDs.changeFont, {
            label: args => args['enabled'] ? `${args['font']}` : trans.__('waiting for fonts'),
            isEnabled: args => args['enabled'],
            isToggled: args => manager.getCSS(args['key']) === args['font'],
            execute: args => manager.setCSSOverride(args['key'], args['font'])
        });
        commands.addCommand(CommandIDs.incrFontSize, {
            label: args => {
                switch (args.key) {
                    case 'code-font-size':
                        return trans.__('Increase Code Font Size');
                    case 'content-font-size1':
                        return trans.__('Increase Content Font Size');
                    case 'ui-font-size1':
                        return trans.__('Increase UI Font Size');
                    default:
                        return trans.__('Increase Font Size');
                }
            },
            execute: args => manager.incrFontSize(args['key'])
        });
        commands.addCommand(CommandIDs.decrFontSize, {
            label: args => {
                switch (args.key) {
                    case 'code-font-size':
                        return trans.__('Decrease Code Font Size');
                    case 'content-font-size1':
                        return trans.__('Decrease Content Font Size');
                    case 'ui-font-size1':
                        return trans.__('Decrease UI Font Size');
                    default:
                        return trans.__('Decrease Font Size');
                }
            },
            execute: args => manager.decrFontSize(args['key'])
        });
        return manager;
    },
    autoStart: true,
    provides: IThemeManager
};
/**
 * The default theme manager's UI command palette and main menu functionality.
 *
 * #### Notes
 * This plugin loads separately from the theme manager plugin in order to
 * prevent blocking of the theme manager while it waits for the command palette
 * and main menu to become available.
 */
export const themesPaletteMenuPlugin = {
    id: '@jupyterlab/apputils-extension:themes-palette-menu',
    description: 'Adds theme commands to the menu and the command palette.',
    requires: [IThemeManager, ITranslator],
    optional: [ICommandPalette, IMainMenu],
    activate: (app, manager, translator, palette, mainMenu) => {
        const trans = translator.load('jupyterlab');
        // If we have a main menu, add the theme manager to the settings menu.
        if (mainMenu) {
            void app.restored.then(() => {
                var _a;
                const isPalette = false;
                const themeMenu = (_a = mainMenu.settingsMenu.items.find(item => {
                    var _a;
                    return item.type === 'submenu' &&
                        ((_a = item.submenu) === null || _a === void 0 ? void 0 : _a.id) === 'jp-mainmenu-settings-apputilstheme';
                })) === null || _a === void 0 ? void 0 : _a.submenu;
                // choose a theme
                if (themeMenu) {
                    manager.themes.forEach((theme, index) => {
                        themeMenu.insertItem(index, {
                            command: CommandIDs.changeTheme,
                            args: { isPalette, theme }
                        });
                    });
                }
            });
        }
        // If we have a command palette, add theme switching options to it.
        if (palette) {
            void app.restored.then(() => {
                const category = trans.__('Theme');
                const command = CommandIDs.changeTheme;
                const isPalette = true;
                // choose a theme
                manager.themes.forEach(theme => {
                    palette.addItem({ command, args: { isPalette, theme }, category });
                });
                // choose preferred light theme
                manager.themes.forEach(theme => {
                    palette.addItem({
                        command: CommandIDs.changePreferredLightTheme,
                        args: { isPalette, theme },
                        category
                    });
                });
                // choose preferred dark theme
                manager.themes.forEach(theme => {
                    palette.addItem({
                        command: CommandIDs.changePreferredDarkTheme,
                        args: { isPalette, theme },
                        category
                    });
                });
                // toggle adaptive theme
                palette.addItem({
                    command: CommandIDs.toggleAdaptiveTheme,
                    args: { isPalette },
                    category
                });
                // toggle scrollbar theming
                palette.addItem({ command: CommandIDs.themeScrollbars, category });
                // increase/decrease code font size
                palette.addItem({
                    command: CommandIDs.incrFontSize,
                    args: {
                        key: 'code-font-size'
                    },
                    category
                });
                palette.addItem({
                    command: CommandIDs.decrFontSize,
                    args: {
                        key: 'code-font-size'
                    },
                    category
                });
                // increase/decrease content font size
                palette.addItem({
                    command: CommandIDs.incrFontSize,
                    args: {
                        key: 'content-font-size1'
                    },
                    category
                });
                palette.addItem({
                    command: CommandIDs.decrFontSize,
                    args: {
                        key: 'content-font-size1'
                    },
                    category
                });
                // increase/decrease ui font size
                palette.addItem({
                    command: CommandIDs.incrFontSize,
                    args: {
                        key: 'ui-font-size1'
                    },
                    category
                });
                palette.addItem({
                    command: CommandIDs.decrFontSize,
                    args: {
                        key: 'ui-font-size1'
                    },
                    category
                });
            });
        }
    },
    autoStart: true
};
//# sourceMappingURL=themesplugins.js.map