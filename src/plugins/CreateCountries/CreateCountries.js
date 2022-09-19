/*globals define*/
/*eslint-env node, browser*/


define([
    'plugin/PluginConfig',
    './Countries/index',
    'text!./metadata.json',
    'webgme-json-importer/JSONImporter',
    'plugin/PluginBase',
    'underscore'
], function (
    PluginConfig,
    CountryData,
    pluginMetadata,
    JSONImporter,
    PluginBase,
    _
) {
    'use strict';

    pluginMetadata = JSON.parse(pluginMetadata);
    const {countries, continents} = CountryData;

    class CreateCountries extends PluginBase {
        constructor(props) {
            super(props);
            this.pluginMetadata = pluginMetadata;
        }

        async main() {
            const continents = this.getContinentsState();
            if(!this.isMetaTypeOf(this.activeNode, this.META['ExampleFolder'])) {
                this.createMessage(this.activeNode, 'Node is not example folder', 'error');
                this.result.setSuccess(false);
            } else {
                const importer = new JSONImporter(this.core, this.rootNode);
                await importer.apply(this.activeNode, {children: continents});

                await this.save('Successfully created countries');
                this.result.setSuccess(true);
            }
        }

        getContinentsState() {
            const countriesByContinents = _.groupBy(countries, 'continent');
            return Object.entries(countriesByContinents).map(([shortName, countries]) => {
                return {
                    attributes: {
                        name: continents[shortName],
                        shortName
                    },
                    pointers: {
                        base: '@meta:Continent'
                    },
                    children: countries.map(country => {
                        let {name, native, phone, capital} = country;
                        phone = phone.toString();
                        return {
                            attributes: {name, native, phone, capital},
                            pointers: {
                                base: '@meta:Country'
                            }
                        };
                    })
                };
            });
        }

    }

    return CreateCountries;
});
