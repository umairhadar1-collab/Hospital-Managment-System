// Only logged-in users can open protected pages.
function requireLogin(req, res, next) {
  if (!req.session.user) return res.redirect('/login');
  next();
}

// Only users with one of the given roles can open the page.
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.session.user || !roles.includes(req.session.user.role)) {
      return res.status(403).send('You do not have permission to do this.');
    }
    next();
  };
}

// Simple CSRF protection: one random token per session, checked on every POST.
const crypto = require('crypto');

function csrfToken(req, res, next) {
  if (!req.session.csrf) req.session.csrf = crypto.randomBytes(24).toString('hex');
  res.locals.csrf = req.session.csrf;
  next();
}

function csrfCheck(req, res, next) {
  if (req.method === 'POST' && req.body._csrf !== req.session.csrf) {
    return res.status(403).send('Invalid form token. Please go back, refresh the page and try again.');
  }
  next();
}

module.exports = { requireLogin, requireRole, csrfToken, csrfCheck };
