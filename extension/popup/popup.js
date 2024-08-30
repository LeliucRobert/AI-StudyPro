document
  .getElementById("summarize-tab")
  .addEventListener("click", function (event) {
    event.preventDefault();
    switchTab("summarize");
  });

document
  .getElementById("similar-tab")
  .addEventListener("click", function (event) {
    event.preventDefault();
    switchTab("similar");
  });

document.getElementById("chat-tab").addEventListener("click", function (event) {
  event.preventDefault();
  switchTab("chat");
});

function switchTab(tab) {
  if (tab === "summarize") {
    document.getElementById("summarize-tab").classList.add("active");
    document.getElementById("similar-tab").classList.remove("active");
    document.getElementById("chat-tab").classList.remove("active");
    document.getElementById("summarize-content").style.display = "block";
    document.getElementById("similar-content").style.display = "none";
    document.getElementById("chat-content").style.display = "none";
  } else if (tab === "similar") {
    document.getElementById("summarize-tab").classList.remove("active");
    document.getElementById("similar-tab").classList.add("active");
    document.getElementById("chat-tab").classList.remove("active");
    document.getElementById("summarize-content").style.display = "none";
    document.getElementById("similar-content").style.display = "block";
    document.getElementById("chat-content").style.display = "none";

    triggerSimilarity();
  } else if (tab === "chat") {
    document.getElementById("summarize-tab").classList.remove("active");
    document.getElementById("similar-tab").classList.remove("active");
    document.getElementById("chat-tab").classList.add("active");
    document.getElementById("summarize-content").style.display = "none";
    document.getElementById("similar-content").style.display = "none";
    document.getElementById("chat-content").style.display = "block";
  }
}

function triggerSimilarity() {
  const settingsContent = document.getElementById("similar-content");
  settingsContent.innerHTML = "Loading search results...";

  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    const pageTitle = tabs[0].title;

    const url = "http://127.0.0.1:8000/search/";
    fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: pageTitle,
      }),
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error("Network response was not ok");
        }
        return response.json(); // Convert response to JSON
      })
      .then((data) => {
        const container = document.getElementById("similar-content");
        container.innerHTML = data.html; // Inject the HTML into the page
      })
      .catch((error) => {
        const settingsContent = document.getElementById("similar-content");
        settingsContent.innerHTML =
          "An error occurred while fetching search results.";
      });
  });
}

document.getElementById("summarize").addEventListener("click", async () => {
  const summarizeButton = document.getElementById("summarize");
  const loadingIndicator = document.getElementById("loading");

  const languageSelect = document.getElementById("languageSelect").value;
  const styleSelect = document.getElementById("styleSelect").value;
  const lengthSelect = document.getElementById("lengthSelect").value;

  summarizeButton.disabled = true;
  loadingIndicator.style.display = "block";

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

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
        const pageText = document.body.innerText;
        return pageText;
      },
    },
    (results) => {
      if (results && results[0] && results[0].result) {
        const pageText = results[0].result;
        const url = "http://127.0.0.1:8000/summarize/";

        fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: pageText,
            language: languageSelect,
            style: styleSelect,
            length: lengthSelect,
          }),
        })
          .then((response) => {
            if (!response.ok) {
              throw new Error("Network response was not ok");
            }
            return response.json();
          })
          .then((data) => {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();

            const margin = 10;
            const pageHeight = doc.internal.pageSize.height;
            const lineHeight = 10;
            const maxLinesPerPage = Math.floor((pageHeight - 40) / lineHeight);

            doc.setFont("Helvetica", "normal");

            doc.setFontSize(18);
            doc.text("Summary Report", 10, 20);

            doc.setLineWidth(0.5);
            doc.line(10, 25, 200, 25);

            doc.setFontSize(12);

            const summaryLines = doc.splitTextToSize(data.summary, 180);

            // doc.text(summaryLines, 10, 40);

            let currentY = 40;
            let currentLineIndex = 0;

            const addNewPageIfNeeded = () => {
              if (currentLineIndex >= maxLinesPerPage) {
                doc.addPage();
                currentY = 20;
                currentLineIndex = 0;
              }
            };

            for (let i = 0; i < summaryLines.length; i++) {
              addNewPageIfNeeded();
              doc.text(summaryLines[i], margin, currentY);
              currentY += lineHeight;
              currentLineIndex++;
            }

            doc.save("summary.pdf");
          })
          .catch((error) => {
            return error;
          })
          .finally(() => {
            summarizeButton.disabled = false;
            loadingIndicator.style.display = "none";
          });
      } else {
        summarizeButton.disabled = false;
        loadingIndicator.style.display = "none";
      }
    }
  );
});

let conversationHistory = [];

chrome.runtime.sendMessage({ action: "getHistory" }, (response) => {
  conversationHistory = response;
  renderConversation();
});

document.getElementById("ai-send").addEventListener("click", async () => {
  const userInput = document.getElementById("ai-input").value;
  if (userInput === "") {
    return;
  }
  document.getElementById("ai-input").value = "";
  conversationHistory.push({ role: "user", content: userInput });
  renderConversation();

  chrome.runtime.sendMessage({
    action: "addMessage",
    message: { role: "user", content: userInput },
  });

  const response = await fetch("http://127.0.0.1:8000/chat/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      conversation: conversationHistory,
    }),
  });

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let aiMessage = "";
  const messageElement = document.createElement("div");
  messageElement.className = "ai-message";

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    aiMessage += decoder.decode(value, { stream: true });
    renderAiMessage(aiMessage, messageElement);
  }

  conversationHistory.push({ role: "assistant", content: aiMessage });
  chrome.runtime.sendMessage({
    action: "addMessage",
    message: { role: "assistant", content: aiMessage },
  });
});

function renderAiMessage(message, messageElement) {
  const conversationDiv = document.getElementById("ai-conversation");
  messageElement.textContent = message;

  conversationDiv.appendChild(messageElement);
  messageElement.scrollIntoView();
}

function renderConversation() {
  const conversationDiv = document.getElementById("ai-conversation");
  conversationDiv.innerHTML = "";

  conversationHistory.forEach((message) => {
    const messageElement = document.createElement("div");
    if (message.role === "system") return;
    messageElement.className =
      message.role === "user" ? "user-message" : "ai-message";
    messageElement.textContent = message.content;
    conversationDiv.appendChild(messageElement);
  });
  conversationDiv.scrollTop = conversationDiv.scrollHeight;
}

document.getElementById("reloadIcon").addEventListener("click", function () {
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    chrome.tabs.reload(tabs[0].id, function () {
      window.close();
    });
  });
});
