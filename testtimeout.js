const { setTimeout } = require("timers/promises");

(async () => {
  for (let i = 1; i <= 10; i++) {
    console.log(`Start ${getFormattedDate()}`);

    await setTimeout(1000 * 60); // 10 seconds

    console.log(`End ${getFormattedDate()}`);
  }
})();

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
