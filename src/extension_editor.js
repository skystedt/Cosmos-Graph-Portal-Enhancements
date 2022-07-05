class Editor {
  static get GremlinLanguage() { return "gremlin"; }
  static get QueryLineHeight() { return 19; }
  static get QueryMinLineCount() { return 4; }
  static get ResultLineHeight() { return 16; }

  static options() {
    return {
      fontSize: 12,
      tabSize: 2,
      insertSpaces: true,
      scrollbar: {
        vertical: "visible",
        horizontal: "visible",
        verticalHasArrows: true,
        horizontalHasArrows: true,
        horizontalScrollbarSize: 14,
        arrowSize: 20
      },
      scrollBeyondLastColumn: 3,
      scrollBeyondLastLine: false,
      lineNumbers: false,
      lineNumbersMinChars: 3,
      folding: true,
      mouseWheelZoom: false,
      wordBasedSuggestions: false,
      minimap: {
        enabled: false
      },
      overviewRulerLanes: 0,
      hideCursorInOverviewRuler: true,
      renderLineHighlight: "none"
    };
  }

  gremlinLanguageDefinition = null;
  gremlinFormatter = null;
  editorMap = {};

  async load(monarchUrl, gremlintUrl) {
    const { default: gremlinLanguageDefinition } = await import(monarchUrl);
    this.gremlinLanguageDefinition = gremlinLanguageDefinition;
    this.gremlinFormatter = await import(gremlintUrl);
  }

  registerGremlin() {
    if (!window.monaco) {
      console.warn("Monaco is not laoded");
      return;
    }
    
    monaco.languages.register({ id: Editor.GremlinLanguage });
    monaco.languages.setMonarchTokensProvider(Editor.GremlinLanguage, this.gremlinLanguageDefinition);
  }

  query(textarea) {
    const container = textarea.parentNode;
    
    const computedStyle = window.getComputedStyle(textarea);

    const options = Editor.options();
    options.language = Editor.GremlinLanguage;
    options.value = textarea.value;
    options.fontFamily = computedStyle.fontFamily;
    options.fontSize = 14;
    options.lineNumbers = true;
    options.folding = false;

    const editor = monaco.editor.create(container, options);

    if (!editor) {
      console.warn("Failed to create monaco editor");
      return;
    }

    const modelUri = editor.getModel().uri.toString();
    this.editorMap[modelUri] = editor;

    textarea.style.display = "none";

    const element = editor.getDomNode();
    element.style.position = "absolute"; // make containers size not be dependent on the editors size (enables us to resize the editor based on the containers size)

    const queryContainer = textarea.closest(".queryContainer");
    const graphExplorerContainer = queryContainer.closest(".graphExplorerContainer");

    const executeQuery = () => queryContainer.querySelector(".queryButton")?.click();
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, executeQuery);
    editor.addCommand(monaco.KeyMod.Shift | monaco.KeyCode.Enter, executeQuery);

    let queryMaxHeight;
    const calculateQueryMaxHeight = () => {
      const queryContainerStyles = getComputedStyle(queryContainer);
      const paddingTop = parseInt(queryContainerStyles.getPropertyValue("padding-top"), 10);
      const paddingBottom = parseInt(queryContainerStyles.getPropertyValue("padding-bottom"), 10);
      const availableHeight = (graphExplorerContainer.clientHeight - paddingTop - paddingBottom - paddingTop) / 2; // second paddingTop is to have same padding below result editor as above query editor
      queryMaxHeight = Math.floor(availableHeight);
    };
    calculateQueryMaxHeight();

    let horizontalScrollbar = false;

    const resizeEditor = () => {
      if (container.clientWidth !== 0) { // only resize when we have a width (can happen i.e. if another query tab is selected and graph is hidden)
        
        const width = container.clientWidth;

        const layoutInfo = editor.getLayoutInfo();

        // calculate the height, editor.getScrollHeight() is not used since it will not decrease in size
        const lineCount = editor.getModel().getLineCount();
        const scrollHeight = lineCount * Editor.QueryLineHeight + horizontalScrollbar * layoutInfo.horizontalScrollbarHeight;
        const height = Math.min(Math.max(scrollHeight, Editor.QueryMinLineCount * Editor.QueryLineHeight), queryMaxHeight);

        editor.layout({ width, height });
        
        const containerHeight = height + 2; // add borders
        container.style.height = containerHeight + "px"; // needed since the editor has position absolute
      }
    };

    editor.onDidChangeModelContent((event) => {
      let value = editor.getValue();
      if (!value.includes("\n")) { // unknown reason but value needs to be multiline, otherwise it's not "properly" set in the textbox (when submiting the query it will not use the set value)
        value += "\r\n";
      }
      textarea.value = value;
      textarea.dispatchEvent(new Event("change", { bubbles: true })); // dispatch change event, to make the value change to be set

      // resize the editor when the content changes
      resizeEditor();
    });

    // listen to class changes determine when there is a horizontal scroll bar (used when calculating editor height)
    // (editor.onDidScrollChange is not reliable)
    const horizontalScrollbarClassObserver = new MutationObserver((mutations, observer) => {
      for (const mutation of mutations) {
        const previousHorizontalScrollbar = mutation.oldValue.split(" ").includes("visible");
        horizontalScrollbar = mutation.target.classList.contains("visible");
        if (previousHorizontalScrollbar !== horizontalScrollbar) {
          // if scroll bar is added/removed, resize editor
          resizeEditor();
        }
      }
    });
    horizontalScrollbarClassObserver.observe(element.querySelector(".scrollbar.horizontal"), {
      attributeFilter: [ "class" ],
      attributeOldValue: true
    });

    // resize editor when container resizes, triggers when window rezises
    const resizeObserver = new ResizeObserver(() => {
      calculateQueryMaxHeight();
      resizeEditor();
    });
    resizeObserver.observe(container);
  }

  result(existingEditor, modelUri) {
    const container = existingEditor.parentNode;
    
    const options = Editor.options();
    options.model = monaco.editor.getModel(modelUri);
    options.readOnly = true;

    const editor = monaco.editor.create(container, options);

    if (!editor) {
      console.warn("Failed to create monaco editor");
      return;
    }

    existingEditor.style.display = "none";
      
    const graphExplorerContainer = container.closest(".graphExplorerContainer");

    const resizeEditor = () => {
      if (container.clientWidth !== 0) { // only resize when we have a width (can be empty i.e. when switching result tab)

        const layoutInfo = editor.getLayoutInfo();

        const width = Math.max(editor.getScrollWidth(), container.clientWidth); // make editor fill the container if it is smaller
        
        // calculate the height, editor.getScrollHeight() is not used since it will not decrease in size
        const lineCount = editor.getModel().getLineCount();
        const scrollHeight = lineCount * Editor.ResultLineHeight + layoutInfo.horizontalScrollbarHeight;
        const maxHeight = graphExplorerContainer.clientHeight - 24 - 12; // make the max height fit into the container (the minus is for the containers padding)
        const height = Math.min(scrollHeight, maxHeight);

        editor.layout({ width, height });

        const containerParentHeight = height +
          24 + 12 + // add paddings/margins for containing elements
          4; // add borders for containing elements
        container.parentNode.style.height = containerParentHeight + "px"; // prevent scroll position jumping around when switching tabs
      }
    };

    // resize the editor when the content changes
    editor.onDidChangeModelContent(resizeEditor);

    // resize the editor when the scroll changes (needed when the result editor is larger than what is left of the window)
    editor.onDidScrollChange(resizeEditor);

    // resize editor when window rezises
    window.addEventListener("resize", resizeEditor);
    /*
    // resize editor when the container resizes, triggers when window rezises
    const containerResizeObserver = new ResizeObserver(resizeEditor);
    containerResizeObserver.observe(container);
    */
  }

  format(modelUri) {
    const editor = this.editorMap[modelUri];
    const query = editor.getValue();

    // first format with maxLineLength equal to the queries length, will remove all unnecessary whitespaces (except whitespaces before the query starts and after the query ends)
    const singleLine = this.gremlinFormatter.formatQuery(query, {
      indentation: 0,
      maxLineLength: query.length,
      shouldPlaceDotsAfterLineBreaks: true
    });

    // remove whitespaces before the query starts and after the query ends
    const trimmedSingleLine = singleLine.trim();

    // second format to try to force ine breaks as best as possible (keep lines long but have several by on seperate lines)
    const maxLineLength = Math.min(Math.max(Math.floor(trimmedSingleLine.length / 2), 40), trimmedSingleLine.length - 1); // half the query but not below 40 except if the query is less

    const formattedQuery = this.gremlinFormatter.formatQuery(trimmedSingleLine, {
      indentation: 0,
      maxLineLength: maxLineLength,
      shouldPlaceDotsAfterLineBreaks: true
    });

    // update editor but keep undo state, https://github.com/react-monaco-editor/react-monaco-editor/pull/212
    editor.pushUndoStop();
    editor.executeEdits("", [ { range: editor.getModel().getFullModelRange(), text: formattedQuery }], [new monaco.Range(1, 1, 1, 1)] );
    editor.pushUndoStop();
  }
}

(async () => {
  const editor = new Editor();

  document.addEventListener("cosmos_extension", (event) => {
    if (event.detail.type === "monaco") {
      editor.registerGremlin();
      
    } else if (event.detail.type === "query") {
      const target = document.querySelector(event.detail.identifier);
      editor.query(target);

    } else if (event.detail.type === "result") {
      const target = document.querySelector(event.detail.identifier);
      editor.result(target, event.detail.model);
      
    } else if (event.detail.type === "format") {
      editor.format(event.detail.modelUri);
    }
  });
  
  await editor.load(document.currentScript.dataset.monarch, document.currentScript.dataset.gremlint);
})();
