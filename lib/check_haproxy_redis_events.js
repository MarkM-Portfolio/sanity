'use strict';

const util = require('util');
const redis = require('ioredis');
const dns = require('dns');
const moment = require('moment');
const logger = require('./logger');

const default_config = {
  host: '127.0.0.1',
  port: 30379,
};

function check_haproxy_redis_events(svc, callback, conn_env) {
  var result = { checker: 'haproxy-redis-events', passed: true, info: [], warnings: [], errors: [], metrics: {} };
  var masterConfig = {};
  var events = false;

  const keys = ['redis-node-service-name', 'redis-node-service-port', 'redis-node-enabled'];
  keys.forEach((key) => {
    let value = conn_env['key']
    logger.log('verbose', `[check_haproxy_redis_events] ${key} = ${value}`);
  });

  if (conn_env['redis-auth-enabled'] === 'true') {
    var fs = require('fs');
    masterConfig.password = fs.readFileSync('var/redis/secret', 'utf8').trim();
  }

  // Initial Redis client using environment variables
  masterConfig.host = conn_env['redis-node-service-name'] || default_config.host;
  masterConfig.port = conn_env['redis-node-service-port'] || default_config.port;

  var redis_client = redis.createClient(masterConfig);

  redis_client.on('error', function (err) {
    logger.log('error', '-------- haproxy-redis-events.error');
    result.errors.push(err);
    redis_client.quit();
    // assume an 'end' event will be send to us after error, let the end event
    // handler do the callback() instead of from here.
    //callback(result);
  });

  redis_client.on('connect', function () {
    result.info.push('Redis connect event received.');
  });

  redis_client.on('ready', function() {
    result.info.push('Redis ready event received.');

    redis_client.subscribe('connections.events', function (err, count) {
      logger.log('debug', 'Subscribing to connections.events');
      // Set a Timeout so that we don't break Sanity
      setTimeout(function () {
        redis_client.quit();
      }, 20000);
    });

    redis_client.on('message', function (channel, message) {
      if (channel === "connections.events") {
        logger.log('verbose',
          '[haroxy-redis]' + moment().format('LLLL') + 'Received message from channel : ' + channel);
        result.info.push("Received message from channel : " +  channel);
        result.passed = true;
        events = true;
        redis_client.quit();
      }
    });
  });

  redis_client.on('end', function() {
    logger.log('debug', '------- haproxy-redis-events.on_end');
    result.info.push('Redis client ends.');
    if (events == true) {
      result.metrics['HAProxy Redis Events Sanity'] = 1;
    } else {
      result.metrics['HAProxy Redis Events Sanity'] = 0;
    }
  callback(result);
  });
}

module.exports = check_haproxy_redis_events;
