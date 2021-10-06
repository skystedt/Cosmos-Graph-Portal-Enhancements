"use strict";

(function () {
  const tabPanesSelector = ".tabPanesContainer";
  const queryEditorSelector = ".queryContainer textarea";

  function observeFirstBodyMutation() {
    const bodyObserver = new MutationObserver((mutationsList, observer) => {
      for (const mutation of mutationsList) {
        for (const node of mutation.addedNodes) {
          observer.disconnect();
          elementAddedToBody(node);
        }
      }
    });
    bodyObserver.observe(document.body, { subtree: false, childList: true });
  }

  function elementAddedToBody(element) {
    const tabsObserver = new MutationObserver((mutationsList, observer) => {
      for (const mutation of mutationsList) {
        for (const node of mutation.addedNodes) {
          tabElementAdded(node);
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

  function tabElementAdded(tabElement) {
    const queryEditor = tabElement.querySelector(queryEditorSelector);
    if (!queryEditor) {
      console.warn("Query editor element not found");
      return;
    }
    queryEditor.addEventListener("keydown", queryEditorKeydown);
  }

  function queryEditorKeydown(event) {
    if (event.key === "Enter" && !event.ctrlKey) {
      event.stopPropagation();
      return true;
    }
  }

  function enableQueryEditorContextMenu() {
    document.addEventListener("contextmenu", (e) => {
      if (e.target.matches(queryEditorSelector)) {
        e.stopPropagation();
      }
    }, true);
  }

  observeFirstBodyMutation();
  enableQueryEditorContextMenu();
})();
