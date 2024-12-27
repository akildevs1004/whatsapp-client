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
let ws = new WebSocket("wss://139.59.69.241:7779", {
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
const clientCompanyId = 12; // Akil Security

setInterval(() => {
  console.log(
    `-------------------------------------setInterval Pending count : ${messageQueue.length}-------------------------------`
  );
  if (ws) sendMessage(ws);
}, 1000 * 15);

// setTimeout(() => {
//   sendMessage();
// }, 1000 * 10);
async function sendMessage(ws) {
  console.log(
    `************************Whatsapp Browser Initiaing  : ${isProcessing} ***************************`
  );
  if (isProcessing) {
    console.log("Whatsapp Message already processing... returning.");
    return;
  } // Exit if already processing
  isProcessing = true;

  console.log(`Whatsapp messageQueue Pending count : ${messageQueue.length}`);
  const currentMessage = messageQueue.shift(); // Get the next message in the queue
  console.log(`Whatsapp messageQueue Pending count : ${messageQueue.length}`);
  try {
    console.log(`Whatsapp Processing message: ${currentMessage}`);
    if (currentMessage) await processWhatsAppMessageBulk(ws, currentMessage);

    console.log("Whatsapp Message processed successfully.");

    //isProcessing = false; // Mark processing as done
    // setTimeout(() => {
    //   isProcessing = false;
    // }, 1000 * 5);
  } catch (error) {
    console.error("Whatsapp Error processing message:", error);
  }

  isProcessing = false;
}
function connectWebSocket() {
  ws = new WebSocket("wss://139.59.69.241:7779", {
    rejectUnauthorized: false,
  });
  ws.on("open", async () => {
    console.log(`Connected to WSS server with Company ID: ${clientCompanyId}`);
    ws.send(clientCompanyId.toString());

    await wbm.start({
      showBrowser: true,
      session: sessionActive,
      sessionName: "akil_session" + clientCompanyId.toString(),
      companyId: clientCompanyId,
    });
  });

  ws.on("message", async (message) => {
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
          //if (isProcessing == false) await sendMessage(ws);

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
      `--------------------------------------------------------------------------------------------------------------------------------------------------------Disconnected. Reconnecting in ${disconnectCounter} seconds...`
    );
    scheduleReconnect();
    //wbm.end();
  });

  ws.on("error", (err) => {
    console.error("WebSocket error:", err);
    scheduleReconnect();
    wbm.end();
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

  console.log(id);
  console.log("----------------");

  messageQueue.forEach((element) => {
    console.log(element[0]);
  });
  console.log("----------------");
  let obj = messageQueue.filter((message) => message.id == id);
  console.log(obj);
  console.log(
    `Duplicate Filter ${id} ${
      messageQueue.filter((message) => message.id === id).length
    } `
  );

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
  // let found = false;

  // messageQueue.forEach((element) => {
  //   element.forEach((message, index) => {
  //     if (message.id == id) {
  //       found = true;

  //       element.splice(index, 1); // Removes the element at the found index

  //       console.log(`Message with id: ${id} has been deleted from the queue.`);
  //     }
  //   });
  // });

  // const messageIndex = messageQueue.findIndex((message) => message.id === id);

  // if (messageIndex !== -1) {
  //   messageQueue.splice(messageIndex, 1); // Removes the element at the found index
  //   console.log(`Message with id: ${id} has been deleted from the queue.`);
  // } else {
  //   console.log(`Message with id: ${id} not found in the queue.`);
  // }
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
