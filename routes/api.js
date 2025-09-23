var express = require('express');
var router = express.Router();

var checkup = require('../lib/checkup');

/* GET home page. */
router.get('/', function(req, res, next) {
  res.json(checkup.results());
});

module.exports = router;
