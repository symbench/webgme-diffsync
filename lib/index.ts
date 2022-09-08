import {GMENode, CommonShadow, Transformable} from './Types';

interface Patches {
    timestamp: number;
    patches: any[];
}

enum Events {
    clientUpdate='clientUpdate',
    serverUpdate='serverUpdate',
}

class PatchesQueue {
    internal: Patches[];
    constructor() {
        this.internal = [];
    }

    enqueue(task: Patches) {
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
        }, this.internal[0])
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

    constructor(gmeNode: GMENode, diff: any) {
        this.commonShadow = gmeNode.toShadow();
        this.diff = diff;
        this.clientQueue = new PatchesQueue();
        this.serverQueue = new PatchesQueue();
    }

    onUpdatesFromClient(clientState: Transformable<CommonShadow>) {
        const newState = clientState.toShadow();
        const patches = this.diff(this.commonShadow, newState) as Patches;
        this.commonShadow = newState;
        if(!patches.patches.length) {
            this.serverQueue.clearPrevious(Date.now());
        } else {
            this.serverQueue.enqueue(patches);
        }
    }

    onUpdatesFromServer(serverState: Transformable<CommonShadow>) {
         const newState = serverState.toShadow();
         const patches = this.diff(this.commonShadow, newState) as Patches;
         this.commonShadow = newState;
         if(!patches.patches.length) {
            this.clientQueue.clearPrevious(Date.now());
        } else {
            this.serverQueue.enqueue(patches);
        }
    }

}