/* eslint-env node, mocha */

describe('WebGMEDiffSyncer', function () {
    const testFixture = require('../globals');
    const Core = testFixture.requirejs('common/core/coreQ');
    const Importer = testFixture.requirejs('webgme-json-importer/JSONImporter');
    const diff = testFixture.requirejs('webgme-json-importer/changeset');
    const diffSyncLib = testFixture.requirejs('webgme-diffsync/WJIDiffSync');
    const {NodeDiffFactory} = testFixture.requirejs('webgme-diffsync/DemoDiffSyncUtils');
    const WJIDiffSync = diffSyncLib.default;
    const {deepCopy} = diffSyncLib;
    const assert = require('assert');
    const gmeConfig = testFixture.getGmeConfig();
    const Q = testFixture.Q;
    let counter = 0;
    const logger = testFixture.logger.fork('JSONImporter');
    const projectName = 'testProject';
    let project,
        gmeAuth,
        storage,
        commitHash,
        core,
        rootNode,
        targetSubtree,
        diffFunc;

    async function getNewRootNode(core) {
        const branchName = 'test' + counter++;
        await project.createBranch(branchName, commitHash);
        const branchHash = await project.getBranchHash(branchName);
        const commit = await Q.ninvoke(project, 'loadObject', branchHash);
        return await Q.ninvoke(core, 'loadRoot', commit.root);
    }

    before(async function () {
        this.timeout(7500);
        gmeAuth = await testFixture.clearDBAndGetGMEAuth(gmeConfig, projectName);
        storage = testFixture.getMemoryStorage(logger, gmeConfig, gmeAuth);
        await storage.openDatabase();
        const importParam = {
            projectSeed: testFixture.path.join(__dirname, '..', '..', 'src', 'seeds', 'project', 'project.webgmex',),
            projectName: projectName,
            branchName: 'master',
            logger: logger,
            gmeConfig: gmeConfig
        };

        const importResult = await testFixture.importProject(storage, importParam);
        project = importResult.project;
        core = new Core(project, {
            globConf: gmeConfig,
            logger: logger.fork('core')
        });
        commitHash = importResult.commitHash;
    });

    beforeEach(async () => {
        rootNode = await getNewRootNode(core);
        targetSubtree = await core.loadByPath(rootNode, '/t');
        const parent = core.getParent(targetSubtree);
        const parentPath = parent ? core.getPath(parent) : '';
        diffFunc = NodeDiffFactory(diff, parentPath, Importer.NodeChangeSet);
    });


    describe('client updates', function () {
        let clientState, shadow, diffSync;
        beforeEach(async function () {
            const importer = new Importer(core, rootNode);
            clientState = await importer.toJSON(targetSubtree);
            shadow = deepCopy(clientState);
            diffSync = new WJIDiffSync(
                targetSubtree,
                shadow,
                clientState,
                importer,
                diffFunc
            );
        });

        it('should diff and apply attribute changes from client', async () => {
            assert(clientState.attributes.name === 'Continents');
            clientState.attributes.name = 'Changed Name';
            await diffSync.onUpdatesFromClient(clientState);
            await delay(10);
            assert(core.getAttribute(targetSubtree, 'name') === 'Changed Name', 'name change not synchronized');
        });

        it('should diff and apply multiple attribute changes throughout the subtree', async () => {

            clientState.children[2].attributes.name = 'Changed Name';
            clientState.children[2].attributes.shortName = 'CN';
            await diffSync.onUpdatesFromClient(clientState);

            clientState.children[0].attributes.name = 'Changed Name';
            clientState.children[0].attributes.shortName = 'CN';
            await diffSync.onUpdatesFromClient(clientState);

            await delay(500);

            const child2Path = clientState.children[2].path;
            const child0Path = clientState.children[0].path;

            const child0 = await core.loadByPath(rootNode, child0Path);
            const child2 = await core.loadByPath(rootNode, child2Path);

            assert(core.getAttribute(child2, 'name') === 'Changed Name', 'change not synchronized throughout subtree');
            assert(core.getAttribute(child0, 'name') === 'Changed Name', 'change not synchronized throughout subtree');
        });

        it('should maintain sync when multiple clients are updating different subtrees', async () => {
            const importer = new Importer(core, rootNode);
            const clientState1 = clientState;
            const clientState2 = deepCopy(clientState);
            const shadow2 = deepCopy(clientState2);
            const diffSync1 = diffSync;
            const diffSync2 = new WJIDiffSync(
                targetSubtree,
                shadow2,
                clientState,
                importer,
                diffFunc
            );

            clientState1.children[0].attributes.name = 'client1 change';
            clientState2.children[1].attributes.name = 'client2 change';
            diffSync1.onUpdatesFromClient(clientState1); // Signifying two updates in parallel
            diffSync2.onUpdatesFromClient(clientState2); // Signifying two updates in parallel
            await delay(200);

            const child1 = await core.loadByPath(rootNode, clientState1.children[0].path);
            const child2 = await core.loadByPath(rootNode, clientState2.children[1].path);

            assert(core.getAttribute(child1, 'name') === 'client1 change');
            assert(core.getAttribute(child2, 'name') === 'client2 change');
        });

        it('should fail when client updates a node removed from server', async () => {
            const firstChild = await core.loadByPath(rootNode, clientState.children[0].path);
            const secondChild = await core.loadByPath(rootNode, clientState.children[1].path);
            core.deleteNode(firstChild);
            assert(clientState.children[0].attributes.name === 'Africa');
            await diffSync.onUpdatesFromServer(targetSubtree);
            core.deleteNode(secondChild);
            await diffSync.onUpdatesFromServer(targetSubtree);
            clientState.children[0].attributes.name = 'changed name';
            await diffSync.onUpdatesFromClient(clientState);
            await delay(700);

            assert(clientState.children.length === 5, 'client context reapplied' );
            assert(clientState.children[0].attributes.name !== 'Changed Name', 'client context reapplied' );
        });
    });

    after(async function () {
        await storage.closeDatabase();
        await gmeAuth.unload();
    });
});


function delay(ms) {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve();
        }, ms);
    });
}