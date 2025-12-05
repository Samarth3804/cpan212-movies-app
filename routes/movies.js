const express = require('express');
const router = express.Router();
const Movie = require('../models/Movie');
const User = require('../models/User');

// Make userId available on ALL pages
router.use((req, res, next) => {
  res.locals.userId = req.session.userId || null;
  next();
});

// Login required middleware
const isLoggedIn = (req, res, next) => {
  if (!req.session.userId) {
    req.flash('error_msg', 'Please log in first');
    return res.redirect('/login');
  }
  next();
};

// Owner check middleware
const isOwner = async (req, res, next) => {
  try {
    const movie = await Movie.findById(req.params.id);
    if (!movie || movie.createdBy.toString() !== req.session.userId) {
      req.flash('error_msg', 'You can only edit your own movies');
      return res.redirect('/');
    }
    next();
  } catch {
    res.redirect('/');
  }
};

// HOME
router.get('/', async (req, res) => {
  const movies = await Movie.find().sort({ createdAt: -1 });
  res.render('index', { movies });
});

// REGISTER
router.get('/register', (req, res) => {
  res.render('register', { errors: [], username: '' });
});

router.post('/register', async (req, res) => {
  const { username, password, password2 } = req.body;
  let errors = [];

  if (!username || !password || !password2) errors.push('All fields are required');
  if (password !== password2) errors.push('Passwords do not match');
  if (password.length < 6) errors.push('Password must be 6+ characters');

  if (errors.length > 0) {
    return res.render('register', { errors, username });
  }

  if (await User.findOne({ username })) {
    errors.push('Username already taken');
    return res.render('register', { errors, username });
  }

  await new User({ username, password }).save();
  req.flash('success_msg', 'Registered! You can now log in');
  res.redirect('/login');
});

// LOGIN
router.get('/login', (req, res) => res.render('login'));

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username });
  if (user && await user.comparePassword(password)) {
    req.session.userId = user._id;
    req.flash('success_msg', 'Welcome back!');
    res.redirect('/');
  } else {
    req.flash('error_msg', 'Wrong username or password');
    res.redirect('/login');
  }
});

router.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

// ADD MOVIE — FIXED: always send all variables
router.get('/add', isLoggedIn, (req, res) => {
  res.render('add-movie', {
    errors: [],
    name: '', description: '', year: '', genres: '', rating: '', poster: ''
  });
});

router.post('/add', isLoggedIn, async (req, res) => {
  const { name, description, year, genres, rating, poster } = req.body;
  let errors = [];

  if (!name || !description || !year || !genres || !rating) {
    errors.push('Please fill all required fields');
  }

  if (errors.length > 0) {
    return res.render('add-movie', {
      errors,
      name, description, year, genres, rating, poster: poster || ''
    });
  }

  await new Movie({
    name, description,
    year: Number(year),
    genres,
    rating: Number(rating),
    poster: poster || '',
    createdBy: req.session.userId
  }).save();

  req.flash('success_msg', 'Movie added successfully!');
  res.redirect('/');
});

// MOVIE DETAIL
router.get('/movie/:id', async (req, res) => {
  const movie = await Movie.findById(req.params.id);
  if (!movie) return res.redirect('/');
  res.render('movie-detail', { movie });
});

// EDIT — FIXED: always send variables
router.get('/edit/:id', isLoggedIn, isOwner, async (req, res) => {
  const movie = await Movie.findById(req.params.id);
  res.render('edit-movie', { movie, errors: [] });
});

router.post('/edit/:id', isLoggedIn, isOwner, async (req, res) => {
  await Movie.findByIdAndUpdate(req.params.id, {
    name: req.body.name,
    description: req.body.description,
    year: Number(req.body.year),
    genres: req.body.genres,
    rating: Number(req.body.rating),
    poster: req.body.poster || ''
  });
  req.flash('success_msg', 'Movie updated!');
  res.redirect('/');
});

// DELETE
router.post('/delete/:id', isLoggedIn, isOwner, async (req, res) => {
  await Movie.findByIdAndDelete(req.params.id);
  req.flash('success_msg', 'Movie deleted');
  res.redirect('/');
});

module.exports = router;