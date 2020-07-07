require("dotenv").config();
const express = require("express");
const session = require("express-session");
const { json } = require("body-parser");
const cors = require("cors");
const massive = require("massive");
const passport = require("passport");
const Auth0Strategy = require("passport-auth0");
const app = express();

app.use(express.static(`${__dirname}/../build`))

const userCtrl = require("./controllers/userController");
const postCtrl = require("./controllers/postController");

app.use(json());
app.use(cors());

const {
  SESSION_SECRET,
  CONNECTION_STRING,
  DOMAIN,
  CLIENT_ID,
  CLIENT_SECRET
} = process.env;
console.log(CONNECTION_STRING)
massive({
  connectionString: CONNECTION_STRING,
  ssl: {
    rejectUnauthorized: false,
  },
}).then(db => {
    app.set("db", db);
    console.log('db up and runnin')
  })
  .catch(err => console.log(err));

app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24
    }
  })
);



app.use(passport.initialize());
app.use(passport.session());

passport.use(
  new Auth0Strategy(
    {
      domain: DOMAIN,
      clientID: CLIENT_ID,
      clientSecret: CLIENT_SECRET,
      callbackURL: "/auth",
      scope: "openid email profile"
    },
    (accessToken, refreshToken, extraParams, profile, done) => {
      return done(null, profile);
    }
  )
);

passport.serializeUser((user, done) => {
  app
    .get("db")
    .getUserByAuthId(user.id)
    .then(response => {
      if (!response[0]) {
        app
          .get("db")
          .addUserByAuthId([
            user.displayName,
            user.id,
            user.picture,
            user.emails[0].value
          ])
          .then(res => {
            return done(null, res[0]);
          })
          .catch(err => console.log(err));
      } else {
        return done(null, response[0]);
      }
    })
    .catch(err => console.log(err));
});

passport.deserializeUser((obj, done) => {
  return done(null, obj);
});

app.get(
  "/auth",
  passport.authenticate("auth0", {
    successRedirect: "http://localhost:3000",
    failureRedirect: "http://localhost:3001/auth"
  })
);

function authenticate(req, res, next) {
  if (!req.user) {
    next();
  } else {
    res.status(401).json({ message: "Unauthorized" });
  }
}

app.get("/api/logout", userCtrl.logout);
app.get("/api/user", userCtrl.getUser);
app.get("/api/getUsers", userCtrl.getUsers);
app.get("/api/getPosts", postCtrl.getPosts);
app.get("/api/getEmployersPosts", postCtrl.getEmployersPosts);
app.get("/api/getAllUsers/:id", userCtrl.getAllUsers);
app.get("/api/getUserPosts/:id", postCtrl.getUserPosts);
app.get("/api/getConnectionCount/:id", userCtrl.getUserConnections);
app.get("/api/getNotifications/:id", userCtrl.getNotifications);
app.post("/api/connectWithUser/:id", userCtrl.connectWithUser);
app.post("/api/newPost", postCtrl.newPost);
app.put("/api/updateUserInfo/:id", userCtrl.updateUserInfo);
app.put("/api/sendNotification/:id", userCtrl.sendNotification);
app.delete("/api/deletePost/:id", postCtrl.deletePost);

const path = require("path")
app.get("*", (req, res, next) => {
  res.sendFile(path.join(__dirname, "/../build/index.html"))
})

const port = 3001;
let server = app.listen(port, () => console.log(`Listening on port ${port}!`));

//WEB SOCKETS

const socket = require("socket.io");
io = socket(server);

io.on("connection", socket => {
  console.log(socket.id);

  socket.on("SEND_MESSAGE", data => {
    io.emit("RECIEVE_MESSAGE", data);
  });
});

//NODEMAILER
