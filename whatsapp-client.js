const WebSocket = require("ws");
const wbm = require("./src/index");
const rimraf = require("rimraf");
const path = require("path");
const fs = require("fs");
require("dotenv").config();

const SOCKET_ENDPOINT = process.env.SOCKET_ENDPOINT;
const clientCompanyId = process.env.COMPANY_ID;
const clientCompanyName = process.env.COMPANY_NAME;

console.log("SOCKET_ENDPOINT :", SOCKET_ENDPOINT);
console.log("Company Id :", clientCompanyId);
console.log("Company Name :", clientCompanyName);
console.log("Company Name :", process.env.VERSION);

const logFileName = `logs/log_${getFormattedDate("file")}.log`;
const logStream = fs.createWriteStream(logFileName, { flags: "a" });
let messageQueue = []; // Queue to store incoming messages
let isProcessing = false; // Flag to indicate if a message is being processed

let socketConnectionStatus = false;
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
let disconnectCounter = 30;

setInterval(() => {
  console.log(
    `-------------------------------------setInterval Pending count : ${messageQueue.length}-------------------------------`
  );

  //console.log(ws);

  if (ws) sendMessage(ws);
}, 1000 * 15);

async function sendMessage(ws) {
  console.log(
    `************************Whatsapp Browser Initiaing  : ${isProcessing} ***************************`
  );
  if (isProcessing) {
    console.log("Whatsapp Message already processing... returning.");
    return;
  } // Exit if already processing
  isProcessing = true;

  console.log(
    `Whatsapp messageQueue Pending count Before : ${messageQueue.length}`
  );
  const currentMessage = messageQueue.shift(); // Get the next message in the queue
  console.log(
    `Whatsapp messageQueue Pending count  After : ${messageQueue.length}`
  );
  if (currentMessage) {
    try {
      console.log(`Whatsapp Processing message: ${currentMessage}`);
      if (currentMessage) await processWhatsAppMessageBulk(ws, currentMessage);

      console.log("Whatsapp Message processed successfully.");
    } catch (error) {
      console.error("Whatsapp Error processing message:", error);
    }
  }
  isProcessing = false;
}

function connectWebSocket() {
  console.log(
    `---------------------Initialed Connected to WSS server with Company ID: ${clientCompanyId}`
  );
  ws = new WebSocket(SOCKET_ENDPOINT, {
    rejectUnauthorized: false,
  });
  ws.on("open", async () => {
    socketConnectionStatus = true;
    console.log(`Connected to WSS server with Company ID: ${clientCompanyId}`);
    wbm.start({
      showBrowser: true,
      session: sessionActive,
      sessionName: "akil_session" + clientCompanyId.toString(),
      companyId: clientCompanyId,
    });
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(clientCompanyId.toString());
      console.log("Message sent:", clientCompanyId);
    }
  });

  ws.on("message", async (message) => {
    socketConnectionStatus = true;
    console.log(
      `SSSSSSSSSSSSSSSSSSSSSSSSSSSS Received from server: ${message} SSSSSSSSSSSSSSSSSSSSSSSSSSS`
    );

    if (!sessionActive) {
      console.log("WhatsApp session inactive. Skipping message processing.");
      return;
    }
    whatsappWindowActive = false;
    try {
      const {
        whatsapp_number,
        message: whatsappMessage,
        id,
        cmd,
        company_id,
      } = JSON.parse(message);

      //  if (!whatsappWindowActive) {
      if (parseInt(company_id) != clientCompanyId) {
        if (JSON.parse(message).length > 0) {
          console.log(JSON.parse(message));
          console.log("Duplicate ");
          console.log(isDuplicate(JSON.parse(message)[0].id));
          if (!isDuplicate(JSON.parse(message)[0].id)) {
            messageQueue.push(JSON.parse(message));

            console.log(
              `Storing  new message at: ${JSON.parse(message)[0].id} ${
                messageQueue.length
              }`
            );
          }
          //////////console.log(messageQueue.length);
          //////await processWhatsAppMessageBulk(ws, JSON.parse(message));
          console.log(`Start isProcessing: ${isProcessing}`);

          console.log(`End isProcessing: ${isProcessing}`);
        }
      } else {
        console.log(
          `Company ID mismatch. Expected: ${clientCompanyId}, Received: ${company_id}`
        );
      }
    } catch (error) {
      console.error("Error parsing JSON or processing message:", error);
    }
  });

  ws.on("close", () => {
    const memoryUsage = process.memoryUsage();
    console.log(
      `*************WEBSOCKET IS CLOSED*****************************`
    );
    // Convert heapUsed from bytes to MB (1 MB = 1024 * 1024 bytes)
    const heapUsedInMB = memoryUsage.heapUsed / (1024 * 1024);

    console.log(`Heap Used: ${heapUsedInMB.toFixed(2)} MB`);

    // process.exit(1); // Exit the application with an error code (1)
    //}
    console.log(
      `------------ - ----------Disconnected. Reconnecting in ${disconnectCounter} seconds...`
    );
    //wbm.end();
    socketConnectionStatus = false;
    scheduleReconnect();

    // ws = new WebSocket(SOCKET_ENDPOINT, {
    //   rejectUnauthorized: false,
    // });
  });

  ws.on("error", (err) => {
    socketConnectionStatus = false;

    console.error("WebSocket error:", err);
    //wbm.end();
    scheduleReconnect();
  });
}
function isDuplicate(id) {
  let found = false;

  messageQueue.forEach((element) => {
    element.forEach((message) => {
      if (message.id == id) {
        found = true;
      }
    });
  });

  return found;
}
async function processWhatsAppMessageBulk(ws, messages) {
  console.log(
    "-------------------------------processWhatsAppMessageBulk Messages ---------------------------- "
  );

  whatsappWindowActive = true;
  console.log(messages);

  (async () => {
    for (contact of messages) {
      try {
        console.log(contact.whatsapp_number);

        if (contact.whatsapp_number.length == 12) {
          console.log(`process Start -----------${getFormattedDate()}`);
          console.log(`process whatsapp_number: ${contact.whatsapp_number}`);
          console.log(`process message:${contact.message}`);

          console.log(
            `process Start -------------------- ${getFormattedDate()}`
          );
          //await setTimeout(1000 * 60); // 10 seconds

          deleteMessageById(contact.id);
          await wbm.sendTo(contact.whatsapp_number, contact.message);
          deleteMessageById(contact.id);
          //await setTimeout(1000 * 60); // 10 seconds
          await sendResponse(ws, contact.id, "sent", "completed");
          deleteMessageById(contact.id);
          console.log(`process Deleted ${contact.id}`);
          console.log(`process End-------------------- ${getFormattedDate()}`);

          console.log(
            `process Message processed successfully at: ${getFormattedDate()}`
          );

          isProcessing = true; // Mark processing as done
        }
      } catch (err) {
        console.error("process Error during WhatsApp message sending:", err);
      }
    } //for

    isProcessing = false; // Mark processing as done
  })();

  // //////await wbm.send([phone], message);
  // const wpResponse = await wbm.end();

  whatsappWindowActive = false;
}
function deleteMessageById(id) {
  // Find the outer array where the message exists
  const element = messageQueue.find((array) =>
    array.some((message) => message.id === id)
  );

  if (element) {
    const index = element.findIndex((message) => message.id === id);
    if (index !== -1) {
      element.splice(index, 1); // Remove the message at found index
      console.log(`Message with id: ${id} has been deleted from the queue.`);
    } else {
      console.log(`Message with id: ${id} not found in sub-array.`);
    }
  } else {
    console.log(`No sub-array found containing message with id: ${id}.`);
  }
}

async function sendResponse(ws, id, cmd, status) {
  const response = JSON.stringify({ id, cmd, status, clientCompanyId });
  ws.send(response);
  console.log("Response sent to server:", response);
}

function scheduleReconnect() {
  console.log(
    "---------------------------Trying to reconnecting  socket and whatsapp SETTIMEOUT - NO INTERNET "
  );
  setTimeout(() => {
    connectWebSocket();
  }, 1000 * 30);
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
setInterval(() => {
  try {
    if (!socketConnectionStatus) {
      console.log("Socket Connection lost. Reconnecting...");
      connectWebSocket();
    } else {
      console.log("Socket Connection is active.");
    }

    ws.send(clientCompanyId.toString());
  } catch (error) {}
}, 1000 * 60); // 1 minute
// Start WebSocket connection

try {
  connectWebSocket();
} catch (error) {}

// Monitor memory usage every second
setInterval(() => {
  const memoryUsage = process.memoryUsage();
  const heapUsedMB = (memoryUsage.heapUsed / (1024 * 1024)).toFixed(0); // Convert to MB
  fs.writeFileSync("memory.log", heapUsedMB); // Write memory usage to memory.log
}, 1000 * 10);
