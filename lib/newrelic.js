'use restrict'

const http = require('http');
const https = require('https');
const url = require('url');
const fs = require('fs');
const logger = require('./logger');

const NEW_RELIC_METRICS='https://platform-api.newrelic.com/platform/v1/metrics'

function get_metrics(service) {
  var metrics = {};
  //console.log(JSON.stringify(service, null, 2));
  if (! service.status) {
    logger.log('verbose', `[newrelic] status not available in '${service.name}'`)
    return metrics;
  }
  for (var i = 0; i < service.status.checks.length; i ++) {
    let m = service.status.checks[i].metrics;
    if (m) {
      for (const key of Object.keys(m)) {
        logger.log('debug', `[newrelic] metrics found: ${key} = ${m[key]}`);
        metrics['Component/' + service.name + '/' + key] = m[key];
      }
    }
  }
  return metrics;
}

function transform_for_newrelic(results) {
  var service = undefined;
  var nr_data = {
    agent: { host: 'icautomation.swg.usma.ibm.com', version: '1.0.1'},
    components: [
      {
        name: 'Connections Pink Service',
        guid: 'com.ibm.connections.pink.sanity',
        duration: 60,
        metrics: {}
      }
    ]
  };
  var comp;
  for (var i = 0; i < results.length; i++) {
    service = results[i];
    Object.assign(nr_data.components[0].metrics, get_metrics(service));
  }
  return nr_data;
}

function post_to_newrelic(license_key, data) {
  var options = url.parse(NEW_RELIC_METRICS);

  options.method = 'POST';
  options.headers = {
    'X-License-Key': license_key,
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }

  var req = https.request(options, function(response){
    var body = '';
    response.on('data', function(chunk){
      //console.log('DATA');
      body += chunk;
    });
    response.on('end', function(){
      var post_successful = false;
      //console.log('END');
      logger.log('debug', `[newrelic] recived from New Relic: ${body}`);
      try {
        post_successful = JSON.parse(body)['status'] == 'ok';
      } catch (e){
        post_successful = false;
        logger.log('error', `[newrelic] error parsing server return data: ${e}`);
      }
      console.log('verbose', `[newrelic] posted successful = ${post_successful}`);
    })
  });

  req.on('error', function(err){
    logger.log('error', `[newrelic] ERROR!! ${err}`);
  });

  var json_data = JSON.stringify(data, null, 2);
  logger.log('verbose', `[newrelic] sending: ${json_data}`);

  req.write(json_data);
  req.end();
}

function get_newrelic_license_key() {
  const key_file = 'var/newrelic/new-relic-license-key';
  var key = null;
  try {
    key = fs.readFileSync(key_file, 'utf8');
    logger.log('verbose', `[newrelic] loaded license from ${key_file}`);
    key = key.trim();
  } catch (e) {
    logger.log('error',
      `[newrelic] failed load license key from ${key_file} due to: ${e.toString()}`);
  }
  return key;
}

function newrelic(sanity_result) {
  var nr_data;
  var nr_licence_key = get_newrelic_license_key();
  if (! nr_licence_key) {
    logger.log('warn', '[newrelic] no NewRelic licence key, not able to push.');
    return;
  }
  nr_data = transform_for_newrelic(sanity_result);
  try {
    post_to_newrelic(nr_licence_key, nr_data);
  } catch (e) {
    logger.log('error', `[newrelic] error when post to NewRelic: ${e}`);
  }

}

module.exports = newrelic;
