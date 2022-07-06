const express = require("express");
const { MongoClient, ServerApiVersion } = require("mongodb");
require("dotenv").config;
const cors = require("cors");
const port = process.env.PORT || 5000;
const app = express();

// MIDDLEWARE
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.nddtz.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});
client.connect((err) => {
  const collection = client.db("test").collection("devices");
  console.log("connected");
  // perform actions on the collection object
  client.close();
});

app.get("/", (req, res) => {
  res.send("Hello there Kabir doctor is lessening");
});

app.listen(port, () => {
  console.log(`application listening on port ${port}`);
});
