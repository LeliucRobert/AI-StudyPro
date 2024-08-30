let conversationHistory = [
  {
    role: "system",
    content:
      "Any statement that the user says, tell him to refresh the page to load the webpage info.",
  },
  {
    role: "assistant",
    content: "Please refresh the page to load the webpage info.",
  },
];

let pageText = "";

chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
  if (request.action === "getHistory") {
    sendResponse(conversationHistory);
  } else if (request.action === "addMessage") {
    conversationHistory.push(request.message);
    sendResponse({ status: "ok" });
  } else if (request.action === "clearHistory") {
    conversationHistory = [];
    sendResponse({ status: "ok" });
  } else if (request.action === "getPageText") {
    sendResponse(pageText);
  }
});

chrome.webNavigation.onCompleted.addListener(
  async () => {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    if (!tab || !tab.url) {
      return;
    }

    if (tab.url.startsWith("chrome://")) {
      return;
    }

    chrome.scripting.executeScript(
      {
        target: { tabId: tab.id },
        function: () => {
          return {
            title: document.title,
            innerText: document.body.innerText,
          };
        },
      },
      (results) => {
        if (results && results[0] && results[0].result) {
          const { title, innerText } = results[0].result;

          conversationHistory = [
            {
              role: "system",
              content: `The user is on a page with the following content: ${innerText}`,
            },
            {
              role: "assistant",
              content: `You are on page: ${title}. How can i help you?`,
            },
          ];
        } else {
          return;
        }
      }
    );
  },
  { url: [{ schemes: ["http", "https"] }] }
);
