'use strict';

const logger = require('./logger');

const MongoClient = require('mongodb').MongoClient;
const fs = require('fs');
const mongo_secret_vol = 'var/mongo/';
const x509_enabled_file = mongo_secret_vol + 'mongo-x509-auth-enabled';
const client_pem_file = '/home/ibm/ca/user_sanity.pem';
const db_name='admin';
const user_name = 'C=IE,ST=Ireland,L=Dublin,O=IBM,OU=Connections-Middleware-Clients,CN=sanity,emailAddress=sanity@mongodb'

function isMongoX509Enabled(config) {
  return config['mongo-x509-auth-enabled'].toLowerCase().trim() == 'true'
}

function requiresX509() {
  var required = false;
  try {
    var text = fs.readFileSync(x509_enabled_file, 'utf8');
    logger.log('verbose', `[check_mongo] loaded file:, ${x509_enabled_file} -> ${text}`);
    required = text.toLowerCase().trim() == 'true';
  } catch (e) {
    logger.log('error', "[check_mongo] " + e.toString());
  }
  return required;
}

function mongo_url(svc, config, x509_enabled) {
  let rs_hosts = config['mongo-rs-members-hosts'],
      rs_name = config['mongo-rs-members-name'],
      user = encodeURIComponent(user_name),
      queries = [],
      auth = '',
      query_string = '';
  if (rs_name) {
    queries.push(`replicaSet=${rs_name}`)
  }
  if (x509_enabled) {
    auth=`${user}@`
    queries.push('authMechanism=MONGODB-X509');
    queries.push('ssl=true');
  }
  if (queries.length > 0) {
    query_string = "?" + queries.join('&');
  }
  return `mongodb://${auth}${rs_hosts}/${db_name}${query_string}`;
};

async function do_check_mongo(url, options) {
  let result, client, retry;
  result = {checker: 'mongo', passed: false,
            info: [], warnings: [], errors: []};
  let msg = `mongourl = '${url}'`;
  logger.log('debug', `[check_mongo] ${msg}`);
  result.info.push(msg)
  retry = true
  while (retry) {
    retry = false
    try {
      logger.log('debug', `[check_mongo] Connecting to mongo: ${url}`);
      client = await MongoClient.connect(url, options);
      logger.log('debug', `[check_mongo] Connected to mongo: ${url}`);
      result.info.push(`Connected to mongo: ${url}`)
      const db = client.db(db_name);
      const adminDb = db.admin();
      let rsStatus = await adminDb.command({replSetGetStatus: {}});
      result.info.push('RS numb. of Members: ' + rsStatus.members.length);
      logger.log('verbose', `[check_mongo] RS numb. of Members: ${rsStatus.members.length}`);
      result.info.push('RS general state: ' + (rsStatus.myState == 1 ? 'ok' : 'nOk'));
      logger.log('verbose', `[check_mongo] RS general state: ${rsStatus.myState == 1 ? 'ok' : 'nOk'}`);
      rsStatus.members.forEach(function (member) {
        if (member.health != 1) {
          result.errors.push('RS Member NOT healthy: ' + member.name + 'state: ' + member.stateStr);
          logger.log('verbose', `[check_mongo] RS Member NOT healthy: ${member.name} state: ${member.stateStr}`);
        } else {
          result.info.push('RS Member healthy: ' + member.name + 'state: ' + member.stateStr);
          logger.log('verbose', `[check_mongo] RS Member healthy: ${member.name} state: ${member.stateStr}`);
        }
      });
      result.passed = result.errors.length == 0;
    } catch (err) {
      if (err.message.includes("self signed certificate") && ! options.tlsAllowInvalidCertificates ) {
        result.warnings.push(`failed connect to mongo: ${err}`)
        logger.log('debug', 'retry due to Self-Signed certificate related error found:', err);
        logger.log('debug', err.stack);
        options.tlsAllowInvalidCertificates = true
        retry = true
      } else {
        result.errors.push(`failed connect to mongo: ${err}`)
        logger.log('debug', err.stack);
      }
    }
  }
  logger.log('verbose', '[check_mongo] closing mongo client');
  return result;
}

async function check_mongo(svc, callback, config) {
  var x509_enabled = requiresX509(),
      options = { useNewUrlParser: true },
      url = mongo_url(svc, config, x509_enabled),
      msg;
  if (x509_enabled) {
    try {
      options.sslKey = fs.readFileSync(client_pem_file);
      options.sslCert = fs.readFileSync(client_pem_file);
    } catch (err) {
      logger.log('error', `[check_mongo] ERROR: Failed load Mongo X509 auth keys: ${err}`);
    }
  }
  let result = await do_check_mongo(url, options);
  callback(result);
};

module.exports = check_mongo;
