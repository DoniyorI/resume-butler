"use client";
import React, { useState, useRef } from 'react';
import { Editor, EditorState, RichUtils, getDefaultKeyBinding } from 'draft-js';
import 'draft-js/dist/Draft.css';
import { stateToHTML } from 'draft-js-export-html';
import jsPDF from 'jspdf';
import { Slider } from "@/components/ui/slider";
import { ZoomIn, ZoomOut } from "lucide-react";


export default function Page({ params }) {
  const [scale, setScale] = useState(80);
  const [editorState, setEditorState] = useState(() => EditorState.createEmpty());
  const editorRef = useRef(null);

  const width = 850 * (scale / 100);
  const height = 1101 * (scale / 100);
  const scaledPadding = 30 * (scale / 100);
  const scaledFontSize = 16 * (scale / 100);

  const handleScaleChange = (value) => {
    setScale(value[0]);
  };

  const focusEditor = () => {
    editorRef.current.focus();
  };

  const handleKeyCommand = (command, editorState) => {
    const newState = RichUtils.handleKeyCommand(editorState, command);
    if (newState) {
      setEditorState(newState);
      return 'handled';
    }
    return 'not-handled';
  };

  const mapKeyToEditorCommand = (e) => {
    if (e.keyCode === 9 /* TAB */) {
      const newEditorState = RichUtils.onTab(e, editorState, 4);
      if (newEditorState !== editorState) {
        setEditorState(newEditorState);
      }
      return;
    }
    return getDefaultKeyBinding(e);
  };

  const downloadPDF = () => {
    if (!editorState) {
      console.error("Editor state is not available.");
      return;
    }
  
    // Ensuring that the content state is properly accessed
    const contentState = editorState.getCurrentContent();
    if (!contentState) {
      console.error("No content to print.");
      return;
    }
  
    // Convert content state to HTML
    const html = stateToHTML(contentState);
  
    // Create a hidden div to attach the HTML content
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    tempDiv.style.visibility = 'hidden';
    document.body.appendChild(tempDiv);
  
    // Initialize jsPDF and use html method to add content
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'pt',
      format: 'a4'
    });
  
    // Ensuring jsPDF html method works properly
    pdf.html(tempDiv, {
      callback: (doc) => {
        doc.save('resume.pdf');
        document.body.removeChild(tempDiv);
      },
      x: 10,
      y: 10,
      width: 595.28
    });
  };
  

  return (
    <div className="flex flex-col w-full p-10">
      <h1 className="text-3xl font-medium text-[#559F87] mb-4">
        Resume: {params.resumeId}
      </h1>
      <button onClick={downloadPDF} className="mb-4 p-2 bg-blue-500 text-white rounded hover:bg-blue-700">
        Download as PDF
      </button>
      <div className="flex-grow flex flex-col">
        <div className="flex flex-col items-center justify-center flex-grow p-4" onClick={focusEditor}>
          <div
            style={{
              width: `${width}px`,
              height: `${height}px`,
              padding: `${scaledPadding}px`,
              fontSize: `${scaledFontSize}px`,
            }}
            className="border border-black bg-white box-border overflow-hidden"
          >
            <Editor
              editorState={editorState}
              onChange={setEditorState}
              ref={editorRef}
              placeholder="Start typing..."
              handleKeyCommand={handleKeyCommand}
              keyBindingFn={mapKeyToEditorCommand}
            />
          </div>
        </div>
        <div className="fixed flex space-x-2 right-5 bottom-5 w-[15%]">
          <ZoomOut strokeWidth={2} />
          <Slider
            defaultValue={[100]}
            max={200}
            step={1}
            onValueChange={handleScaleChange}
          />
          <ZoomIn strokeWidth={2} />
        </div>
      </div>
    </div>
  );
}
