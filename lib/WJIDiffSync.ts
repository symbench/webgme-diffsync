import {DiffFunction, Delta, Differ, GMEDiffSync, NodeChangeSet, StateTransformer, WJIImporterType, WJIJson} from "./DiffSyncLib";

class WJIDelta implements Delta {
    patches: any;
    timeStamp: number;

    constructor(timeStamp: number, patches: any) {
        this.timeStamp = timeStamp;
        this.patches = patches;
    }

    static fromNodeChangeSet(changeSet: NodeChangeSet) {
        return new WJIDelta(Date.now(), changeSet);
    }
}


class NodeToWJITransformer implements StateTransformer<Core.Node, WJIJson> {
    importer: WJIImporterType;

    constructor(importer: WJIImporterType) {
        this.importer = importer;
    }

    async apply(node: Core.Node, patch: WJIDelta): Promise<void> {
        const wjiDiffs = patch.patches;
        await this.importer.patch(node, wjiDiffs);
    }

    async convert(node: Core.Node): Promise<WJIJson> {
        return await this.importer.toJSON(node);
    }
}

class WJIToWJITransformer implements StateTransformer<WJIJson, WJIJson> {
    apply(state: WJIJson, patch: WJIDelta): void | Promise<void> {
        // ToDo: Implement this logic
    }

    convert(input: WJIJson): WJIJson {
        return input;
    }
}

class WJIDiff implements Differ<WJIJson> {
    diffFunc: DiffFunction;

    constructor(diff:  DiffFunction) {
        this.diffFunc = diff;
    }

    diff(state: WJIJson, newState: WJIJson): WJIDelta {
        return this.diffFunc(state, newState);
    }

}

class WJIDiffSync implements GMEDiffSync<Core.Node, WJIJson, WJIJson> {
    shadow: WJIJson;
    serverTransform: NodeToWJITransformer;
    clientTransform: WJIToWJITransformer;
    differ: WJIDiff;
    serverState: Core.Node;
    clientState: WJIJson;


    constructor(
        serverState: Core.Node,
        shadow: WJIJson,
        clientState: WJIJson,
        importer: WJIImporterType,
        diff: DiffFunction,
        clientTransform: NodeToWJITransformer,
        serverTransform: WJIToWJITransformer
    ) {
        this.serverState = serverState;
        this.shadow = shadow;
        this.clientState = clientState;
        this.serverTransform = clientTransform;
        this.clientTransform = serverTransform;
        this.differ = new WJIDiff(diff);
    }

    async onUpdatesFromClient(clientState: WJIJson): Promise<void> {
        const diff = this.differ.diff(this.shadow, clientState);
        this.shadow = clientState;
        await this.serverTransform.apply(this.serverState, diff);
    }

    async onUpdatesFromServer(node: Core.Node): Promise<void> {
        const serverState = await this.serverTransform.convert(node);
        const diff = this.differ.diff(this.shadow, serverState);
        this.shadow = serverState;
        this.clientTransform.apply(this.clientState, diff);
    }
}