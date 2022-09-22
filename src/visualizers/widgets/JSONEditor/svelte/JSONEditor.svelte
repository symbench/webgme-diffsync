<script>
    import { JSONEditor } from '../../../../../node_modules/svelte-jsoneditor';
    export let content = {
        text: undefined, // used when in text mode
        json: {
          array: [1, 2, 3],
          boolean: true,
          color: '#82b92c',
          null: null,
          number: 123,
          object: { a: 'b', c: 'd' },
          string: 'Hello World'
        }
    },
    readOnly = false,
    onChange = null,
    title='JSONEditor';

    export function setReadOnly() {
        readOnly = true;
    }

    export function setContent(contentJSON) {
        content = contentJSON;
    }
</script>

<div>
    <h3>{title}</h3>
    <JSONEditor bind:content bind:readOnly bind:onChange/>
</div>