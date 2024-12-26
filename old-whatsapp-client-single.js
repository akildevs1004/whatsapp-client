const WebSocket = require("ws");
const wbm = require("./src/index");
const rimraf = require("rimraf");
const path = require("path");
const fs = require("fs");

// Create a writable stream for logging
const logFileName = `log_${getFormattedDate("file")}.log`;
const logStream = fs.createWriteStream(logFileName, { flags: "a" });

// Override console.log and console.error
// Override console.log and console.error to log both to file and console
function logToFileAndConsole(message, type = "log") {
  const timestamp = `[${getFormattedDate()}] `;
  const formattedMessage = `${timestamp}${message}\n`;

  logStream.write(formattedMessage); // Write to the log file
  if (type === "log") {
    process.stdout.write(formattedMessage); // Log to console (stdout)
  } else if (type === "error") {
    process.stderr.write(formattedMessage); // Log to console (stderr)
  }
}

console.log = (message) => logToFileAndConsole(message);
console.error = (message) => logToFileAndConsole(message, "stderr");

let sessionActive = true;
let whatsappWindowActive = false;
let disconnectCounter = 60;
const clientCompanyId = 13; // Akil Security

function connectWebSocket() {
  const ws = new WebSocket("wss://139.59.69.241:7777", {
    rejectUnauthorized: false,
  });

  ws.on("open", () => {
    console.log(`Connected to WSS server with Company ID: ${clientCompanyId}`);
    ws.send(clientCompanyId.toString());
  });

  ws.on("message", async (message) => {
    console.log("Received from server:", message);

    if (!sessionActive) {
      console.log("WhatsApp session inactive. Skipping message processing.");
      return;
    }

    try {
      const {
        whatsapp_number,
        message: whatsappMessage,
        id,
        cmd,
        company_id,
      } = JSON.parse(message);

      if (cmd === "new-message" && !whatsappWindowActive) {
        if (parseInt(company_id) === clientCompanyId) {
          console.log(`Processing new message at: ${getFormattedDate()}`);
          await processWhatsAppMessage(
            ws,
            whatsapp_number,
            whatsappMessage,
            id
          );
        } else {
          console.log(
            `Company ID mismatch. Expected: ${clientCompanyId}, Received: ${company_id}`
          );
        }
      } else {
        console.log(
          `Message already in queue: cmd=${cmd}, whatsappWindowActive=${whatsappWindowActive}`
        );
      }
    } catch (error) {
      console.error("Error parsing JSON or processing message:", error);
    }
  });

  ws.on("close", () => {
    console.log(
      `Disconnected. Reconnecting in ${disconnectCounter} seconds...`
    );
    scheduleReconnect();
  });

  ws.on("error", (err) => {
    console.error("WebSocket error:", err);
    scheduleReconnect();
  });
}

async function processWhatsAppMessage(ws, phone, message, id) {
  whatsappWindowActive = true;
  try {
    await wbm.start({
      showBrowser: true,
      session: sessionActive,
      sessionName: "akil_session",
    });
    await wbm.send([phone], message);
    const wpResponse = await wbm.end();
    sendResponse(
      ws,
      id,
      "sent",
      wpResponse === "browser-closed" ? "browser-closed" : "completed"
    );
    console.log(`Message processed successfully at: ${getFormattedDate()}`);
  } catch (err) {
    console.error("Error during WhatsApp message sending:", err);
  } finally {
    whatsappWindowActive = false;
  }
}

function sendResponse(ws, id, cmd, status) {
  const response = JSON.stringify({ id, cmd, status });
  ws.send(response);
  console.log("Response sent to server:", response);
}

function scheduleReconnect() {
  setTimeout(connectWebSocket, 1000 * disconnectCounter);
  //disconnectCounter = Math.min(disconnectCounter + 10, 60);
}

function getFormattedDate(format = "console") {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  if (format === "file") {
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(
      now.getDate()
    )}`;
  }
  return `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(
    now.getSeconds()
  )} ${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function deleteFileWithRetry(filePath, retries = 3) {
  let attempt = 0;
  function tryDelete() {
    rimraf(filePath, (err) => {
      if (err) {
        attempt++;
        if (attempt < retries) {
          console.log(`Retrying file deletion (Attempt ${attempt})...`);
          setTimeout(tryDelete, 1000);
        } else {
          console.error("Failed to delete file after multiple attempts:", err);
        }
      } else {
        console.log("File deleted successfully.");
      }
    });
  }
  tryDelete();
}

// Start WebSocket connection
connectWebSocket();
