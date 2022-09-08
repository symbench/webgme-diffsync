import './types/webgme';

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
    _node: Core.Node;
    importer: any;
    constructor(node: Core.Node, importer: any) {
        this._node = node;
        this.importer = importer;
    }

    async toShadow(): Promise<WJIJson> {
        return await this.importer.toJSON(this._node) as WJIJson;
    }
}