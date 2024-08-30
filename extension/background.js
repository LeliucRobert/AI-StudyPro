// chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
//   if (request.action === "summarize") {
//     const { tabId, language, style, length } = request;

//     // Execute script to get page text
//     chrome.scripting.executeScript(
//       {
//         target: { tabId: tabId },
//         function: () => {
//           const pageText = document.body.innerText;
//           return pageText;
//         },
//       },
//       async (results) => {
//         if (results && results[0] && results[0].result) {
//           const pageText = results[0].result;
//           const url = "http://127.0.0.1:8000/summarize/";

//           try {
//             const response = await fetch(url, {
//               method: "POST",
//               headers: {
//                 "Content-Type": "application/json",
//               },
//               body: JSON.stringify({
//                 text: pageText,
//                 language: language,
//                 style: style,
//                 length: length,
//               }),
//             });

//             if (!response.ok) {
//               throw new Error("Network response was not ok");
//             }

//             const data = await response.json();
//             console.log("Summary received:", data);

//             const { jsPDF } = window.jspdf;
//             const doc = new jsPDF();

//             const margin = 10;
//             const pageHeight = doc.internal.pageSize.height;
//             const lineHeight = 10;
//             const maxLinesPerPage = Math.floor((pageHeight - 40) / lineHeight);

//             doc.setFont("Helvetica", "normal");

//             doc.setFontSize(18);
//             doc.text("Summary Report", 10, 20);

//             doc.setLineWidth(0.5);
//             doc.line(10, 25, 200, 25);

//             doc.setFontSize(12);

//             const summaryLines = doc.splitTextToSize(data.summary, 180);

//             let currentY = 40;
//             let currentLineIndex = 0;

//             const addNewPageIfNeeded = () => {
//               if (currentLineIndex >= maxLinesPerPage) {
//                 doc.addPage();
//                 currentY = 20;
//                 currentLineIndex = 0;
//               }
//             };

//             for (let i = 0; i < summaryLines.length; i++) {
//               addNewPageIfNeeded();
//               doc.text(summaryLines[i], margin, currentY);
//               currentY += lineHeight;
//               currentLineIndex++;
//             }

//             doc.save("summary.pdf");

//             chrome.runtime.sendMessage({ action: "summaryComplete" });
//           } catch (error) {
//             console.error("Error:", error);
//             chrome.runtime.sendMessage({
//               action: "summaryError",
//               error: error.toString(),
//             });
//           }
//         } else {
//           console.error("Failed to extract text from the page.");
//           chrome.runtime.sendMessage({
//             action: "summaryError",
//             error: "Failed to extract text from the page.",
//           });
//         }
//       }
//     );

//     sendResponse({ status: "processing" });
//     return true; // Indicates that the response is async
//   }
// });
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
          console.error("Failed to extract text from the page.");
        }
      }
    );
  },
  { url: [{ schemes: ["http", "https"] }] }
);
