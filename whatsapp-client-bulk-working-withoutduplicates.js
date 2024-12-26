const WebSocket = require("ws");
const wbm = require("./src/index");
const rimraf = require("rimraf");
const path = require("path");
const fs = require("fs");
const { setTimeout } = require("timers/promises");
// Create a writable stream for logging
const logFileName = `log_${getFormattedDate("file")}.log`;
const logStream = fs.createWriteStream(logFileName, { flags: "a" });
let messageQueue = []; // Queue to store incoming messages
let isProcessing = false; // Flag to indicate if a message is being processed
const ws = new WebSocket("wss://139.59.69.241:7779", {
  rejectUnauthorized: false,
});
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
const clientCompanyId = 2; // Akil Security

// setInterval(() => {
//   sendMessage();
// }, 1000 * 60);

// setTimeout(() => {
//   sendMessage();
// }, 1000 * 10);
async function sendMessage(ws) {
  if (isProcessing) {
    console.log("Message processing... returning.");
    return;
  } // Exit if already processing
  isProcessing = true;

  console.log(`messageQueue Pending count : ${messageQueue.length}`);
  const currentMessage = messageQueue.shift(); // Get the next message in the queue
  console.log(`messageQueue Pending count : ${messageQueue.length}`);
  try {
    console.log(`Processing message: ${currentMessage}`);
    await processWhatsAppMessageBulk(ws, currentMessage);
    console.log("Message processed successfully.");

    // isProcessing = false; // Mark processing as done
  } catch (error) {
    console.error("Error processing message:", error);
  }
}
function connectWebSocket() {
  ws.on("open", async () => {
    console.log(`Connected to WSS server with Company ID: ${clientCompanyId}`);
    ws.send(clientCompanyId.toString());

    await wbm.start({
      showBrowser: true,
      session: sessionActive,
      sessionName: "akil_session" + clientCompanyId.toString(),
    });
  });

  ws.on("message", async (message) => {
    ////////console.log(`Received from server: ${message}`);

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
        ///////////console.log(`Storing  new message at: ${getFormattedDate()}`);
        // await processWhatsAppMessage(
        //   ws,
        //   whatsapp_number,
        //   whatsappMessage,
        //   id
        // );
        // console.log(`Message in Queue : ${JSON.parse(message)}`);

        if (JSON.parse(message).length > 0) {
          console.log(JSON.parse(message));
          console.log(JSON.parse(message)[0].id);
          console.log(!isDuplicate(JSON.parse(message)[0].id));

          // if (!isDuplicate(JSON.parse(message)[0].id))
          messageQueue.push(JSON.parse(message));

          console.log(`Storing  new message at: ${messageQueue.length}`);

          //////////console.log(messageQueue.length);
          //////await processWhatsAppMessageBulk(ws, JSON.parse(message));
          console.log(`Start isProcessing: ${isProcessing}`);
          if (isProcessing == false) await sendMessage(ws);

          console.log(`End isProcessing: ${isProcessing}`);
        }
      } else {
        console.log(
          `Company ID mismatch. Expected: ${clientCompanyId}, Received: ${company_id}`
        );
      }
      // } else {
      //   console.log(
      //     `Message already in queue: cmd=${cmd}, whatsappWindowActive=${whatsappWindowActive}`
      //   );
      // }
    } catch (error) {
      console.error("Error parsing JSON or processing message:", error);
    }
  });

  ws.on("close", () => {
    const memoryUsage = process.memoryUsage();

    // Convert heapUsed from bytes to MB (1 MB = 1024 * 1024 bytes)
    const heapUsedInMB = memoryUsage.heapUsed / (1024 * 1024);

    console.log(`Heap Used: ${heapUsedInMB.toFixed(2)} MB`);

    // Check if memory usage exceeds 1 MB
    //if (heapUsedInMB > 10) {
    //console.log("Memory usage exceeded 10 MB. Closing application...");

    //global.gc();

    console.log(`Heap Used: ${heapUsedInMB.toFixed(2)} MB`);
    // process.exit(1); // Exit the application with an error code (1)
    //}
    console.log(
      `Disconnected. Reconnecting in ${disconnectCounter} seconds...`
    );
    scheduleReconnect();
    wbm.end();
  });

  ws.on("error", (err) => {
    console.error("WebSocket error:", err);
    scheduleReconnect();
    wbm.end();
  });
}
function isDuplicate(id) {
  return messageQueue.some((message) => message.id === id);
}
async function processWhatsAppMessageBulk(ws, messages) {
  console.log(
    "-------------------------------processWhatsAppMessageBulk Messages ---------------------------- "
  );

  whatsappWindowActive = true;
  console.log(messages);

  // await wbm.start({
  //   showBrowser: true,
  //   session: sessionActive,
  //   sessionName: "akil_session",
  // });

  (async () => {
    for (contact of messages) {
      try {
        console.log(contact.whatsapp_number);

        if (contact.whatsapp_number.length == 12) {
          console.log(`Start -----------${getFormattedDate()}`);
          console.log(`whatsapp_number: ${contact.whatsapp_number}`);
          console.log(`message:${contact.message}`);

          console.log(`Start -------------------- ${getFormattedDate()}`);
          //await setTimeout(1000 * 60); // 10 seconds
          await wbm.sendTo(contact.whatsapp_number, contact.message);
          deleteMessageById(contact.id);
          //await setTimeout(1000 * 60); // 10 seconds
          await sendResponse(ws, contact.id, "sent", "completed");
          deleteMessageById(contact.id);
          console.log(`Deleted ${contact.id}`);
          console.log(`End-------------------- ${getFormattedDate()}`);

          console.log(
            `Message processed successfully at: ${getFormattedDate()}`
          );

          isProcessing = true; // Mark processing as done
        }
      } catch (err) {
        console.error("Error during WhatsApp message sending:", err);
      }
    } //for

    isProcessing = false; // Mark processing as done
  })();

  // //////await wbm.send([phone], message);
  // const wpResponse = await wbm.end();

  whatsappWindowActive = false;
}
function deleteMessageById(id) {
  const messageIndex = messageQueue.findIndex((message) => message.id === id);

  if (messageIndex !== -1) {
    messageQueue.splice(messageIndex, 1); // Removes the element at the found index
    console.log(`Message with id: ${id} has been deleted from the queue.`);
  } else {
    console.log(`Message with id: ${id} not found in the queue.`);
  }
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

async function sendResponse(ws, id, cmd, status) {
  const response = JSON.stringify({ id, cmd, status, clientCompanyId });
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
