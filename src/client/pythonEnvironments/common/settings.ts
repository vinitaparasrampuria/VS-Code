import { workspace } from 'vscode';

export const VENVPATH_SETTING_KEY = 'venvPath';
export const VENVFOLDERS_SETTING_KEY = 'venvFolders';
export const CONDAPATH_SETTING_KEY = 'condaPath';
export const POETRYSETTING_KEY = 'poetryPath';
export const ACTIVESTATETOOLPATH_SETTING_KEY = 'activeStateToolPath';

export type PythonDiscoverySettings = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;
};

/**
 * Returns the value for setting `python.<name>`.
 * @param name The name of the setting.
 */
export function getPythonDiscoverySettings(): PythonDiscoverySettings {
    const settingNames = [
        VENVPATH_SETTING_KEY,
        VENVFOLDERS_SETTING_KEY,
        CONDAPATH_SETTING_KEY,
        POETRYSETTING_KEY,
        ACTIVESTATETOOLPATH_SETTING_KEY,
    ];
    const settings: PythonDiscoverySettings = {};
    for (const name of settingNames) {
        settings[name] = workspace.getConfiguration('python').get<string>(name);
    }
    return settings;
}
