const fs = require("fs");
const https = require("https");
const WebSocket = require("ws");
const { Pool } = require("pg");
require("dotenv").config();
// Read SSL certificate and key
const serverOptions = {
  key: fs.readFileSync("/etc/letsencrypt/live/mytime2cloud.com/privkey.pem"),
  cert: fs.readFileSync("/etc/letsencrypt/live/mytime2cloud.com/cert.pem"),
};

// Create an HTTPS server
const server = https.createServer(serverOptions);

// WebSocket server
const wss = new WebSocket.Server({ server });

// Object to store clients with unique IDs
const clients = {};

// Assign a unique ID to each client
let clientId = 0;

// PostgreSQL connection pool
const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USERNAME || "user",
  port: process.env.DB_PORT || 5432,
  password: process.env.DB_PASSWORD || "password",
  database: process.env.DB_DATABASE || "database",
  max: 100,
  idleTimeoutMillis: 30000,
});

pool.on("error", (err) => {
  console.error("Unexpected error on idle client", err);
  process.exit(-1);
});

// Handle WebSocket connections
wss.on("connection", async (ws) => {
  // Assign and store the client

  callClientService(ws);

  setInterval(async () => {
    console.log("Checking Pending in Queue");
    await callClientService(ws);
  }, 1000 * 60);

  // Listen for client messages
  ws.on("message", (message) => {
    message = message.toString("utf-8");

    console.log(`Received from  :`, message);

    let id = message;

    if (!isNaN(message)) {
      clients["client_" + message] = ws;
      console.log("Number", message);
    } else {
    }
    if (clients["client_" + message])
      console.log(
        `client readyState:`,
        clients["client_" + message].readyState
      );

    console.log(`--------------New client connected: ${message}`);
    console.log(`Received from ${id}:`, message);
    // console.log("Received message From Client :", message.toString("utf-8"));

    if (isValidJson(message)) {
      try {
        console.log(
          "---------------RESPONSE FROM Client-----------------------"
        );
        let jsonData = JSON.parse(message);

        const id = jsonData.id;
        const cmd = jsonData.cmd;
        console.log("--------------------------------------", cmd);
        if (cmd === "sent") {
          setTimeout(() => {
            try {
              //update Table Log status id
              updateMessageStatusTable(id);
            } catch (error) {
              console.error("Error sending message on reconnect:", error);
            }
          }, 5000);
        }
      } catch (e) {
        console.error("Invalid JSON Format:", e);
      }
    } else {
      console.error("Invalid JSON Format:");
    }
  });

  // Handle connection close
  ws.on("close", () => {
    try {
      console.log(`Client disconnected: ${id}`);
      delete clients["client_" + id];
    } catch (e) {}
  });
});
function isNumber(value) {
  return typeof value === "number" && isFinite(value);
}
function isValidJson(jsonString) {
  try {
    JSON.parse(jsonString); // Try to parse the string
    return true; // If no error is thrown, it's valid JSON
  } catch (error) {
    return false; // If an error is thrown, it's invalid JSON
  }
}

const jsonString = '{"name":"John","age":30,"city":"New York"}';
const result = isValidJson(jsonString);

console.log(result); // true if valid JSON, false otherwise

async function updateMessageStatusTable(id) {
  try {
    const query = `
  UPDATE whatsapp_notifications_logs 
  SET sent_status = TRUE, status_datetime = $1 
  WHERE id = $2
`;

    const result = await pool.query(query, [getFormattedDate(), id]);
  } catch (e) {
    console.error("Database Update Error", e);
  }
}
async function callClientService(ws) {
  try {
    console.log(`Fetching Database Data`);

    const query = `
    SELECT whatsapp_number, message, id, company_id 
    FROM whatsapp_notifications_logs 
    WHERE sent_status = false AND retry_count <= 10 AND company_id = $1 
    ORDER BY retry_count ASC, created_at DESC 
    LIMIT 10
  `;

    for (const clientKey in clients) {
      if (clients.hasOwnProperty(clientKey)) {
        const clientId = clientKey.split("_")[1]; // Extract client ID from key (e.g., 'client_13' -> 13)

        if (clients[clientKey]?.readyState === WebSocket.OPEN) {
          try {
            const { rows: notifications } = await pool.query(query, [clientId]);

            if (notifications.length > 0) {
              clients[clientKey].send(JSON.stringify(notifications));
              console.log(`Message sent to active client ${clientId}`);
            } else {
              console.log(`No messages to send for client ${clientId}`);
            }
          } catch (error) {
            console.error(
              `Failed to fetch or send messages to ${clientId}:`,
              error
            );
          }
        } else {
          console.log(`Client ${clientId} is not connected or ready.`);
        }
      }
    }

    return false;
    const result = await pool.query(query);
    console.log(`Pending Messages count: ` + result.rows.length);
    for (const row of result.rows) {
      if (row.whatsapp_number.length > 10) {
        const data = {
          whatsapp_number: row.whatsapp_number,
          message: row.message,
          id: row.id,
          company_id: row.company_id,
          cmd: "new-message",
        };

        try {
          // const responseFromClient = await ws.send(JSON.stringify(data)); // Send data to client
          let messageReply = await sendToClient(row.company_id, data, row.id);

          console.log("messageReply", messageReply);
          if (messageReply) {
            console.log(
              `Sent to client System - WhatsApp Number: ${row.id} ${
                row.whatsapp_number
              } at ${getFormattedDate()} `
            );
          } else {
            console.log("Client is not active");
          }
        } catch (error) {
          console.error("Error sending data to client:", error);
        }
      } else {
        console.warn(
          `Invalid WhatsApp Number: ${row.whatsapp_number}, Message: ${row.message}`
        );
      }

      // try {
      //   const query = `
      //   UPDATE whatsapp_notifications_logs
      //   SET retry_count = retry_count + 1
      //   WHERE id = $1
      // `;

      //   const result = await pool.query(query, [row.id]);
      // } catch (e) {
      //   console.error("Database Update Error", e);
      // }
    }
  } catch (error) {
    console.error("Error fetching users:", error);
  }
}
async function sendToClientBulk(clientId, data, id) {
  console.log("clients", clients.length);
  if (
    clients["client_" + clientId] &&
    clients["client_" + clientId].readyState === WebSocket.OPEN
  ) {
    try {
      clients["client_" + clientId].send(JSON.stringify(data));
      console.log(`Message sent to Active CLient  ${clientId}`);

      return true;
    } catch (error) {
      console.error(`Failed to send message to ${clientId}:`, error);
    }
  } else {
    console.log(`Client Company Id ${clientId} is not connected.`);

    try {
      const query = `
      UPDATE whatsapp_notifications_logs
      SET retry_count = retry_count + 1
      WHERE id = $1
    `;

      const result = await pool.query(query, [id]);
    } catch (e) {
      console.error("Database Update Error", e);
    }
  }

  return false;
}
async function sendToClient(clientId, data, id) {
  console.log("clients", clients.length);
  if (
    clients["client_" + clientId] &&
    clients["client_" + clientId].readyState === WebSocket.OPEN
  ) {
    try {
      clients["client_" + clientId].send(JSON.stringify(data));
      console.log(`Message sent to Active CLient  ${clientId}`);

      return true;
    } catch (error) {
      console.error(`Failed to send message to ${clientId}:`, error);
    }
  } else {
    console.log(`Client Company Id ${clientId} is not connected.`);

    try {
      const query = `
      UPDATE whatsapp_notifications_logs
      SET retry_count = retry_count + 1
      WHERE id = $1
    `;

      const result = await pool.query(query, [id]);
    } catch (e) {
      console.error("Database Update Error", e);
    }
  }

  return false;
}
function getFormattedDate() {
  const now = new Date();

  // Format the date to 'Asia/Dubai' time zone
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Dubai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(now).reduce((acc, part) => {
    acc[part.type] = part.value;
    return acc;
  }, {});

  // Format the date as 'YYYY-MM-DD HH:MM:SS'
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
}
// Start the server
server.listen(7779, () => {
  console.log("WSS server listening on port 7779");
});
