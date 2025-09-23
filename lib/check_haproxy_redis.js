'use strict';

const util = require('util');
const redis = require('ioredis');
const dns = require('dns');

const logger = require('./logger');

const default_config = {
  host: '127.0.0.1',
  port: 30379,
};

function check_haproxy_redis(svc, callback, conn_env) {
  var result = { checker: 'haproxy-redis', passed: false, info: [], warnings: [], errors: [], metrics: {} };
  var name = svc.host || svc.name;
  var masterConfig = {};

  const keys = ['redis-node-service-name', 'redis-node-service-port', 'redis-node-enabled'];
  keys.forEach((key) => {
    let value = conn_env['key']
    logger.log('verbose', `[check_haproxy_redis ${key} = ${value}`);
  });
  if (conn_env['redis-auth-enabled'] === 'true') {
    var fs = require('fs');
    masterConfig.password = fs.readFileSync('var/redis/secret', 'utf8').trim();
  }

  // Initial Redis client using environment variables
  masterConfig.host = conn_env['redis-node-service-name'] || default_config.host;
  masterConfig.port = conn_env['redis-node-service-port'] || default_config.port;

  // Do not attempt to make a redis client if we cannot resolve haproxy-redis
  dns.lookup(name, function(err, address, family) {
    if (err) {
      result.address = err.code;
      result.errors.push(err);
      callback(result);
    } else {

      var redis_client = redis.createClient(masterConfig);

      redis_client.on('error', function (err) {
        logger.log('error', '-------- haproxy-redis.error');
        result.passed = false;
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

        // set a key
        redis_client.set('foo', 'bar', function(err) {
          if (err) {
            var responseMsg = "Failed Connecting to Redis via HAProxy after trying to set: " + err.message;
            logger.log('error', responseMsg);
            result.passed = false;
            result.errors.push(err);
            redis_client.quit();
          }
          result.info.push('Redis set key event received.');
        });

        // get a key
        redis_client.get('foo', function(err) {
          if (err) {
            var responseMsg = "Failed Connecting to Redis via HAProxy after trying to retrieve with get: " + err.message;
            logger.log('error', responseMsg);
            result.passed = false;
            result.errors.push(err);
            redis_client.quit();
          }
          result.info.push('Redis get key event received.');
        });

        result.passed = true;
        redis_client.quit();
      });

      redis_client.on('end', function() {
        logger.log('verbose', '------- haproxy-redis.on_end');
        result.info.push('Redis client ends.');
        if (result.passed == true) {
          result.metrics['HAProxy Redis Sanity'] = 1;
        } else {
          result.metrics['HAProxy Redis Sanity'] = 0;
        }
        callback(result);
      });
    }
  });
}

module.exports = check_haproxy_redis;
