const express = require("express");
require("dotenv").config;
const cors = require("cors");
const port = process.env.PORT || 5000;
const app = express();

// MIDDLEWARE
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Hello there Kabir doctor is lessening");
});

app.listen(port, () => {
  console.log(`application listening on port ${port}`);
});
