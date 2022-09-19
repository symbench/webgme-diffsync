/* globals define */
/* eslint-env node, browser */

define([
    'text!./Countries.json',
    'text!./Languages.json',
    'text!./Continents.json',
], function (
    Countries,
    Languages,
    Continents
) {
    return {
        countries: JSON.parse(Countries),
        languages: JSON.parse(Languages),
        continents: JSON.parse(Continents)
    };
});