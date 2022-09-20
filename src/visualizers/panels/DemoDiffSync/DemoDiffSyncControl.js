/*globals define, WebGMEGlobal*/
/**
 * Generated by VisualizerGenerator 1.7.0 from webgme on Mon Sep 19 2022 18:43:02 GMT-0500 (Central Daylight Time).
 */


define([
    'js/Constants',
    'webgme-json-importer/JSONImporter',
    'webgme-json-importer/changeset',
    'webgme-diffsync/WJIDiffSync',
    'js/Utils/GMEConcepts',
    'js/NodePropertyNames',
    './Utils',
    'underscore'
], function (
    CONSTANTS,
    JSONImporter,
    diff,
    DiffSyncUtils,
    GMEConcepts,
    nodePropertyNames,
    Utils,
    _
) {

    'use strict';
    const WJIDiffSync = DiffSyncUtils.default;
    const {NodeDiffFactory} = Utils;
    class DemoDiffSyncControl {
        constructor(options) {
            this._logger = options.logger.fork('Control');

            this._client = options.client;
            this.synchronizer = null;
            this.numCalls = 0;
            // Initialize core collections and variables
            this._initializeWidgets(options.widgets);

            this.pending = false;
            this._currentNodeId = null;
            this._currentNodeParentId = undefined;

            this._initWidgetEventHandlers();

            this._logger.debug('ctor finished');
        }

        _initializeWidgets(widgets) {
            const [serverStateWidget, commonShadowWidget, clientStateWidget] = widgets;

            this.serverStateWidget = serverStateWidget;
            this.commonShadowWidget = commonShadowWidget;
            this.clientStateWidget = clientStateWidget;
            this.serverStateWidget.$el.css('width', '30%');
            this.commonShadowWidget.$el.css('width', '30%');
            this.clientStateWidget.$el.css('width', '35%'); // More width because editable


            serverStateWidget.setTitle('Server State');
            commonShadowWidget.setTitle('Common Shadow');
            clientStateWidget.setTitle('Client State');
        }

        _initWidgetEventHandlers = function () {
            const onChange = async (updated, previous, /*error, patch*/) => {
                if(!_.isEmpty(previous.json)) {
                    if(this.pending) return;
                    this.pending = true;
                    await this.synchronizer.onUpdatesFromClient(updated.json);
                    const {core, rootNode, project} = await this.getCoreInstance();
                    const {rootHash, objects} = core.persist(rootNode);
                    const activeNode = await core.loadByPath(rootNode, this._currentNodeId);
                    const nodeName = core.getAttribute(activeNode, 'name');
                    const branchName = this._client.getActiveBranchName();
                    const parentCommit = this._client.getActiveCommitHash();
                    await project.makeCommit(
                        branchName,
                        [parentCommit],
                        rootHash,
                        objects,
                        `Updated ${nodeName}`,
                    );
                }
                await this.setWidgetsState();
                this.pending = false;
            };

            this.clientStateWidget.setOnChange(_.debounce(onChange.bind(this), 1000));
        };

        async getCoreInstance() {
            return await new Promise((resolve, reject) => this._client.getCoreInstance(null, (err, result) => err ? reject(err) : resolve(result)));
        }

        async setStateFromNode(nodeId) {
            if(this.pending) return;
            this.pending = true;
            const {core, rootNode} = await this.getCoreInstance();
            const importer = new JSONImporter(core, rootNode);
            const node = await core.loadByPath(rootNode, nodeId);
            const nodeJSON = await importer.toJSON(node);
            const parent = core.getParent(node);
            const diffFunction = NodeDiffFactory(diff, core.getPath(parent), JSONImporter.NodeChangeSet);

            if(!this.synchronizer) {
                this.synchronizer = new WJIDiffSync(
                    node,
                    nodeJSON,
                    nodeJSON,
                    importer,
                    diffFunction
                );
            } else {
                await this.synchronizer.onUpdatesFromServer(node);
            }
            await this.setWidgetsState();
            this.pending = false;
        }

        async setWidgetsState() {
            if(!this.synchronizer) return;
            const importer = this.synchronizer.importer;
            this.serverStateWidget.setState(
                {json: await importer.toJSON(this.synchronizer.serverState)},
                true
            );

            this.clientStateWidget.setState(
                {json: this.synchronizer.clientState},
                false
            );

            this.commonShadowWidget.setState(
                {json: this.synchronizer.shadow},
                true
            );
        }

        selectedObjectChanged(nodeId) {
            this._logger.debug('activeObject nodeId \'' + nodeId + '\'');

            // Remove current territory patterns
            if (this._territoryId) {
                this._client.removeUI(this._territoryId);
                this._territoryId = null;
            }

            this._currentNodeId = nodeId;
            if (typeof this._currentNodeId === 'string') {

                // Put new node's info into territory rules
                this._selfPatterns = {};
                // TODO: Will this work? I can't remember tbh...
                this._selfPatterns[nodeId] = {children: Infinity};  // Territory "rule"

                this._territoryId = this._client.addUI(this, async () => {
                    this.setStateFromNode(nodeId);
                });
                this._client.updateTerritory(this._territoryId, this._selfPatterns);
            }
        }

        _stateActiveObjectChanged(model, activeObjectId) {
            if (this._currentNodeId === activeObjectId) {
                // The same node selected as before - do not trigger
            } else {
                this.selectedObjectChanged(activeObjectId);
            }
        }

        _getObjectDescriptor(/*nodeId*/) {
            return {};
        }

        /* * * * * * * * Visualizer life cycle callbacks * * * * * * * */
        destroy() {
            this._detachClientEventListeners();
        }

        _attachClientEventListeners() {
            this._detachClientEventListeners();
            WebGMEGlobal.State.on('change:' + CONSTANTS.STATE_ACTIVE_OBJECT, this._stateActiveObjectChanged, this);
        }

        _detachClientEventListeners() {
            WebGMEGlobal.State.off('change:' + CONSTANTS.STATE_ACTIVE_OBJECT, this._stateActiveObjectChanged);
        }

        onActivate() {
            this._attachClientEventListeners();
            if (typeof this._currentNodeId === 'string') {
                WebGMEGlobal.State.registerActiveObject(this._currentNodeId, {suppressVisualizerFromNode: true});
            }
        }

        onDeactivate() {
            this._detachClientEventListeners();
        }
    }

    return DemoDiffSyncControl;
});