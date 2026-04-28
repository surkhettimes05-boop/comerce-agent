const dotenv = require("dotenv");

dotenv.config();

const app = require("./app");

const PORT = Number.parseInt(process.env.PORT || "5000", 10);
const HOST = process.env.HOST || "0.0.0.0";

app.listen(PORT, HOST, () => {
  console.log(`Backend listening on ${HOST}:${PORT}`);
});
