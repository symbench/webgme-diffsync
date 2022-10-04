/* eslint-env node, mocha */

describe('WebGMEDiffSyncer', function () {
    const testFixture = require('../globals');
    const Core = testFixture.requirejs('common/core/coreQ');
    const Importer = testFixture.requirejs('webgme-json-importer/JSONImporter');
    const diffSyncLib = testFixture.requirejs('webgme-diffsync/WJIDiffSync');
    const {NodeDiffFactory} = testFixture.requirejs('webgme-diffsync/DemoDiffSyncUtils');
    const {WJIDiffSync, deepCopy} = diffSyncLib;
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
        targetSubtree;

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
        diffFunc = NodeDiffFactory(parentPath);
    });


    describe('client updates', function () {
        let clientState, shadow, diffSync;
        beforeEach(async function () {
            const importer = new Importer(core, rootNode);
            clientState = await importer.toJSON(targetSubtree);
            shadow = deepCopy(clientState);
            diffSync = new WJIDiffSync(
                importer,
                shadow
            );
        });

        it('should diff and apply attribute changes from client', async () => {
            assert(clientState.attributes.name === 'Continents');
            clientState.attributes.name = 'Changed Name';
            await diffSync.onUpdatesFromClient(clientState, targetSubtree);
            await delay(10);
            assert(core.getAttribute(targetSubtree, 'name') === 'Changed Name', 'name change not synchronized');
        });

        it('should diff and apply multiple attribute changes throughout the subtree', async () => {

            clientState.children[2].attributes.name = 'Changed Name';
            clientState.children[2].attributes.shortName = 'CN';
            await diffSync.onUpdatesFromClient(clientState, targetSubtree);

            clientState.children[0].attributes.name = 'Changed Name';
            clientState.children[0].attributes.shortName = 'CN';
            await diffSync.onUpdatesFromClient(clientState, targetSubtree);

            await delay(500);

            const child2Path = clientState.children[2].path;
            const child0Path = clientState.children[0].path;

            const child0 = await core.loadByPath(rootNode, child0Path);
            const child2 = await core.loadByPath(rootNode, child2Path);

            assert(core.getAttribute(child2, 'name') === 'Changed Name', 'change not synchronized throughout subtree');
            assert(core.getAttribute(child0, 'name') === 'Changed Name', 'change not synchronized throughout subtree');
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