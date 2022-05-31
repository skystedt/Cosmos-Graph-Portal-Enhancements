"use strict";

class DomListener {
  buttons;
  monacoLoadedCallback;
  queryInputLoadedCallback;
  resultJsonAddedCallback;
  resourceTreeItemAddedCallback;

  useTakeRecords = null;
  monacoLoaded = false;

  constructor(buttons, monacoLoadedCallback, queryInputLoadedCallback, resultJsonAddedCallback, resourceTreeItemAddedCallback) {
    this.buttons = buttons;
    this.monacoLoadedCallback = monacoLoadedCallback;
    this.queryInputLoadedCallback = queryInputLoadedCallback;
    this.resultJsonAddedCallback = resultJsonAddedCallback;
    this.resourceTreeItemAddedCallback = resourceTreeItemAddedCallback;

    this.mutationObserver(document.body, false, this.flexContainerAddedToBody, (node) => node.querySelector(":scope > .flexContainer"));
  }

  mutationObserver(element, continuous, callback, condition, options) {
    if (continuous && this.useTakeRecords === null) {
      console.warn("The first call should not be continuous, it will determine if takeRecords should be used");
    }

    const flattenMutations = (mutations) =>
      mutations.flatMap((m) => Array.from(m.addedNodes));

    const handleMutations = (nodes, observer) => {
      const hits = [];
      for (const node of nodes) {
        const hit = condition(node);
        if (hit) {
          hits.push(hit);
          if (!continuous && observer) {
            observer.disconnect();
          }
        }
      }
      if (!hits.length) {
        return false;
      }
      callback.bind(this)(options?.collection ? hits : hits[0]);
      return true;
    };

    const initialHits = handleMutations(element.children);
    if (initialHits && !continuous) {
      return;
    }

    const mutationObserver = new MutationObserver((mutations, observer) => {
      this.useTakeRecords = false;
      handleMutations(flattenMutations(mutations), observer);
    });

    mutationObserver.observe(element, { childList: true, subtree: !!options?.subtree });

    // unknown why but sometimes the mutationobserver never calls back when mutations are observed so we try to detect it and instead poll takeRecords

    if (this.useTakeRecords === null) {
      const takeRecordsPolling = () => {
        let mutations = mutationObserver.takeRecords();
        if (mutations.length) {
          this.useTakeRecords = true;
          console.warn("MutationObserver failed to automatically call back, using polling instead");
          handleMutations(flattenMutations(mutations), mutationObserver);
        } else if (this.useTakeRecords !== false) {
          setTimeout(takeRecordsPolling, 200);
        }
      };
      takeRecordsPolling();
    }

    if (this.useTakeRecords) {
      const takeRecordsPolling = () => {
        let mutations = mutationObserver.takeRecords();
        handleMutations(flattenMutations(mutations), mutationObserver);
        if (!mutations.length || continuous) {
          setTimeout(takeRecordsPolling, 10);
        }
      };
      takeRecordsPolling();
    }
  }

  flexContainerAddedToBody(element) {
    const tabPanesContainer = element.querySelector(".tabPanesContainer");
    if (!tabPanesContainer) {
      console.warn("Tab panes element not found");
      return;
    }
    this.mutationObserver(tabPanesContainer, true, this.graphTabAdded, (node) => node.querySelector(".graphExplorerContainer"));

    const resourceTreeContainer = element.querySelector(".resourceTreeAndTabs .collectionsTreeWithSplitter #mainslide");
    if (!resourceTreeContainer) {
      console.warn("Resource tree element not found");
      return;
    }
    this.mutationObserver(resourceTreeContainer, false, this.resourceTreeAdded, (node) => (node.classList.contains("accordion") ? node : null));
  }

  graphTabAdded(element) {
    this.mutationObserver(element, true, this.resultJsonAdded, (node) => node.querySelector(".tabComponentContainer > .graphTabContent"));

    if (!this.monacoLoaded) {
      const menuBarContainer = document.querySelector(".commandBarContainer [role=menubar] .ms-CommandBar-primaryCommand");
      if (!menuBarContainer) {
        console.warn("Menu bar element not found");
        return;
      }
      this.mutationObserver(menuBarContainer, false, this.newSqlQueryButtonAdded, (node) => node.querySelector("button[name='New SQL Query']"));
    } else {
      if (this.queryInputLoadedCallback) {
        const queryInput = document.querySelector("#input");
        this.queryInputLoadedCallback(queryInput);
      }
    }

    const queryButton = element.querySelector(".queryContainer button.queryButton");
    if (!queryButton) {
      console.warn("Query button element not found");
      return;
    }
    this.queryButtonAdded(queryButton);
  }

  resultJsonAdded(element) {
    const jsonEditorAdded = (element) => {
      const monacoEditorAdded = (element) => {
        if (this.resultJsonAddedCallback) {
          this.resultJsonAddedCallback(element);
        }
      };
      this.mutationObserver(element, false, monacoEditorAdded, (node) => node.classList.contains("monaco-editor") ? node : null);
    };
    this.mutationObserver(element, true, jsonEditorAdded, (node) => node.classList.contains("jsonEditor") ? node : null);
  }

  newSqlQueryButtonAdded(element) {
    // force monaco to load by opening a tab for New SQL Uery and closing it

    const navTabsContainer = document.querySelector(".resourceTreeAndTabs .nav-tabs");
    if (!navTabsContainer) {
      console.warn("Navigation tabs element not found");
      return;
    }

    const sqlQueryTabAdded = (element) => {
      const tabCloseButton = element.querySelector("[role=button][title=Close]");
      if (tabCloseButton) {
        element.style.display = "none"; // hide the tab header

        const sqlQueryTabElement = document.querySelector(".tabPanesContainer .tab-pane .tabPaneContentContainer");
        if (!sqlQueryTabElement) {
          console.warn("SQL Query tab element not found");
          return;
        }

        const layoutSplitterElement = sqlQueryTabElement.querySelector(".layout-splitter");
        if (layoutSplitterElement) {
          layoutSplitterElement.style.display = "none";
        }
        const queryResultErrorContentContainer = sqlQueryTabElement.querySelector(".queryResultErrorContentContainer");
        if (queryResultErrorContentContainer) {
          queryResultErrorContentContainer.style.display = "none";
        }

        const queryEditorElement = sqlQueryTabElement.querySelector(".queryEditor");
        if (!queryEditorElement) {
          console.warn("SQL Query tab query editor element not found");
          return;
        }

        const jsonEditorAdded = (element) => {
          const monacoEditorAdded = (element) => {
            tabCloseButton.click();
            if (this.monacoLoadedCallback) {
              this.monacoLoadedCallback();
            }
            if (this.queryInputLoadedCallback) {
              const queryInput = document.querySelector("#input");
              this.queryInputLoadedCallback(queryInput);
            }
            this.monacoLoaded = true;
          };
          this.mutationObserver(element, false, monacoEditorAdded, (node) => node.classList.contains("monaco-editor") ? node : null);
        };

        this.mutationObserver(queryEditorElement, false, jsonEditorAdded, (node) => (node.classList.contains("jsonEditor") ? node : null));
      }
    };

    this.mutationObserver(navTabsContainer, false, sqlQueryTabAdded, (node) => node.querySelector(".tabNavText")?.innerText?.startsWith("Query") ? node : null);

    element.click();
  }

  queryButtonAdded(element) {
    const buttonContainer = document.createElement("div");
    buttonContainer.style.display = "flex";
    buttonContainer.style.flexDirection = "column";
    buttonContainer.style.justifyContent = "space-between";
    element.replaceWith(buttonContainer);
    buttonContainer.appendChild(element);

    if (this.buttons?.length) {
      this.buttons.forEach((buttonProperties) => {
        const button = document.createElement("button");
        button.classList.add("filterbtnstyle");
        button.textContent = buttonProperties.text;
        button.style = buttonProperties.style;
        button.style.width = "auto";
        button.style.marginLeft = "16px";
        button.style.whiteSpace = "nowrap";
        if (buttonProperties.click) {
          button.onclick = buttonProperties.click;
        }
        if (buttonProperties.first) {
          buttonContainer.prepend(button);
        } else {
          buttonContainer.append(button);
        }
      });
    }
  }

  resourceTreeAdded(element) {
    const resourceGroups = element.querySelectorAll(".accordionItemContainer");
    for (const resourceGroup of resourceGroups) {
      if (this.resourceTreeItemAddedCallback) {
        this.resourceTreeItemAddedCallback(resourceGroup);
      }
    }
  }
}

(async () => {
  // add editor script
  const script = document.createElement("script");
  script.dataset.monarch = chrome.runtime.getURL("cosmos_gremlin.monarch.js");
  script.dataset.gremlint = chrome.runtime.getURL("gremlint@v3.6.0.js");
  script.src = chrome.runtime.getURL("extension_editor.js");
  document.head.appendChild(script);

  const sendMessageToEditor = (message) => {
    document.dispatchEvent(
      new CustomEvent("cosmos_extension", {
        detail: message
      })
    );
  };

  const buttons = [{
    text: "Format Query",
    style: "background: #66aaaa",
    first: true,
    click: () => sendMessageToEditor({ type: "format" })
  }];

  const monacoLoaded = () => {
    sendMessageToEditor({
      type: "monaco"
    });
  };

  const queryInputLoaded = (element) => {
    sendMessageToEditor({
      type: "query",
      identifier: `#${element.id}`
    });
  };

  const resultJsonAdded = (element) => {
    const identifier = `result-${crypto.randomUUID()}`;
    element.classList.add(identifier);
    sendMessageToEditor({
      type: "result",
      identifier: `.${identifier}`,
      model: element.dataset.uri
    });
  };

  // hide NOTEBOOKS in the resource tree
  const resourceTreeItemAdded = (element) => {
    const resourceGroupHeaderElement = element.querySelector(".accordionItemHeader");
    const resourceGroupContentElement = element.querySelector(".accordionItemContent");
    if (resourceGroupHeaderElement.innerText === "NOTEBOOKS") {
      if (resourceGroupContentElement.clientHeight > 0) {
        resourceGroupHeaderElement.click();
      }
    }
  };

  new DomListener(buttons, monacoLoaded, queryInputLoaded, resultJsonAdded, resourceTreeItemAdded);

  // add styles
  const css = document.createElement("link");
  css.href = chrome.runtime.getURL("extension.css");
  css.rel = "stylesheet";
  css.type = "text/css";
  document.head.appendChild(css);
})();
