const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const express = require("express");
const app = express();
const cors = require("cors");
const stripe = require("stripe")(process.env.PAYMENT_SECRET_KEY);
const port = process.env.PORT || 5000;

//middleware
app.use(cors());
app.use(express.json());

//verify Jwt
const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  //check if authorization avaiable
  if (!authorization) {
    return res.status(401).send({
      error: true,
      message:
        "This is Optimus Prime .you are under Arrest for  unauthorized access",
    });
  }
  const token = authorization.split(" ")[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET_KEY, (error, decoded) => {
    //check if token is vailded or expiery date
    if (error) {
      return res
        .status(403)
        .send({ error: true, message: "unauthorized access no valid token" });
    }
    //decode means that decode it and get the information and add the infomation to the (req) method
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
    const paymentCollection = client
      .db("Fusion-Fable-Feast-DB")
      .collection("payment");
    const reviewCollection = client
      .db("Fusion-Fable-Feast-DB")
      .collection("CustomerReviews");

    //----------------------verifyAdmin middleware ---------------------

    //! warrning : use VerifyJwt before using verifyAdmin
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      if (user?.role !== "admin") {
        return res
          .status(403)
          .send("You are not admin to access this infomation");
      }
      next();
    };

    //------------------JWT realated api---------------------

    //create Access Token
    app.post("/jwt", async (req, res) => {
      const userInfo = req.body;
      const token = jwt.sign(userInfo, process.env.ACCESS_TOKEN_SECRET_KEY, {
        expiresIn: "1h",
      });
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

    //insert menu items
    app.post("/menus", verifyJWT, verifyAdmin, async (req, res) => {
      const newItem = req.body;
      const result = await menuCollection.insertOne(newItem);
      res.send(result);
    });

    //Delete a item from menu
    app.delete("/menus/:id", verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await menuCollection.deleteOne(query);
      res.send(result);
    });

    //------------------User collections realated api---------------------

    /* for Admin security :
       0)Do not show secure links to those who should not see the links
       1) use Jwt token : verifytoken 
       2) create verifyAdmin middleware inside the mongodb connection to check if admin or not 
       3) 
    */

    //Read user
    app.get("/users", verifyJWT, verifyAdmin, async (req, res) => {
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

    //!check the user is admin or not
    app.get("/users/admin/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      if (req.decoded.email !== email) {
        res.send({ admin: false });
      }
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const result = { admin: user?.role === "admin" };
      res.send(result);
    });

    // app.get("/users/admin/:email", verifyJWT, async (req, res) => {
    //   const email = req.params.email;
    //   if (req.decoded.email !== email) {
    //     res.send({ admin: false });
    //   }
    //   const query = { email: email };
    //   const user = await userCollection.findOne(query);
    //   const result = { admin: user?.role === "admin" };
    //   res.send(result);
    // });

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
      const decodedEmail = req.decoded.email;
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

    //-------------------Payment--------------------------

    //Read payment or booking for admin
    app.get("/bookings", verifyJWT, verifyAdmin, async (req, res) => {
      const bookings = await paymentCollection.find().toArray();
      res.send(bookings);
    });

    //Read payment or booking for user
    app.get("/paymentHistory/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const bookings = await paymentCollection.find(query).toArray();
      console.log(bookings);
      res.send(bookings);
    });

    //create payment intent
    app.post("/create-payment-intent", verifyJWT, async (req, res) => {
      const { price } = req.body;
      const amount = price * 100;
      // Create a PaymentIntent with the order amount and currency
      //? Imagine you're running an online store, and people are buying products from your website. You want to make sure that when someone pays, the money is taken securely, and the payment is successful. This is where PaymentIntents
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({
        clientSecret: paymentIntent.client_secret, //?clientSecret is a unique and temporary authorization token generated by Stripe on the server.to confirm and complete the payment on the client-side, you need to provide Stripe with this clientSecret. Stripe uses this token to verify that the client (the customer's web browser or app) has the authorization to finalize the payment.
      });
    });

    //insert payment info
    app.post("/payments", verifyJWT, async (req, res) => {
      const paymentInfo = req.body;
      const query = {
        _id: { $in: paymentInfo.cartItemsId.map((id) => new ObjectId(id)) },
      };
      const insertedResult = await paymentCollection.insertOne(paymentInfo);
      const deletedResult = await cartCollection.deleteMany(query);
      res.send({ insertedResult, deletedResult });
    });

    // Update booking Status
    app.patch("/booking/:id", verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await paymentCollection.updateOne(query, {
        $set: { status: "Done" },
      });
      res.send(result);
    });

    //--------------------Admin Api-----------------

    app.get("/admin-stats", verifyJWT, verifyAdmin, async (req, res) => {
      const users = await userCollection.estimatedDocumentCount();
      const products = await menuCollection.estimatedDocumentCount();
      const orders = await paymentCollection.estimatedDocumentCount(); //when people complete he payement then this should be count as order
      //This is for Total Revenue sum
      const revenues = await paymentCollection
        .aggregate([
          {
            $group: {
              _id: null,
              totalPrice: {
                $sum: "$amount",
              },
            },
          },
        ])
        .toArray();
      res.send({
        userCount: users,
        productCount: products,
        orderCount: orders,
        revenues,
      });
    });

    app.get("/order-stats", verifyJWT, verifyAdmin, async (req, res) => {
      const pipeline = [
        {
          $unwind: "$orderProducts",
        },
        {
          $addFields: {
            productIdObj: { $toObjectId: "$orderProducts.productId" },
          },
        },
        {
          $lookup: {
            from: "menu", // Name of the "menu" collection
            localField: "productIdObj",
            foreignField: "_id",
            as: "menuItems",
          },
        },
        {
          $unwind: "$menuItems",
        },
        {
          $group: {
            _id: "$menuItems.category",
            count: { $sum: 1 },
            totalPrice: { $sum: "$menuItems.price" },
          },
        },
        {
          $project: {
            category: "$_id",
            count: 1,
            totalPrice: { $round: ["$totalPrice", 2] },
            _id: 0,
          },
        },
      ];

      const result = await paymentCollection.aggregate(pipeline).toArray();
      res.send(result);
    });

    //-----------------Review Api------------------------

    app.post("/review", verifyJWT, async (req, res) => {
      const review = req.body;
      const result = await reviewCollection.insertOne(review);
      res.send(result);
    });

    //---------------------------------------------------

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("You successfully connected to MongoDB!");
  } finally {
  }
}
run().catch(console.dir);

app.get("/", (req, res) => res.send("Hello Fusion Fable Feast!"));
app.listen(port, () => console.log(`Example app listening on port ${port}!`));

//   {
//     $unwind: "$orderProducts",
//   },
//   {
//     $lookup: {
//       from: "menu", // Name of the "menu" collection
//       localField: "orderProducts.productId",
//       foreignField: "_id",
//       as: "menuItems",
//     },
//   },
//   {
//     $unwind: "$menuItems",
//   },
//   {
//     $group: {
//       _id: "$menuItems.category",
//       itemCount: { $sum: 1 },
//       totalPrice: {
//         $sum: {
//           $multiply: [
//             "$orderProducts.productQuantity",
//             "$menuItems.price",
//           ],
//         },
//       },
//     },
//   },
// ];

// const result = await paymentCollection.aggregate(pipeline).toArray();

//>>>------------------------------------------------------------------------------<<<//

// try {
//   const pipeline = [
//     {
//       $unwind: "$orderProducts",
//     },
//     {
//       $addFields: {
//         productIdObj: { $toObjectId: "$orderProducts.productId" },
//       },
//     },
//     {
//       $lookup: {
//         from: "menu", // Name of the "menu" collection
//         localField: "productIdObj",
//         foreignField: "_id",
//         as: "menuItems",
//       },
//     },
//     {
//       $unwind: "$menuItems",
//     },
//     {
//       $group: {
//         _id: "$menuItems.category",
//         itemCount: { $sum: 1 },
//         totalPrice: {
//           $sum: {
//             $multiply: [
//               "$orderProducts.productQuantity",
//               "$menuItems.price",
//             ],
//           },
//         },
//       },
//     },
//   ];

//   const result = await paymentCollection.aggregate(pipeline).toArray();

//   res.send(result);
// } catch (err) {
//   console.error("Error executing aggregation:", err);
//   res.status(500).json({ error: "Internal server error" });
// }
