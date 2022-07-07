const express = require("express");
const { MongoClient, ServerApiVersion } = require("mongodb");
require("dotenv").config();
const jwt = require("jsonwebtoken");
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

function verifyJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).send({ message: "unAuthorize access" });
  }
  const token = authHeader.split(" ")[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
    if (err) {
      return res.status(403).send({ message: "forbidden access" });
    }
    req.decoded = decoded;
    next();
  });
}

async function run() {
  try {
    await client.connect();
    const serviceCollection = client.db("Doctors-kobir").collection("Services");
    const bookingCollection = client.db("Doctors-kobir").collection("Booking");
    const userCollection = client.db("Doctors-kobir").collection("Users");

    // LOAD ALL USER
    app.get("/user", async (req, res) => {
      const users = await userCollection.find().toArray();
      res.send(users);
    });

    // USER COLLECTION API
    app.put("/user/:email", async (req, res) => {
      const email = req.params.email;
      const user = req.body;
      const filter = { email: email };
      const options = { upsert: true };
      const updateDoc = {
        $set: user,
      };
      const result = await userCollection.updateOne(filter, updateDoc, options);
      const token = jwt.sign(
        { email: email },
        process.env.ACCESS_TOKEN_SECRET,
        { expiresIn: "1h" }
      );
      res.send({ result, token });
    });

    // LOAD ALL SERVICE
    app.get("/service", async (req, res) => {
      const services = await serviceCollection.find({}).toArray();
      res.send(services);
    });

    // BOOKING SERVICE
    app.get("/booking", verifyJWT, async (req, res) => {
      const patient = req.query.patient;
      const decodedEmail = req.decoded.email;
      if (patient === decodedEmail) {
        const query = { patient: patient };
        const result = await bookingCollection.find(query).toArray();
        return res.send(result);
      } else {
        return res.status(403).send({ message: "forbidden access" });
      }
    });

    app.post("/booking", async (req, res) => {
      const booking = req.body;
      const filter = {
        treatment: booking.treatment,
        date: booking.date,
        patient: booking.patient,
      };
      const exists = await bookingCollection.findOne(filter);
      if (exists) {
        return res.send({ success: false, booking: exists });
      }
      const result = await bookingCollection.insertOne(booking);
      return res.send({ success: true, result });
    });
    // -------------------------
    // warning !!
    // ======================
    // This is not the proper way to query after learning more mongoDB you have to lookup aggregation pipeline
    // AVAILABLE
    app.get("/available", async (req, res) => {
      const date = req.query.date;
      // step 1 get all data
      const services = await serviceCollection.find().toArray();

      //step 2 get the booking of the day
      const filter = { date: date };
      const bookings = await bookingCollection.find(filter).toArray();

      // step 3 for each service
      services.forEach((service) => {
        // step 4 find booking for that service
        const serviceBooking = bookings.filter(
          (book) => book.treatment === service.name
        );
        //step 5 select slots for the service booking
        const bookedSlots = serviceBooking.map((book) => book.slot);
        //step 6 select those slot that are not include in BookedSlots
        const available = service.slots.filter(
          (slot) => !bookedSlots.includes(slot)
        );
        service.slots = available;
      });
      res.send(services);
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
