import { Event, EventEmitter, WorkspaceFoldersChangeEvent, workspace } from 'vscode';
import * as path from 'path';
import { Worker } from 'worker_threads';
import { PythonEnvInfo } from '../../info';
import {
    EnvIteratorId,
    IWorkerMiddleWare,
    ProgressNotificationEvent,
    PythonEnvUpdatedEvent,
    PythonLocatorQuery,
} from '../../locator';
import { PythonEnvsWatcher } from '../../watcher';

/**
 * A service acts as a bridge between Env Resolver and Env Collection.
 */
export class WorkerThreadMiddleWare extends PythonEnvsWatcher implements IWorkerMiddleWare {
    private worker: Worker;

    private onUpdatedMap = new Map<EnvIteratorId, Event<PythonEnvUpdatedEvent | ProgressNotificationEvent>>();

    constructor() {
        super();
        this.worker = new Worker(path.join(__dirname, 'worker.js'), { workerData: workspace.workspaceFolders });
        this.worker.addListener('message', (event) => {
            const { methodName, result } = event;
            if (methodName === 'onChanged') {
                this.fire(result);
            }
        });
    }

    public async resolveEnv(p: string): Promise<PythonEnvInfo | undefined> {
        return this.callMethod('resolveEnv', [p]);
    }

    public async iterInitialize(query?: PythonLocatorQuery | undefined): Promise<EnvIteratorId> {
        const id = await this.callMethod('iterInitialize', [query]);
        const eventEmitter = new EventEmitter<PythonEnvUpdatedEvent | ProgressNotificationEvent>();
        this.onUpdatedMap.set(id, eventEmitter.event);
        this.worker.addListener('message', (event) => {
            const { methodName, result } = event;
            if (methodName === 'iterOnUpdated' && result.id === id) {
                eventEmitter.fire(result.eventData);
            }
        });
        return id;
    }

    public async iterNext(id: EnvIteratorId): Promise<PythonEnvInfo | undefined> {
        return this.callMethod('iterNext', [id]);
    }

    public async onDidChangeWorkspaceFolders(event: WorkspaceFoldersChangeEvent): Promise<void> {
        await this.callMethod('onDidChangeWorkspaceFolders', [event]);
    }

    public async dispose(): Promise<void> {
        await this.callMethod('dispose', []);
    }

    public iterOnUpdated(id: EnvIteratorId): Event<PythonEnvUpdatedEvent | ProgressNotificationEvent> | undefined {
        return this.onUpdatedMap.get(id);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private async callMethod(currMethod: string, args: any[]): Promise<any> {
        return new Promise((resolve, reject) => {
            this.worker.addListener('message', (event) => {
                const { methodName, result, error } = event;
                if (currMethod !== methodName) {
                    return;
                }
                if (result !== undefined) {
                    resolve(result);
                } else if (error) {
                    reject(new Error(error));
                }
            });

            this.worker.postMessage({ methodName: currMethod, args });
        });
    }
}
