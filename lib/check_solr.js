'use restrict'

const http = require('http');
const https = require('https');
const fs = require('fs');
const util = require('util');
const logger = require('./logger');

function check_solr(svc, callback, config) {
  var http_client = http,
    options = {
      agent: false, // use one time agent to TLS cert checked every time.
      host: svc.host || svc.name,
      port: svc.port || 8983,
      path: '/solr/admin/collections?action=CLUSTERSTATUS&collection=orient-me-collection&wt=json'
    };
  var result = { passed: false, info: [], warnings: [], errors: []};
  if (config['solr-ssl-enabled'] != 'false') {
    http_client = https;
    options.port = svc.port || 8984;
    options.key = fs.readFileSync('var/solr/ca-keyAndCert.pem');
    options.cert = fs.readFileSync('var/solr/ca-keyAndCert.pem');
    options.ca = [fs.readFileSync('var/solr/ca-keyAndCert.pem')];
    options.passphrase = String(fs.readFileSync('var/solr/store_password'));
    options.checkServerIdentity = function(servername, cert) {
      if (servername != cert.subject.CN) {
        result.warnings.push(
          util.format("Server name (%s) does not match Certificate name (%s)",
            servername, cert.subject.CN));
      }
      return undefined;
    };
  }

  logger.log('verbose', `[check_solr] Making Solr Cluster State Call to (${options.host}:${options.port})...`);

  solr_http_req = http_client.request(options, function(response) {
    var json_str = '';
    response.on('data', function(chunk){
      json_str += chunk;
    });
    response.on('end', function() {
      logger.log('verbose', "[solr] Got Response from Solr Cluster State: " + json_str);
      result.solr_response = json_str;
      try {
        var solr_response = JSON.parse(json_str);
        if (solr_response.responseHeader.status != 0) {
          var err = new Error(json_str);
          throw err;
        }

        var shards = solr_response.cluster.collections["orient-me-collection"].shards;

        Object.values(shards).forEach(function(shard){
          Object.values(shard.replicas).forEach(function(core_node){
            if(core_node.state !== "active"){
              var err = new Error(core_node.state);
              throw err;
            }
          });          
        });

        result.passed = true;
      } catch (err) {
        result.errors.push(util.format("ERROR: %s", err));
        result.passed = false;
      }
      callback(result);
    });
  })

  solr_http_req.on('error', function(err){
    result.errors.push(util.format("http requeset error: %s", err));
    result.passed = false;
    callback(result);
  });

  solr_http_req.end();
}

module.exports = check_solr;