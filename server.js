const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const path = require('path');

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));

// EJS setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// MongoDB Connection
mongoose.connect("mongodb://127.0.0.1:27017/womenCareDB")
.then(() => console.log("✔ MongoDB Connected Successfully"))
.catch(err => console.log("❌ DB Error: ", err));

// ------------------ Schemas ------------------

// User Schema
const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  password: String
});
const User = mongoose.model('User', userSchema);

// Personal Precautions Schema
const personalSchema = new mongoose.Schema({
  fullName: String,
  age: Number,
  weight: Number,
  height: Number,
  contact: String,
  emergencyContact: String,
  gestationalAge: Number,
  gravida: Number,
  para: Number,
  previousComplications: String,
  chronicConditions: String,
  allergies: String,
  medications: String,
  symptoms: Object, // {nausea: "", swelling:"", fatigue:"", ...}
  lifestyle: Object, // {diet:"", waterIntake:"", exercise:"", smoking:""}
  labResults: Object, // {hemoglobin:"", bp:"", sugar:"", urine:"", ultrasound:""}
  doctorUse: Object, // {risk:"", suggestions:"", nextAppointment:""}
  createdAt: { type: Date, default: Date.now }
});
const Personal = mongoose.model('Personal', personalSchema);

// ------------------ ROUTES ------------------

// Homepage
app.get('/', (req, res) => {
  res.render('index');
});

// Signup / Login Routes (as before)
app.get('/signup', (req,res) => res.render('signup', { message:'' }));
app.post('/signup', async (req,res) => {
  const {name,email,password,confirm_password} = req.body;
  if(password !== confirm_password) return res.render('signup',{message:"Passwords do not match"});
  const existingUser = await User.findOne({email});
  if(existingUser) return res.render('signup',{message:"Email already registered"});
  const hashedPassword = await bcrypt.hash(password,10);
  await new User({name,email,password:hashedPassword}).save();
  res.redirect('/login');
});
app.get('/login', (req,res) => res.render('login', { message:'' }));
app.post('/login', async (req,res) => {
  const {email,password} = req.body;
  const user = await User.findOne({email});
  if(!user) return res.render('login',{message:"Email not registered"});
  const isMatch = await bcrypt.compare(password,user.password);
  if(!isMatch) return res.render('login',{message:"Incorrect password"});
  res.render('precautions', { name: user.name });
});

// Precautions Page
app.get('/precautions', (req,res) => res.render('precautions'));

// Personal Precautions Form Page
app.get('/personalPrecautions', (req,res) => res.render('personalPrecautions'));

// Handle Personal Precautions Form Submit
app.post('/personalPrecautions', async (req,res) => {
  const personalData = req.body;

  // Save form data to MongoDB
  const personal = new Personal({
    fullName: personalData.fullName,
    age: personalData.age,
    weight: personalData.weight,
    height: personalData.height,
    contact: personalData.contact,
    emergencyContact: personalData.emergencyContact,
    gestationalAge: personalData.gestationalAge,
    gravida: personalData.gravida,
    para: personalData.para,
    previousComplications: personalData.previousComplications,
    chronicConditions: personalData.chronicConditions,
    allergies: personalData.allergies,
    medications: personalData.medications,
    symptoms: {
      nausea: personalData.nausea,
      swelling: personalData.swelling,
      fatigue: personalData.fatigue,
      cramps: personalData.cramps,
      breath: personalData.breath,
      fetalMovement: personalData.fetalMovement
    },
    lifestyle: {
      diet: personalData.diet,
      waterIntake: personalData.waterIntake,
      exercise: personalData.exercise,
      smoking: personalData.smoking
    },
    labResults: {
      hemoglobin: personalData.hemoglobin,
      bp: personalData.bp,
      sugar: personalData.sugar,
      urine: personalData.urine,
      ultrasound: personalData.ultrasound
    },
    doctorUse: {
      risk: personalData.risk,
      suggestions: personalData.suggestions,
      nextAppointment: personalData.nextAppointment
    }
  });

  await personal.save();

  // Redirect to suggestions page
  res.render('suggestions', { personal });
});

// Suggestions Page (show recommendations based on data)
app.get('/suggestions', async (req,res) => {
  // You can customize suggestions based on DB or input
  res.send("Suggestions page coming soon!");
});

// Start server
app.listen(3000, () => console.log("🚀 Server running at http://localhost:3000"));
