const express = require("express");
const { MongoClient, ServerApiVersion } = require("mongodb");
require("dotenv").config();
const cors = require("cors");
const port = process.env.PORT || 5000;
const app = express();

// MIDDLEWARE
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.nddtz.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

async function run() {
  try {
    await client.connect();
    const serviceCollection = client.db("Doctors-kobir").collection("Services");
    const bookingCollection = client.db("Doctors-kobir").collection("Booking");

    // LOAD ALL SERVICE
    app.get("/service", async (req, res) => {
      const services = await serviceCollection.find({}).toArray();
      res.send(services);
    });

    // BOOKING SERVICE
    app.post("/booking", async (req, res) => {
      const booking = req.body;
      const filter = {
        treatment: booking.treatment,
        date: booking.date,
        patent: booking.patent,
      };
      const exists = await bookingCollection.findOne(filter);
      if (exists) {
        return res.send({ success: false, booking: exists });
      }
      const result = await bookingCollection.insertOne(booking);
      return res.send({ success: true, result });
    });
  } finally {
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("hello world");
});

app.listen(port, () => {
  console.log(`application listening on port ${port}`);
});
