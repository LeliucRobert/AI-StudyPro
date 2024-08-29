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
        console.log(data);
        const container = document.getElementById("similar-content");
        container.innerHTML = data.html; // Inject the HTML into the page
      })
      .catch((error) => {
        console.error("Error:", error);
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
  console.log(lengthSelect);
  summarizeButton.disabled = true;
  loadingIndicator.style.display = "block";

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

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
            console.error("Error:", error);
          })
          .finally(() => {
            summarizeButton.disabled = false;
            loadingIndicator.style.display = "none";
          });
      } else {
        console.error("Failed to extract text from the page.");
        summarizeButton.disabled = false;
        loadingIndicator.style.display = "none";
      }
    }
  );
});

conversationHistory = [
  {
    role: "system",
    content: "You are a helpful assistant.",
  },
];

document.getElementById("ai-send").addEventListener("click", async () => {
  const userInput = document.getElementById("ai-input").value;
  if (userInput === "") {
    return;
  }

  document.getElementById(
    "ai-conversation"
  ).innerHTML += `<div class="user-message">${userInput}</div>`;
  document.getElementById("ai-input").value = "";

  conversationHistory.push({
    role: "user",
    content: userInput,
  });

  const typingIndicator = `<div class="ai-message typing-indicator">
                            <span class="typing-indicator"></span>
                            <span class="typing-indicator"></span>
                            <span class="typing-indicator"></span>
                            </div>`;
  document.getElementById("ai-conversation").innerHTML += typingIndicator;

  const response = await fetch("http://127.0.0.1:8000/chat/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      user_input: userInput,
    }),
  });

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let aiMessage = "";
  const aiMessageElement = document.createElement("div");
  aiMessageElement.classList.add("ai-message");
  document.getElementById("ai-conversation").appendChild(aiMessageElement);

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    aiMessage += decoder.decode(value, { stream: true });
    aiMessageElement.textContent = aiMessage;
    aiMessageElement.scrollIntoView();
  }

  document.querySelector(".typing-indicator").forEach((element) => {
    element.remove();
  });
  conversationHistory.push({
    role: "assistant",
    content: aiMessage,
  });
  document.getElementById("ai-input").value = "";
});

// document.getElementById("summarize").addEventListener("click", async () => {
//   const summarizeButton = document.getElementById("summarize");
//   const loadingIndicator = document.getElementById("loading");

//   const languageSelect = document.getElementById("languageSelect").value;
//   const styleSelect = document.getElementById("styleSelect").value;
//   const lengthSelect = document.getElementById("lengthSelect").value;

//   summarizeButton.disabled = true;
//   loadingIndicator.style.display = "block";

//   const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

//   chrome.runtime.sendMessage({
//     action: "summarize",
//     tabId: tab.id,
//     language: languageSelect,
//     style: styleSelect,
//     length: lengthSelect,
//   });

//   // Listen for messages from the background script
//   chrome.runtime.onMessage.addListener((message) => {
//     if (message.action === "summaryComplete") {
//       summarizeButton.disabled = false;
//       loadingIndicator.style.display = "none";
//       alert("Summary is ready and saved as a PDF!");
//     } else if (message.action === "summaryError") {
//       summarizeButton.disabled = false;
//       loadingIndicator.style.display = "none";
//       alert("An error occurred: " + message.error);
//     }
//   });
// });
