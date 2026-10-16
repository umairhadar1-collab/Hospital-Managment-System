require('dotenv').config();
const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const mongoose = require('mongoose');
const path = require('path');
const { csrfToken, csrfCheck } = require('./middleware/auth');

const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/hms';
const SESSION_SECRET = process.env.SESSION_SECRET;

if (!SESSION_SECRET) {
  console.error('Missing SESSION_SECRET. Copy .env.example to .env and set a long random value.');
  process.exit(1);
}

const app = express();
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: MONGO_URI }),
  cookie: { httpOnly: true, sameSite: 'lax', maxAge: 1000 * 60 * 60 * 8 } // 8 hours
}));

app.use(csrfToken);
app.use(csrfCheck);
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  next();
});

app.use('/', require('./routes/auth'));
app.use('/patients', require('./routes/patients'));
app.use('/lab', require('./routes/lab'));

app.get('/', (req, res) => {
  res.redirect(req.session.user ? '/patients/new' : '/login');
});

app.use((req, res) => res.status(404).send('Page not found'));

mongoose.connect(MONGO_URI)
  .then(() => {
    app.listen(PORT, () => console.log(`HMS running at http://localhost:${PORT}`));
  })
  .catch(err => {
    console.error('Could not connect to MongoDB:', err.message);
    process.exit(1);
  });
