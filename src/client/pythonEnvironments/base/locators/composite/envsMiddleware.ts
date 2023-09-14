import { Event } from 'vscode';
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

/**
 * A service acts as a bridge between Env Resolver and Env Collection.
 */
export class EnvsMiddleWare extends PythonEnvsWatcher implements IEnvsMiddleware {
    private idCount = 0;

    private iterators = new Map<EnvIteratorId, IPythonEnvsIterator>();

    constructor(private readonly locator: IResolvingLocator) {
        super();
        this.locator.onChanged((e) => {
            this.fire(e);
        });
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
