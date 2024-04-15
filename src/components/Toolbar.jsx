import { Editor, EditorState, RichUtils, Modifier, CompositeDecorator } from 'draft-js';

export default function Toolbar({ editorState, setEditorState }){
    const applyStyle = (style) => {
        setEditorState(RichUtils.toggleInlineStyle(editorState, style));
    };

    const addLink = () => {
        const selection = editorState.getSelection();
        if (!selection.isCollapsed()) {
            const contentState = editorState.getCurrentContent();
            const contentStateWithEntity = contentState.createEntity('LINK', 'MUTABLE', { url: 'http://example.com' });
            const entityKey = contentStateWithEntity.getLastCreatedEntityKey();
            const newEditorState = EditorState.set(editorState, { currentContent: contentStateWithEntity });
            setEditorState(RichUtils.toggleLink(newEditorState, selection, entityKey));
        }
    };

    return (
        <div className="toolbar">
            <button onClick={() => applyStyle('BOLD')}>B</button>
            <button onClick={() => applyStyle('ITALIC')}>I</button>
            <button onClick={() => applyStyle('UNDERLINE')}>U</button>
            <button onClick={addLink}>Add Link</button>
        </div>
    );
};
