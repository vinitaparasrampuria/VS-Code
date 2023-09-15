/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/ban-types */
/* eslint-disable no-restricted-globals */
import { parentPort, workerData } from 'worker_threads';
import { WorkspaceFolder } from 'vscode';
import { URI as Uri } from 'vscode-uri';
import { EnvsMiddleWare } from './envsMiddleware';
import { traceError } from '../../../../logging';

const { folders, settings } = workerData;
const workspaceFolders = (folders as WorkspaceFolder[]).map((w) => {
    const wuri = w.uri;
    const workspaceFolder = {
        name: w.name,
        uri: Uri.parse((w.uri as unknown) as string),
        index: w.index,
    };
    if (typeof wuri === 'string') {
        workspaceFolder.uri = Uri.parse(wuri);
    } else if ('scheme' in wuri && 'path' in wuri) {
        workspaceFolder.uri = Uri.parse(`${wuri.scheme}://${wuri.path}`);
    } else {
        traceError('Unexpected search location', JSON.stringify(wuri));
    }
    return workspaceFolder;
});

const envsMiddleware = new EnvsMiddleWare(workspaceFolders, settings);

if (!parentPort) {
    throw new Error('Not in a worker thread');
}

console.log('Worker thread started');

// // Listen for messages from the main thread
parentPort.on('message', async (event) => {
    // console.log(JSON.stringify(settings));
    console.log('Worker thread received message', event);
    if (!parentPort) {
        throw new Error('Not in a worker thread');
    }
    type EventType = { methodName: string; args: any[] };
    const { methodName, args } = event as EventType;
    if (methodName && typeof envsMiddleware[methodName as keyof EnvsMiddleWare] === 'function') {
        const method = envsMiddleware[methodName as keyof EnvsMiddleWare] as Function;
        try {
            const result = await method.apply(envsMiddleware, args);
            parentPort.postMessage({ methodName, result });
        } catch (error) {
            parentPort.postMessage({ methodName, error: (error as Error).message });
        }
    } else {
        parentPort.postMessage({ methodName, error: 'Invalid method name' });
    }
});
