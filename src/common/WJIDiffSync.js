/* globals define */
/* eslint-env node, browser */

define([
    './build/WJIDiffSync.umd'
], function (
    DiffSyncLib
) {
    const {default: WJIDiffSync, deepCopy} = DiffSyncLib;

    WJIDiffSync.deepCopy = deepCopy;

    return WJIDiffSync;
});