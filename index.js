const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const express = require("express");
const app = express();
const cors = require("cors");
const port = process.env.PORT || 5000;

//middleware
app.use(cors());
app.use(express.json());

const verifyJWT = (req, res, next) => {
  const Authorization = req.headers.Authorization;
  console.log(Authorization);
  if (!Authorization) {
    return res
      .status(401)
      .send({ error: true, message: "you have no token to access" });
  }
  const token = Authorization.split(" ")[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET_KEY, (err, decoded) => {
    if (err) {
      // console.log("i inside the token is validate condition");
      return res
        .status(403)
        .send({ error: true, message: "you token is not validate" });
    }
    req.decoded = decoded;
    next();
  });
};

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.bkwjkpk.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const menuCollection = client
      .db("Fusion-Fable-Feast-DB")
      .collection("menu");
    const userCollection = client
      .db("Fusion-Fable-Feast-DB")
      .collection("user");
    const cartCollection = client
      .db("Fusion-Fable-Feast-DB")
      .collection("cart");

    //------------------JWT realated api---------------------

    //create Access Token
    app.post("/jwt", async (req, res) => {
      const userInfo = req.body;
      const token = jwt.sign(userInfo, process.env.ACCESS_TOKEN_SECRET_KEY, {
        expiresIn:  60 * 60});
      res.send({ token });
    });

    //------------------Menu collections realated api---------------------

    //read menu items
    app.get("/menus", async (req, res) => {
      const query = {};
      const options = {
        // Sort returned documents in ascending order by title (A->Z)
        sort: { name: 1 },
      };
      const result = await menuCollection.find(query, options).toArray();
      res.send(result);
    });

    //------------------User collections realated api---------------------

    //Read user
    app.get("/users", async (req, res) => {
      const users = await userCollection.find().toArray();
      res.send(users);
    });

    //insert user
    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "User is already exist" });
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    //update user
    app.patch("/users/admin/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          role: "admin",
        },
      };
      const result = await userCollection.updateOne(query, updatedDoc);
      res.send(result);
    });

    //Delete users
    app.delete("/users/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await userCollection.deleteOne(query);
      res.send(result);
    });

    //-------------------Cart Collection realated api---------------------------

    //read cart item
    app.get("/carts", verifyJWT, async (req, res) => {
      const decodedEmail = req.decoded.userInfo.email;
      const email = req.query.email;
      if (email !== decodedEmail) {
        return res.status(403).send("porvidden access");
      }
      let query = {};
      if (email) {
        query = { customarEmail: email };
      }
      const cartItem = await cartCollection.find(query).toArray();
      res.send(cartItem);
    });

    //insert cart item
    app.post("/carts", async (req, res) => {
      const item = req.body;
      const result = await cartCollection.insertOne(item);
      res.send(result);
    });

    //update Quantity
    app.patch("/carts/:id", async (req, res) => {
      const id = req.params.id;
      const quantity = req.body.Quantity;
      const query = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          foodQuantity: quantity,
        },
      };
      const result = await cartCollection.updateOne(query, updateDoc);
      res.send(result);
    });

    //Delete cart item
    app.delete("/carts/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await cartCollection.deleteOne(query);
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("You successfully connected to MongoDB!");
  } finally {
  }
}
run().catch(console.dir);

app.get("/", (req, res) => res.send("Hello Fusion Fable Feast!"));
app.listen(port, () => console.log(`Example app listening on port ${port}!`));
