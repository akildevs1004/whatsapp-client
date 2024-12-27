const WebSocket = require("ws");
const wbm = require("./src/index");
const fs = require("fs");
const path = require("path");
const { setTimeout } = require("timers/promises");

const sessions = {}; // Store session and queue per companyId

function initializeClient(companyId) {
  if (!sessions[companyId]) {
    sessions[companyId] = {
      ws: null,
      messageQueue: [],
      isProcessing: false,
      whatsappWindowActive: false,
    };
  }
}

function connectWebSocket(companyId) {
  initializeClient(companyId);
  const clientSession = sessions[companyId];

  clientSession.ws = new WebSocket("wss://139.59.69.241:7779", {
    rejectUnauthorized: false,
  });

  clientSession.ws.on("open", async () => {
    console.log(`Connected to WSS server for Company ID: ${companyId}`);
    clientSession.ws.send(companyId.toString());

    try {
      await wbm.start({
        showBrowser: true,
        session: true,
        sessionName: `akil_session_${companyId}`,
        companyId,
      });
      console.log(`WhatsApp session started for Company ID: ${companyId}`);
    } catch (error) {
      console.error(
        `Error starting WhatsApp session for Company ID ${companyId}:`,
        error
      );
    }
  });

  clientSession.ws.on("message", async (message) => {
    console.log(`Received message for Company ID ${companyId}: ${message}`);
    try {
      const parsedMessage = JSON.parse(message);
      const {
        whatsapp_number,
        message: whatsappMessage,
        id,
        company_id,
      } = parsedMessage;

      // if (parseInt(company_id) !== companyId) {
      //   console.log(`Message ignored. Expected Company ID: ${companyId}`);
      //   return;
      // }

      if (!isDuplicate(companyId, id)) {
        clientSession.messageQueue.push(parsedMessage);
        console.log(
          `Queued new message for Company ID ${companyId}, Message ID: ${id}`
        );
      }
      processQueue(companyId);
    } catch (error) {
      console.error(
        `Error processing message for Company ID ${companyId}:`,
        error
      );
    }
  });

  clientSession.ws.on("close", () => {
    console.log(`WebSocket closed for Company ID ${companyId}`);
    scheduleReconnect(companyId);
  });

  clientSession.ws.on("error", (err) => {
    console.error(`WebSocket error for Company ID ${companyId}:`, err);
    scheduleReconnect(companyId);
  });
}

function isDuplicate(companyId, id) {
  const clientSession = sessions[companyId];
  return clientSession.messageQueue.some((msg) => msg.id === id);
}

async function processQueue(companyId) {
  const clientSession = sessions[companyId];
  console.log(
    `processQueue clientSession.isProcessing ${clientSession.isProcessing}:`
  );
  //if (clientSession.isProcessing) return;

  clientSession.isProcessing = true;
  while (clientSession.messageQueue.length > 0) {
    const currentMessage = clientSession.messageQueue.shift();

    try {
      console.log(
        `Processing message for Company ID ${companyId}:`,
        currentMessage
      );
      await wbm.sendTo(
        currentMessage[0].whatsapp_number,
        currentMessage[0].message
      );
      await sendResponse(
        clientSession.ws,
        currentMessage[0].id,
        "sent",
        "completed"
      );
    } catch (error) {
      console.error(
        `Error processing message for Company ID ${companyId}:`,
        error
      );
    }
  }
  clientSession.isProcessing = false;
}

async function sendResponse(ws, id, cmd, status) {
  const response = JSON.stringify({ id, cmd, status });
  ws.send(response);
  console.log("Response sent to server:", response);
}

function scheduleReconnect(companyId) {
  setTimeout(() => connectWebSocket(companyId), 15000); // Retry connection after 15 seconds
}

// Start WebSocket connections for multiple clients
[13, 2].forEach((companyId) => connectWebSocket(companyId));
