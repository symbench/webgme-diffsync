import {CommonShadow, Transformable} from './types';

interface Diffs {
    timestamp: number;
    patches: any[];
}

enum Events {
    clientUpdate='clientUpdate',
    serverUpdate='serverUpdate',
}

class PatchesQueue {
    internal: Diffs[];
    constructor() {
        this.internal = [];
    }

    enqueue(task: Diffs) {
        this.internal.push(task);
    }

    dequeue() {
        const task = this.internal.splice(0, 1);
        return task.pop();
    }

    getLatest() {
        return this.internal.reduce((prev, next) => {
            if(prev.timestamp > next.timestamp) {
                return prev;
            } else {
                return next;
            }
        }, this.internal[0]);
    }

    clearPrevious(timeStamp: number) {
        this.internal = this.internal.filter(patch => patch.timestamp > timeStamp);
    }
}

export class WebGMEDiffSyncer {
    commonShadow: CommonShadow;
    clientQueue: PatchesQueue;
    serverQueue: PatchesQueue;
    diff: any;

    constructor(commonShadow: CommonShadow, diff: any) {
        this.commonShadow = commonShadow;
        this.diff = diff;
        this.clientQueue = new PatchesQueue();
        this.serverQueue = new PatchesQueue();
    }

    onUpdatesFromClient(clientState: Transformable<CommonShadow>) {
        const newState = clientState.toShadow();
        const patches = this._computePatches(newState) as Diffs;
        this.commonShadow = newState;
        if(!patches.patches.length) {
            this.serverQueue.clearPrevious(Date.now());
        } else {
            this.serverQueue.enqueue(patches);
        }
    }

    async onUpdatesFromServer(serverState: Transformable<CommonShadow>) {
        const newState = await serverState.toShadow();
        const patches = this._computePatches(newState) as Diffs;
        this.commonShadow = newState;
        if(!patches.patches.length) {
            this.clientQueue.clearPrevious(Date.now());
        } else {
            this.serverQueue.enqueue(patches);
        }
    }

    _computePatches(newState: CommonShadow): Diffs {
        const diffs = this.diff(this.commonShadow, newState)
        return {
            timestamp: Date.now(),
            patches: diffs
        };
    }
}