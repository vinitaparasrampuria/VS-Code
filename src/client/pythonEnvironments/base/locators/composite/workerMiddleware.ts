import { Event } from 'vscode';
import * as path from 'path';
import { Worker } from 'worker_threads';
import { PythonEnvInfo } from '../../info';
import {
    EnvIteratorId,
    IPythonEnvsIterator,
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
    private idCount = 0;

    private worker: Worker;

    private iterators = new Map<EnvIteratorId, IPythonEnvsIterator>();

    constructor() {
        super();
        this.worker = new Worker(path.join(__dirname, 'worker.js'));
        // TODO: Handle event.
        this.locator.onChanged((e) => {
            this.fire(e);
        });
    }

    public async resolveEnv(p: string): Promise<PythonEnvInfo | undefined> {
        return this.callMethod('resolveEnv', [p]);
    }

    public async iterInitialize(query?: PythonLocatorQuery | undefined): Promise<EnvIteratorId> {
        return this.callMethod('iterInitialize', [query]);
    }

    public async iterNext(id: EnvIteratorId): Promise<PythonEnvInfo | undefined> {
        return this.callMethod('iterNext', [id]);
    }

    public iterOnUpdated(id: EnvIteratorId): Event<PythonEnvUpdatedEvent | ProgressNotificationEvent> | undefined {
        // TODO: Handle event.
        const it = this.getIterator(id);
        return it?.onUpdated;
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
