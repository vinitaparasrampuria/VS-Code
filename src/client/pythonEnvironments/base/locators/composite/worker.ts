/* eslint-disable @typescript-eslint/ban-types */
/* eslint-disable no-restricted-globals */
import { parentPort, workerData } from 'worker_threads';
import { EnvsMiddleWare } from './envsMiddleware';

const folders = workerData;
const envsMiddleware = new EnvsMiddleWare(folders);

if (!parentPort) {
    throw new Error('Not in a worker thread');
}

console.log('Worker thread started');

// // Listen for messages from the main thread
parentPort.on('message', async (event) => {
    console.log('Worker thread received message', event);
    if (!parentPort) {
        throw new Error('Not in a worker thread');
    }
    const { methodName, args } = event;
    if (methodName && typeof envsMiddleware[methodName as keyof EnvsMiddleWare] === 'function') {
        const method = envsMiddleware[methodName as keyof EnvsMiddleWare] as Function;
        try {
            const result = await method.apply(envsMiddleware, ...args);
            parentPort.postMessage({ methodName, result });
        } catch (error) {
            parentPort.postMessage({ methodName, error: (error as Error).message });
        }
    } else {
        parentPort.postMessage({ methodName, error: 'Invalid method name' });
    }
});
