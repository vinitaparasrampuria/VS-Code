// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as vscode from 'vscode';
import { Uri } from 'vscode';
import { cloneDeep } from 'lodash';
import { getGlobalStorage, IPersistentStorage } from '../common/persistentState';
import { ActivationResult, ExtensionState } from '../components';
import { PythonEnvInfo } from './base/info';
import { IDiscoveryAPI } from './base/locator';
import {
    initializeExternalDependencies as initializeLegacyExternalDependencies,
    normCasePath,
} from './common/externalDependencies';
import { registerNewDiscoveryForIOC } from './legacyIOC';
import { createPythonEnvironments } from './api';
import {
    createCollectionCache as createCache,
    IEnvsCollectionCache,
} from './base/locators/composite/envsCollectionCache';
import { EnvsCollectionService } from './base/locators/composite/envsCollectionService';
import { traceError } from '../logging';
import { EnvsMiddleWare } from './base/locators/composite/envsMiddleware';
import { createSubLocators } from './locator';

/**
 * Set up the Python environments component (during extension activation).'
 */
export async function initialize(ext: ExtensionState): Promise<IDiscoveryAPI> {
    // Set up the legacy IOC container before api is created.
    initializeLegacyExternalDependencies(ext.legacyIOC.serviceContainer);

    const api = await createPythonEnvironments(() => createLocator(ext));
    registerNewDiscoveryForIOC(
        // These are what get wrapped in the legacy adapter.
        ext.legacyIOC.serviceManager,
        api,
    );
    return api;
}

/**
 * Make use of the component (e.g. register with VS Code).
 */
export async function activate(api: IDiscoveryAPI, ext: ExtensionState): Promise<ActivationResult> {
    /**
     * Force an initial background refresh of the environments.
     *
     * Note API is ready to be queried only after a refresh has been triggered, and extension activation is
     * blocked on API being ready. So if discovery was never triggered for a scope, we need to block
     * extension activation on the "refresh trigger".
     */
    const folders = vscode.workspace.workspaceFolders;
    // Trigger discovery if environment cache is empty.
    const wasTriggered = getGlobalStorage<PythonEnvInfo[]>(ext.context, 'PYTHON_ENV_INFO_CACHE', []).get().length > 0;
    if (!wasTriggered) {
        api.triggerRefresh().ignoreErrors();
        folders?.forEach(async (folder) => {
            const wasTriggeredForFolder = getGlobalStorage<boolean>(
                ext.context,
                `PYTHON_WAS_DISCOVERY_TRIGGERED_${normCasePath(folder.uri.fsPath)}`,
                false,
            );
            await wasTriggeredForFolder.set(true);
        });
    } else {
        // Figure out which workspace folders need to be activated if any.
        folders?.forEach(async (folder) => {
            const wasTriggeredForFolder = getGlobalStorage<boolean>(
                ext.context,
                `PYTHON_WAS_DISCOVERY_TRIGGERED_${normCasePath(folder.uri.fsPath)}`,
                false,
            );
            if (!wasTriggeredForFolder.get()) {
                api.triggerRefresh({
                    searchLocations: { roots: [folder.uri], doNotIncludeNonRooted: true },
                }).ignoreErrors();
                await wasTriggeredForFolder.set(true);
            }
        });
    }

    return {
        fullyReady: Promise.resolve(),
    };
}

/**
 * Get the locator to use in the component.
 */
async function createLocator(
    ext: ExtensionState,
    // This is shared.
): Promise<IDiscoveryAPI> {
    const middleware = new EnvsMiddleWare();
    ext.disposables.push(middleware);
    const caching = new EnvsCollectionService(await createCollectionCache(ext), middleware);
    return caching;
}

function getFromStorage(storage: IPersistentStorage<PythonEnvInfo[]>): PythonEnvInfo[] {
    return storage.get().map((e) => {
        if (e.searchLocation) {
            if (typeof e.searchLocation === 'string') {
                e.searchLocation = Uri.parse(e.searchLocation);
            } else if ('scheme' in e.searchLocation && 'path' in e.searchLocation) {
                e.searchLocation = Uri.parse(`${e.searchLocation.scheme}://${e.searchLocation.path}`);
            } else {
                traceError('Unexpected search location', JSON.stringify(e.searchLocation));
            }
        }
        return e;
    });
}

function putIntoStorage(storage: IPersistentStorage<PythonEnvInfo[]>, envs: PythonEnvInfo[]): Promise<void> {
    storage.set(
        // We have to `cloneDeep()` here so that we don't overwrite the original `PythonEnvInfo` objects.
        cloneDeep(envs).map((e) => {
            if (e.searchLocation) {
                // Make TS believe it is string. This is temporary. We need to serialize this in
                // a custom way.
                e.searchLocation = (e.searchLocation.toString() as unknown) as Uri;
            }
            return e;
        }),
    );
    return Promise.resolve();
}

async function createCollectionCache(ext: ExtensionState): Promise<IEnvsCollectionCache> {
    const storage = getGlobalStorage<PythonEnvInfo[]>(ext.context, 'PYTHON_ENV_INFO_CACHE', []);
    const cache = await createCache({
        get: () => getFromStorage(storage),
        store: async (e) => putIntoStorage(storage, e),
    });
    return cache;
}
