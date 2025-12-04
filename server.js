const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const path = require('path');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const nodemailer = require('nodemailer');
const { body, validationResult } = require('express-validator');

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
// Session middleware (simple in-memory store)
// Use Mongo-backed session store
app.use(session({
  secret: process.env.SESSION_SECRET || 'change_this_secret_in_production',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: 'mongodb://127.0.0.1:27017/womenCareDB' }),
  cookie: { maxAge: 1000 * 60 * 60 * 24 }
}));

// EJS setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// MongoDB Connection
mongoose.connect("mongodb://127.0.0.1:27017/womenCareDB")
.then(async () => {
  console.log("✔ MongoDB Connected Successfully");
  try {
    await seedLabs();
  } catch (e) {
    console.log('❌ Seed error:', e);
  }
})
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

// Booking schema (persist bookings)
const bookingSchema = new mongoose.Schema({
  labId: String,
  name: String,
  phone: String,
  email: String,
  date: String,
  time: String,
  notes: String,
  createdAt: { type: Date, default: Date.now }
});
const Booking = mongoose.model('Booking', bookingSchema);

// Simple nodemailer transporter scaffold (uses env vars)
const mailerTransport = (() => {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (host && port && user && pass) {
    return nodemailer.createTransport({ host, port: Number(port), auth: { user, pass }, secure: false });
  }
  return null;
})();

async function sendBookingEmail(booking, lab) {
  if (!mailerTransport) return; // no SMTP configured
  const mailOpts = {
    from: process.env.SMTP_FROM || 'noreply@example.com',
    to: booking.email,
    subject: `Booking confirmation - ${lab.name}`,
    text: `Your booking for ${lab.name} on ${booking.date} at ${booking.time} is confirmed. Reference: ${booking._id}`
  };
  try { await mailerTransport.sendMail(mailOpts); } catch (e) { console.error('Email send failed:', e); }
}

// ------------------ ROUTES ------------------

// Homepage
app.get('/', (req, res) => {
  res.render('index');
});

// Static dataset: doctors (kept in-memory)
const doctors = [
  { id: 'doc1', name: 'Dr. A. Kumar', specialty: 'Obstetrician & Gynecologist', clinic: '', languages: ['English','Hindi'], phone: '+911234567890', email: 'akumar@example.com' },
  { id: 'doc2', name: 'Dr. S. Rao', specialty: 'Maternal-Fetal Medicine', clinic: '', languages: ['English'], phone: '+919876543210', email: 'srao@example.com' }
];

// Lab schema & model — labs will be stored in MongoDB
const labSchema = new mongoose.Schema({
  _id: String,
  name: String,
  address: String,
  location: String,
  phone: String,
  email: String,
  rating: Number,
  reviews: [String]
}, { _id: false });
const Lab = mongoose.model('Lab', labSchema);

// Seed labs into DB (upsert)
async function seedLabs() {
  const seed = [
    { _id: 'lab1', name: 'City Pathology Lab', address: 'Plot No. 12, Ameerpet Main Road, Hyderabad, Telangana 500016', location: 'Hyderabad', phone: null, email: null, rating: 5, reviews: [] },
    { _id: 'lab2', name: 'Warangal Diagnostic Center', address: '12 RTC X Roads, Hanamkonda, Warangal, Telangana 506001', location: 'Warangal', phone: '0870-8765432', email: null, rating: 4, reviews: [] },
    { _id: 'lab3', name: 'Nizam Lab Services', address: 'Dwarakapuri Colony, Nizamabad, Telangana 503001', location: 'Nizamabad', phone: '08462-234567', email: null, rating: 4, reviews: [] },
    { _id: 'lab4', name: 'Karimnagar Health Lab', address: 'Bharat Petrol Pump Rd, Karimnagar, Telangana 505001', location: 'Karimnagar', phone: '0878-3456789', email: null, rating: 4, reviews: [] },
    { _id: 'lab5', name: 'Khammam Diagnostics', address: 'Beside Bus Depot, Khammam, Telangana 507001', location: 'Khammam', phone: '08742-123456', email: null, rating: 4, reviews: [] }
  ];

  for (const item of seed) {
    await Lab.updateOne({ _id: item._id }, { $set: item }, { upsert: true });
  }
  console.log('✔ Labs seeded/updated in MongoDB');
}

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
  // Save user info in session for prefill and auth
  req.session.userId = user._id;
  req.session.userEmail = user.email;
  req.session.userName = user.name;
  res.redirect('/precautions');
});

// Logout
app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

// Precautions Page
app.get('/precautions', (req,res) => res.render('precautions', { name: req.session.userName || null }));

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

// Doctors Page
app.get('/doctor', async (req, res) => {
  const name = req.session.userName || req.query.name || null;
  try {
    const labsFromDb = await Lab.find().lean();
    res.render('bookslot', { doctors, labs: labsFromDb, name });
  } catch (e) {
    console.error('Error fetching labs:', e);
    res.status(500).send('Server error');
  }
});

// Show booking form for a given lab
app.get('/book-slot/:id', async (req, res) => {
  const id = req.params.id;
  try {
    const lab = await Lab.findById(id).lean();
    if (!lab) return res.status(404).send('Lab not found');

    // Determine user from session or query
    let user = null;
    if (req.session && req.session.userEmail) {
      try { user = await User.findOne({ email: req.session.userEmail }).lean(); } catch(e){ console.error(e); }
    } else if (req.query.userEmail) {
      try { user = await User.findOne({ email: req.query.userEmail }).lean(); } catch(e){ console.error(e); }
    }

    res.render('bookslot_form', { lab, user, errors: [], form: {} });
  } catch (e) {
    console.error('Error fetching lab by id:', e);
    res.status(500).send('Server error');
  }
});

// Handle booking form submit
app.post('/book-slot', async (req, res) => {
  // Apply server-side validation
},
);

// Re-define route with validation middleware
app.post('/book-slot',
  [
    body('labId').notEmpty().withMessage('Lab is required'),
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('phone').trim().optional({ checkFalsy: true }).isLength({ min: 7 }).withMessage('Phone looks too short'),
    body('email').trim().optional({ checkFalsy: true }).isEmail().withMessage('Email is invalid'),
    body('date').isISO8601().withMessage('Date is required'),
    body('time').notEmpty().withMessage('Time is required')
  ],
  async (req, res) => {
  const errors = validationResult(req);
  const form = req.body;
  if (!errors.isEmpty()) {
    // fetch lab and user again to re-render form with errors
    try {
      const lab = await Lab.findById(form.labId).lean();
      if (!lab) return res.status(404).send('Lab not found');
      let user = null;
      if (req.session && req.session.userEmail) user = await User.findOne({ email: req.session.userEmail }).lean();
      return res.render('bookslot_form', { lab, user, errors: errors.array(), form });
    } catch (e) {
      console.error('Validation render error:', e);
      return res.status(500).send('Server error');
    }
  }

  const booking = req.body; // { labId, name, phone, email, date, time, notes }
  try {
    const lab = await Lab.findById(booking.labId).lean();
    if (!lab) return res.status(404).send('Lab not found');

    // Persist booking to DB
    const newBooking = new Booking({
      labId: booking.labId,
      name: booking.name,
      phone: booking.phone,
      email: booking.email,
      date: booking.date,
      time: booking.time,
      notes: booking.notes
    });
    await newBooking.save();

    // Attempt to send confirmation email (non-blocking)
    if (newBooking.email) sendBookingEmail(newBooking.toObject(), lab).catch(e => console.error(e));

    res.render('bookslot_confirm', { lab, booking: newBooking.toObject() });
  } catch (e) {
    console.error('Error processing booking:', e);
    res.status(500).send('Server error');
  }
});

// Start server
app.listen(3000, () => console.log("🚀 Server running at http://localhost:3000"));

// Admin routes: list bookings (requires login)
function requireLogin(req, res, next) {
  if (req.session && req.session.userId) return next();
  return res.status(403).send('Login required');
}

app.get('/admin/bookings', requireLogin, async (req, res) => {
  try {
    const bookings = await Booking.find().sort({ createdAt: -1 }).lean();
    const labsFromDb = await Lab.find().lean();
    const labsMap = {};
    labsFromDb.forEach(l => labsMap[l._id] = l.name);
    res.render('admin_bookings', { bookings, labsMap });
  } catch (e) {
    console.error('Admin list error:', e);
    res.status(500).send('Server error');
  }
});

app.get('/admin/bookings/delete/:id', requireLogin, async (req, res) => {
  try {
    await Booking.deleteOne({ _id: req.params.id });
    res.redirect('/admin/bookings');
  } catch (e) {
    console.error('Admin delete error:', e);
    res.status(500).send('Server error');
  }
});
