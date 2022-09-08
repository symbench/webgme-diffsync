/// <reference path="./types/webgme.d.ts" />

export interface Transformable<T extends CommonShadow> {
    toShadow: () => Promise<T>
}

export interface CommonShadow {}


export interface WJIJson extends CommonShadow{
    id: string;
    path?: string;
    guid: string;
    attributes?: { [key: string]: any };
    attribute_meta?: { [key: string]: any };
    pointers?: { [key: string]: any };
    pointer_meta?: { [key: string]: any };
    mixins?: { [key: string]: any }[];
    registry?: { [key: string]: any };
    sets?: { [key: string]: any };
    member_attributes?: { [key: string]: any };
    member_registry?: { [key: string]: any };
    children_meta?: { [key: string]: any };
    children?: WJIJson[];
}

export class GMENode implements Transformable<WJIJson> {
    nodeId: string;
    core: GmeClasses.Core;
    rootNode: Core.Node;
    importer: any;
    constructor(nodeId: string, rootNode: Core.Node, core: GmeClasses.Core, Importer: any) {
        this.nodeId = nodeId;
        this.rootNode = rootNode;
        this.core = core;
        this.importer = new Importer(core, rootNode);
    }

    async toShadow(): Promise<WJIJson> {
        const node = await this.core.loadByPath(this.rootNode, this.nodeId);
        return await this.importer.toJSON(node);
    }
}