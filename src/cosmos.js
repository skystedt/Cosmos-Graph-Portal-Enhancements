"use strict";

class QueryEditor {
  #textAreaAddedCallback;
  #keydownCallback;
  #inputCallback;
  #contextMenuCallback;

  #textarea;

  #buttonContainer;
  #buttons = [];
  
  get query() {
    if (this.#textarea) {
      return this.#textarea.value;
    }
    return null;
  }
  set query(value) {
    if (this.#textarea) {
      this.#textarea.value = value;
      this.#textarea.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }

  constructor() {
    this.#observeFirstBodyMutation();
  }
  
  textAreaAdded(callback) {
    this.#textAreaAddedCallback = callback;
  }
  
  input(callback) {
    this.#inputCallback = callback;
  }
  
  keydown(callback) {
    this.#keydownCallback = callback;
  }
  
  contextMenu(callback) {
    this.#contextMenuCallback = callback;
  }
  
  addButton(button) {
    this.#buttons.push(button);
    this.#createButton(button);
  }
  
  resizeToContent() {
    // https://stackoverflow.com/a/25621277
    this.#textarea.style.height = "auto";
    this.#textarea.style.height = (this.#textarea.scrollHeight + 2) + "px";
  }

  addStyle(style) {
    document.head.insertAdjacentHTML("beforeend", `<style>${style}</style>`);
  }

  #queryTextAreaAdded(element) {
    this.#textarea = element;

    element.addEventListener("keydown", (event) => {
      if (this.#keydownCallback) {
        return this.#keydownCallback(event);
      }
    });
    
    element.addEventListener("input", (event) => {
      if (this.#inputCallback) {
        return this.#inputCallback(event);
      }
    });

    document.addEventListener("contextmenu", (event) => {
      const queryTextAreaSelector = ".queryContainer textarea";
      if (event.target.matches(queryTextAreaSelector)) {
        if (this.#contextMenuCallback) {
          return this.#contextMenuCallback(event);
        }
      }
    }, true);

    if (this.#textAreaAddedCallback) {
      return this.#textAreaAddedCallback(element);
    }
  };

  #queryButtonAdded(element) {
    const buttonContainer = document.createElement("div");
    buttonContainer.style.display = "flex";
    buttonContainer.style.flexDirection = "column";
    buttonContainer.style.justifyContent = "space-between";
    element.replaceWith(buttonContainer);
    buttonContainer.appendChild(element);

    this.#buttonContainer = buttonContainer;

    this.#buttons.forEach((button) => {
      this.#createButton(button);
    })
  };

  #createButton(buttonProperties) {
    if (this.#buttonContainer) {
      const button = document.createElement("button");
      button.classList.add("filterbtnstyle", "queryButton");
      button.textContent = buttonProperties.text;
      button.style = buttonProperties.style;
      if (buttonProperties.click) {
        button.onclick = buttonProperties.click;
      }
      if (buttonProperties.first == true) {
        this.#buttonContainer.prepend(button);
      } else {
        this.#buttonContainer.append(button);
      }
    }
  }

  #observeFirstBodyMutation() {
    const bodyObserver = new MutationObserver((mutationsList, observer) => {
      for (const mutation of mutationsList) {
        for (const node of mutation.addedNodes) {
          observer.disconnect();
          this.#elementAddedToBody(node);
        }
      }
    });
    bodyObserver.observe(document.body, { subtree: false, childList: true });
  }

  #elementAddedToBody(element) {
    const tabPanesSelector = ".tabPanesContainer";

    const tabsObserver = new MutationObserver((mutationsList, observer) => {
      for (const mutation of mutationsList) {
        for (const node of mutation.addedNodes) {
          this.#tabElementAdded(node);
        }
      }
    });

    const tabPanesContainer = element.querySelector(tabPanesSelector);
    if (!tabPanesContainer) {
      console.warn("Tab panes element not found");
      return;
    }

    tabsObserver.observe(tabPanesContainer, { subtree: false, childList: true });
  }

  #tabElementAdded(tabElement) {
    const queryContainerSelector = ".graphExplorerContainer .queryContainer";

    const queryContainer = tabElement.querySelector(queryContainerSelector);
    if (!queryContainer) {
      console.warn("Query container element not found");
      return;
    }

    const queryEditor = queryContainer.querySelector("textarea");
    if (!queryEditor) {
      console.warn("Query editor element not found");
      return;
    }

    const queryButton = queryContainer.querySelector("button.queryButton");
    if (!queryButton) {
      console.warn("Query button element not found");
      return;
    }

    this.#queryTextAreaAdded(queryEditor);
    this.#queryButtonAdded(queryButton);
  }
}

class GremlinFormatter {
  #gremlint;

  async load() {
    this.#gremlint = await import(chrome.runtime.getURL("gremlint@v3.6.0.js"));
  }

  format(query) {
    // first format with maxLineLength equal to the queries length, will remove all unnecessary whitespaces (except whitespaces before the query starts and after the query ends)
    const singleLine = this.#gremlint.formatQuery(query, {
      indentation: 0,
      maxLineLength: query.length,
      shouldPlaceDotsAfterLineBreaks: true
    });
    // remove whitespaces before the query starts and after the query ends
    const trimmedSingleLine = singleLine.trim();
    // second format to try to force ine breaks as best as possible (keep lines long but have several by on seperate lines)
    const maxLineLength = Math.min(Math.max(Math.floor(trimmedSingleLine.length / 2), 40), trimmedSingleLine.length - 1); // half the query but not below 40 except if the query is less
    return this.#gremlint.formatQuery(trimmedSingleLine, {
      indentation: 0,
      maxLineLength: maxLineLength,
      shouldPlaceDotsAfterLineBreaks: true
    });
  }
}

(async () => {
  const queryEditor = new QueryEditor();
  
  queryEditor.textAreaAdded((element) => {

    // disable spellcheck
    element.spellcheck = false;
    
    // remove rezise (since we auto size after content) and set min height
    element.style.resize = "none";
    element.style.minHeight = "84px";
    element.style.maxHeight = "50vh";
    element.parentNode.style.minHeight = "inherit"; // default has a min height smaller than the textarea
  });
  
  queryEditor.keydown((event) => {
    // enable new lines
    if (event.key === "Enter" && !event.ctrlKey) {
      event.stopPropagation();
      return true;
    }
    
    // change tab to spaces (to prevent tabbing out of the textarea)
    if (event.key === "Tab") {
      event.preventDefault();
      document.execCommand("insertText", false, "  "); // execCommand is deprecated, but there is no good alternative for inserting text and also preserving undo/redo history
    }
  });
  
  queryEditor.input((event) => {
    // rezise the editor to the query
    queryEditor.resizeToContent();
  });

  queryEditor.contextMenu((event) => {
    // enable query editor context menu
    event.stopPropagation();
  });

  const gremlinFormatter = new GremlinFormatter();
  await gremlinFormatter.load();

  // add format query button
  queryEditor.addButton({
    text: "Format Query",
    style: "background: #66aaaa",
    first: true,
    click: () => {
      queryEditor.query = gremlinFormatter.format(queryEditor.query);
      // rezise the editor to the query
      queryEditor.resizeToContent();
    }
  });
  queryEditor.addStyle(".filterbtnstyle.queryButton:hover { border: solid 1px transparent; }");
  
  queryEditor.addStyle(`
    /* hide suggestion list */
    .graphExplorerContainer .queryContainer .ms-List {
      display: none;
    }
    
    /* limit close button height */
    .graphExplorerContainer .queryContainer .filterclose {
      height: 25px;
    }
    
    /* hide graph helper/load graph */
    .graphExplorerContainer .loadGraphHelper {
      display: none;
    }
  `);
})();
