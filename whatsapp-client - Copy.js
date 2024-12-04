const WebSocket = require("ws");
const wbm = require("./src/index");

const rimraf = require("rimraf");
const path = require("path");

let sessionActive = false;
let wahtsappWindowActive = false;
let disconnectCounter = 60;
const client_company_id = 2;
function connectWebSocket() {
  const ws = new WebSocket("wss://139.59.69.241:7777", {
    rejectUnauthorized: false, // Disable certificate validation (for development purposes)
  });

  ws.on("open", () => {
    //disconnectCounter = 10;
    console.log("Connected to WSS server");
    ws.send("Hello Server!");
  });

  ws.on("message", (message) => {
    console.log("Received from server:", message);

    let jsonData = JSON.parse(message);
    const whatsapp_number = jsonData.whatsapp_number;
    const whatsapp_message = jsonData.message;
    const id = jsonData.id;
    const cmd = jsonData.cmd;
    const company_id = jsonData.company_id;

    if (
      cmd == "new-message" &&
      !wahtsappWindowActive &&
      company_id == client_company_id
    ) {
      (async () => {
        try {
          console.log(
            "Whatsapp Message Sending Process Started.........................."
          );
          console.log("sessionActive", sessionActive);
          let data1 = null;
          data1 = await wbm.start({
            showBrowser: true,
            session: sessionActive,
          });
          console.log(data1);
          if (data1) {
            const phones = [whatsapp_number];
            const msg = whatsapp_message; // + "\n\n\n" + new Date().toLocaleString();
            await wbm.send(phones, msg);
            await wbm.end();

            const data = {
              id: id,
              cmd: "sent",
              status: "browser-closed",
            };

            await ws.send(JSON.stringify(data));
            wahtsappWindowActive = false;
          }
        } catch (err) {
          sessionActive = true;
          console.error("Error with WhatsApp automation:", err);
          wahtsappWindowActive = false;
        }
      })();
    }
  });

  ws.on("close", () => {
    console.log(
      "Disconnected from WSS server...try after " +
        disconnectCounter +
        " Seconds"
    );
    // Retry the connection after 5 seconds
    setTimeout(connectWebSocket, 1000 * disconnectCounter);
    //disconnectCounter = disconnectCounter + 10;
  });

  // Handle WebSocket errors, including ECONNREFUSED
  ws.on("error", (err) => {
    if (err.code === "ECONNREFUSED") {
      console.error(
        "Connection refused. Retrying...try after " +
          disconnectCounter +
          " Seconds"
      );
      // Retry the connection after 5 seconds
      //disconnectCounter = disconnectCounter + 10;

      setTimeout(connectWebSocket, 1000 * disconnectCounter);
    } else {
      console.error("WebSocket error:", err);
    }
  });
}

// Start WebSocket connection
connectWebSocket();

// Function to get the dynamic file path from the current directory
function getDynamicFilePath(filename) {
  return path.join(__dirname, "wbm", "tmp", filename); // Adjust the subfolders as necessary
}

// Retry logic for deleting the file
function deleteFileWithRetry(filePath, retries = 3) {
  let attempt = 0;

  function tryDelete() {
    attempt++;
    rimraf(filePath, (err) => {
      if (err) {
        if (attempt < retries) {
          console.log(`Retrying to delete the file... Attempt ${attempt}`);
          setTimeout(tryDelete, 1000); // Retry after 1 second
        } else {
          console.error(
            "Failed to delete the file after multiple attempts:",
            err
          );
        }
      } else {
        console.log("File deleted successfully");
      }
    });
  }

  tryDelete();
}
