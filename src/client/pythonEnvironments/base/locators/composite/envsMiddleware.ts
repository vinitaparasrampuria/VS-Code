// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { Event, WorkspaceFolder, WorkspaceFoldersChangeEvent } from 'vscode';
import { PythonEnvInfo } from '../../info';
import {
    EnvIteratorId,
    IEnvsMiddleware,
    IPythonEnvsIterator,
    IResolvingLocator,
    ProgressNotificationEvent,
    PythonEnvUpdatedEvent,
    PythonLocatorQuery,
} from '../../locator';
import { PythonEnvsWatcher } from '../../watcher';
import { IDisposableRegistry } from '../../../../common/types';
import { WorkspaceLocators } from '../wrappers';
import { createSubLocators } from '../../../locator';

/**
 * A service acts as a bridge between Env Resolver and Env Collection.
 */
export class EnvsMiddleWare extends PythonEnvsWatcher implements IEnvsMiddleware {
    private idCount = 0;

    private readonly locator: IResolvingLocator;

    private readonly workspaceLocator: WorkspaceLocators;

    private disposables: IDisposableRegistry;

    private iterators = new Map<EnvIteratorId, IPythonEnvsIterator>();

    constructor(folders: readonly WorkspaceFolder[] | undefined) {
        super();
        const { locator, disposables, workspaceLocator } = createSubLocators(folders);
        this.disposables = disposables;
        this.locator = locator;
        this.workspaceLocator = workspaceLocator;
        this.locator.onChanged((e) => {
            this.fire(e);
        });
    }

    public dispose(): void {
        this.disposables.forEach((d) => d.dispose());
    }

    public onDidChangeWorkspaceFolders(event: WorkspaceFoldersChangeEvent): void {
        this.workspaceLocator.onDidChangeWorkspaceFolders(event);
    }

    public async resolveEnv(path: string): Promise<PythonEnvInfo | undefined> {
        return this.locator.resolveEnv(path);
    }

    public async iterInitialize(query?: PythonLocatorQuery | undefined): Promise<EnvIteratorId> {
        const it = this.locator.iterEnvs(query);
        const id = this.idCount;
        this.iterators.set(id, it);
        return id;
    }

    public async iterNext(id: EnvIteratorId): Promise<PythonEnvInfo | undefined> {
        const it = this.getIterator(id);
        const result = await it?.next();
        if (result?.done) {
            return undefined;
        }
        return result?.value;
    }

    public iterOnUpdated(id: EnvIteratorId): Event<PythonEnvUpdatedEvent | ProgressNotificationEvent> | undefined {
        const it = this.getIterator(id);
        return it?.onUpdated;
    }

    private getIterator(id: EnvIteratorId) {
        return this.iterators.get(id);
    }
}
