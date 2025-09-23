'use strict';

const util = require('util');
const elasticsearch = require('elasticsearch');
const fs = require('fs');

const logger = require('./logger');

function check_es(svc, callback) {
  logger.log('verbose', `check_es('${svc.name}')`);
  var result = { checker: 'elasticsearch', passed: false, info: [], warnings: [], errors: [] };
  var host = svc.host || svc.name,
      port = svc.port || 9200;

  var ssl_options = {};
  try {
    ssl_options.cert = fs.readFileSync('var/elasticsearch/elasticsearch-healthcheck.crt.pem');
    ssl_options.key = fs.readFileSync('var/elasticsearch/elasticsearch-healthcheck.des3.key');
    ssl_options.ca = fs.readFileSync('var/elasticsearch/elasticsearch-http.crt.pem');
  } catch (err) {
    result.warnings.push(util.format("Failed to read cert files make sure cert folder exists", err));
  }

  ssl_options.rejectUnauthorized = true;

  var client = new elasticsearch.Client({
    host: {
      protocol: 'https',
      host: host,
      port: port
    },
    ssl: ssl_options
  });

  client.ping({
    requestTimeout: 30000,
  }, function (err) {
    if (err) {
      result.warnings.push(err);
    } else {
      result.info.push(util.format('Ping elasticsearch successful at %s', server));
      result.passed = true;
    }
    result.passed = true;
    callback(result);
  });
}

module.exports = check_es;
