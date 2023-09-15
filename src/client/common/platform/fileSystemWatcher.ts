/* eslint-disable global-require */
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import type * as vscodeTypes from 'vscode';
import { traceError, traceVerbose } from '../../logging';
import { IDisposable } from '../types';
import { Disposables } from '../utils/resourceLifecycle';

/**
 * Enumeration of file change types.
 */
export enum FileChangeType {
    Changed = 'changed',
    Created = 'created',
    Deleted = 'deleted',
}

export function watchLocationForPattern(
    baseDir: string,
    pattern: string,
    callback: (type: FileChangeType, absPath: string) => void,
): IDisposable {
    try {
        const vscode = require('vscode') as typeof vscodeTypes;
        const globPattern = new vscode.RelativePattern(baseDir, pattern);
        const disposables = new Disposables();
        traceVerbose(`Start watching: ${baseDir} with pattern ${pattern} using VSCode API`);
        const watcher = vscode.workspace.createFileSystemWatcher(globPattern);
        disposables.push(watcher.onDidCreate((e) => callback(FileChangeType.Created, e.fsPath)));
        disposables.push(watcher.onDidChange((e) => callback(FileChangeType.Changed, e.fsPath)));
        disposables.push(watcher.onDidDelete((e) => callback(FileChangeType.Deleted, e.fsPath)));
        return disposables;
    } catch (ex) {
        traceError('Watcher', (ex as Error).message);
        console.log('Watcher', (ex as Error).message);
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        return { dispose: () => {} };
    }
}
