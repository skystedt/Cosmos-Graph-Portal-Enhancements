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
  const tabPanesContainer = element.querySelector(".tabPanesContainer");
  if (!tabPanesContainer) {
    console.warn("Element with class 'tabPanesContainer' not found");
    return;
  }
  tabsObserver.observe(tabPanesContainer, { subtree: false, childList: true });
}

function tabElementAdded(tabElement) {
  const textarea = tabElement.querySelector(".queryContainer textarea");
  if (!textarea) {
    console.warn("Textarea inside 'queryContainer' not found");
    return;
  }
  textarea.addEventListener("keydown", textareaKeydown);
}

function textareaKeydown(event) {
  if (event.key === "Enter" && !event.shiftKey) {
    event.stopPropagation();
    return true;
  }
}

observeFirstBodyMutation();
