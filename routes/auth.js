const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

const router = express.Router();

router.get('/login', (req, res) => {
  if (req.session.user) return res.redirect('/patients/new');
  res.render('login', { title: 'Login', error: null, username: '' });
});

router.post('/login', async (req, res) => {
  const username = (req.body.username || '').trim().toLowerCase();
  const password = req.body.password || '';
  const fail = () =>
    res.status(401).render('login', { title: 'Login', error: 'Wrong username or password.', username });

  try {
    const user = await User.findOne({ username });
    if (!user) return fail();
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return fail();

    // New session id after login (protects against session fixation).
    const csrf = req.session.csrf;
    req.session.regenerate(err => {
      if (err) return res.status(500).send('Login error');
      req.session.csrf = csrf;
      req.session.user = { id: user._id.toString(), username: user.username, fullName: user.fullName, role: user.role };
      res.redirect('/patients/new');
    });
  } catch (e) {
    console.error(e);
    res.status(500).send('Server error');
  }
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

module.exports = router;
