const express = require('express')
const app = express()
const cors = require('cors')
const mongoose = require("mongoose")
const bodyParser = require("body-parser")

require('dotenv').config()



app.use(cors())
app.use(express.static('public'))
app.use(bodyParser.urlencoded({ extended: false }))


// mongo stuff here
mongoose.connect(process.env.MONGO_URI);

const userSchema = mongoose.Schema({
  username: String,
}, {
  toJSON: {
    transform: function (doc, ret) {
      delete ret.__v
    }
  }
})

const exerciseSchema = mongoose.Schema({
  user_id: String,
  description: String,
  duration: Number,
  date: Date,
});

const User = mongoose.model("user", userSchema);
const Exercise = mongoose.model("exercise", exerciseSchema);


async function addExercise({ _id, description, duration, date }) {
  const user = await User.findById(_id, { username: 1, _id: 1 }).exec()
  if (!user) { return { error: "Invalid id", id: _id } }
  const userObject = user.toObject();
  date = date ? new Date(date) : new Date();
  duration = Number(duration);
  const exercise = new Exercise({
    user_id: userObject._id,
    description,
    duration,
    date
  })
  try {
    await exercise.save()
  }
  catch {
    console.error("Error while saving the exercise");
    return;
  }
  if (!description || !duration) {
    return { error: "empty required felid" + (!description ? " description" : "") + (!duration ? " duration" : "") }
  }
  return { ...userObject, ...{ description, duration, date: date.toDateString() } };
}

async function addUser(username) {
  // usernames are not unique
  let user = new User({ username });
  try {
    await user.save()
    return user
  }
  catch {
    console.error("Error while saving new user");
  }
}

async function getLog({ user_id, from, to, limit }) {

  const user = await User.findById(user_id, { username: 1, _id: 1, }).exec()
  if (!user) { return { error: "Invalid id" } }
  const userObject = user.toObject();

  const filter = { user_id }
  if (from || to) {
    filter.date = {}
    if (from)
      filter.date.$gte = new Date(from)
    if (to)
      filter.date.$lte = new Date(to)
  }
  const query = Exercise.find(filter, { description: 1, duration: 1, date: 1, _id: 0 });
  if (limit) {
    query.limit(Number(limit))
  }

  let exercises = await query.exec();
  userObject.count = exercises.length
  userObject.log = exercises
    .map(doc => doc.toObject())
    .map((obj) => { obj.date = obj.date.toDateString(); return obj })
  return userObject
}

// logger
app.use("/", (req, res, next) => {
  console.log(`${req.method} ${req.path}\n ├───from: ${req.ip} ${req.hostname}\n └───body:`, req.body);
  next();
})


app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
});

// add new user
app.post("/api/users", async function (req, res) {
  let user = await addUser(req.body.username);
  res.json(user);
})

// show all users
app.get("/api/users", async (req, res) => {
  let users = await User.find({}).exec();
  res.json(users);
})

// add new exercises
app.post("/api/users/:_id/exercises", async function (req, res) {
  const response = await addExercise({ _id: req.params._id, ...req.body });
  res.json(response);
})


// show user log
app.get("/api/users/:_id/logs?", async function (req, res) {
  let log = await getLog({ user_id: req.params._id, ...req.query });
  res.json(log);
})


const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})
