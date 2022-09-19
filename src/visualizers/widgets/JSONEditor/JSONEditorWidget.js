/*globals define*/

define([
    './build/json-editor.umd',
    'css!./build/style.css',
    'css!./styles/JSONEditorWidget.css'
], function (
    JSONEditor
) {
    'use strict';

    const WIDGET_CLASS = 'json-editor';
    class JSONEditorWidget {
        constructor(logger, container) {
            this._logger = logger.fork('Widget');
            this.$el = container;
            this.$el.addClass(WIDGET_CLASS);
            this.editor = new JSONEditor({
                target: this.$el[0],
                props: {
                    content: {
                        json: {},
                    },
                }
            });
            this._logger.debug('ctor finished');
        }

        setState(content, readOnly=false) {
            this.editor.$set({content, readOnly});
        }

        setOnChange(onChange) {
            this.editor.$set({onChange});
        }

        onWidgetContainerResize (/*width, height*/) {
            this._logger.debug('Widget is resizing...');
        }

        addNode (/*desc*/) {

        }

        removeNode (/*gmeId*/) {

        }

        updateNode (/*desc*/) {

        }

        /* * * * * * * * Visualizer event handlers * * * * * * * */

        destroy () {
        }

        onActivate () {
            this._logger.debug('JSONEditor has been activated');
        }

        onDeactivate () {
            this._logger.debug('JSONEditor has been deactivated');
        }
    }

    return JSONEditorWidget;
});
