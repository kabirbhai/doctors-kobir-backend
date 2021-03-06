const express = require("express");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const jwt = require("jsonwebtoken");
const cors = require("cors");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
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
    const doctorCollection = client.db("Doctors-kobir").collection("Doctors");
    const paymentCollection = client.db("Doctors-kobir").collection("Payments");

    // Check admin function
    const verifyAdmin = async (req, res, next) => {
      const requester = req.decoded.email;
      const requesterAccount = await userCollection.findOne({
        email: requester,
      });
      if (requesterAccount.role === "admin") {
        next();
      } else {
        return res.status(403).send({ message: "forbidden access" });
      }
    };

    // PAYMENT STRIPE API
    app.post("/create-payment-intent", verifyJWT, async (req, res) => {
      const { price } = req.body;
      const amount = price * 100;
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    // LOAD ALL USER
    app.get("/user", verifyJWT, async (req, res) => {
      const users = await userCollection.find().toArray();
      res.send(users);
    });

    // admin api
    app.get("/admin/:email", async (req, res) => {
      const email = req.params.email;
      const user = await userCollection.findOne({ email: email });
      const isAdmin = user.role === "admin";
      res.send({ admin: isAdmin });
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

    app.put("/user/admin/:email", verifyJWT, verifyAdmin, async (req, res) => {
      const email = req.params.email;
      const filter = { email: email };
      const updateDoc = {
        $set: { role: "admin" },
      };
      const result = await userCollection.updateOne(filter, updateDoc);
      return res.send(result);
    });

    // LOAD ALL SERVICE
    app.get("/service", async (req, res) => {
      const services = await serviceCollection
        .find({})
        .project({ name: 1 })
        .toArray();

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

    app.patch("/booking/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const payment = req.body;
      const filter = { _id: ObjectId(id) };
      const updatedDoc = {
        $set: {
          paid: true,
          transactionId: payment.transactionId,
        },
      };
      const result = await paymentCollection.insertOne(payment);
      const updatedbooking = await bookingCollection.updateOne(
        filter,
        updatedDoc
      );
      res.send(updatedDoc);
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

    // DOCTORS API
    app.get("/doctor", verifyJWT, verifyAdmin, async (req, res) => {
      const doctors = await doctorCollection.find().toArray();
      res.send(doctors);
    });

    app.post("/doctor", verifyJWT, verifyAdmin, async (req, res) => {
      const doctor = req.body;
      const result = await doctorCollection.insertOne(doctor);
      res.send(result);
    });

    app.delete("/doctor/:email", verifyJWT, verifyAdmin, async (req, res) => {
      const email = req.params.email;
      const filter = { email: email };
      const result = await doctorCollection.deleteOne(filter);
      res.send(result);
    });

    // payment

    app.get("/booking/:paymentId", verifyJWT, async (req, res) => {
      const paymentId = req.params.paymentId;
      const filter = { _id: ObjectId(paymentId) };
      const result = await bookingCollection.findOne(filter);
      res.send(result);
    });
  } finally {
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Doctors kabir is here");
});

app.listen(port, () => {
  console.log(`application listening on port ${port}`);
});
