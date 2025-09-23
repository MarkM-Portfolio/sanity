var express = require('express');
var router = express.Router();

var checkup = require('../lib/checkup');

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Sanity', checkup: checkup });
});

module.exports = router;
