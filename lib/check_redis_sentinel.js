'use strict';

const util = require('util');
const redis = require('ioredis');
const dns = require('dns');
const moment = require('moment');
const logger = require('./logger');

const config = {
  host: '127.0.0.1',
  port: 26379,
};

function check_redis_sentinel(svc, callback, conn_env) {
  var result = { checker: 'redis-sentinel', passed: false, info: [], warnings: [], errors: [], metrics: {} };
  var name = svc.host || svc.name;

  var masterConfig = {};

  const keys = [
    'redis-sentinel-node-service-name',
    'redis-sentinel-node-service-port',
    'redis-auth-enabled' ];
  keys.forEach((key) => {
    let value = conn_env['key']
    logger.log('verbose', `[check_haproxy_redis_events] ${key} = ${value}`);
  });

  if (conn_env['redis-auth-enabled'] === 'true') {
    var fs = require('fs');
    config.password = fs.readFileSync('var/redis/secret', 'utf8').trim();
  }

  // Initial Redis client using environment variables
  config.host = conn_env['redis-sentinel-node-service-name'] || config.host;
  config.port = conn_env['redis-sentinel-node-service-port'] || config.port;

  const sentinels = 'sentinels';
  masterConfig[sentinels] = [];
  masterConfig[sentinels].push(config);
  masterConfig.name = 'mymaster';
  if (config.password) {
    masterConfig.password = config.password;
  }

  // Do not attempt to make a redis client if we cannot resolve redis-sentinel
  dns.lookup(name, function(err, address, family) {
    if (err) {
      result.address = err.code;
      result.errors.push(err);
      callback(result);
    } else {

      var redis_client = redis.createClient(masterConfig);

      redis_client.on('error', function (err) {
        logger.log('error', '[redis-sentinel] -------- redis-sentinel.error');
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
            responseMsg = "Failed Connecting to Redis via Redis Sentinel after trying to set: " + err.message;
            logger.log('error', `[redis-sentinel] ${responseMsg}`);
            result.passed = false;
            result.errors.push(err);
            redis_client.quit();
          }
          result.info.push('Redis set key event received.');
        });

        // get a key
        redis_client.get('foo', function(err) {
          if (err) {
            responseMsg = "Failed Connecting to Redis via Redis Sentinel after trying to retrieve with get: " + err.message;
            logger.log('error', `[redis-sentinel] ${responseMsg}`);
            result.passed = false;
            result.errors.push(err);
            redis_client.quit();
          }
          result.info.push('Redis get key event received.');
        });

        var subs = [ 'connections.events.analysis',
          'connections.events.relationship',
          'connections.events.profile',
          'connections.events.itm',
          'connections.events.indexing',
          'connections.events.view.analysis'];
        subs.forEach(function(queue){

          // get length of queue
          redis_client.llen(queue, function(err, res) {
            let msg = `${moment().format('LLLL')} Redis Queue Size: ${queue}:${res}`
            logger.log('verbose', `[redis-sentinel] ${msg}`);
            result.info.push("Queue Length : " + queue + " : " +  res);
            result.metrics["Queue Length/" + queue] = res;
          });
        });

        // Get connected slaves
        redis_client.info('replication', function(err, res) {
          var redisInfoRep = res.split(/\r?\n/);
          const str = "connected_slaves";
          function findStringInArray(str, redisInfoRep) {

            var n = redisInfoRep.findIndex(_strCheck);
            return n;

            function _strCheck(el) {

              return el.match(str);
            }
          }
          var num = findStringInArray(str, redisInfoRep);
          if (num != -1) {
            var connected_slaves = redisInfoRep[findStringInArray(str, redisInfoRep)];
            let msg = moment().format('LLLL') + " Connected Slaves : " + connected_slaves;
            logger.log('verbose', `[redis-sentinel] ${msg}`);
            result.info.push("Connected Slaves : " + connected_slaves);
          } else {
            let msg = moment().format('LLLL') + " Entry for connected Slaves not found when executing a Redis INFO command. Please contact System Administrator. ";
            logger.log('verbose', `[redis-sentinel] ${msg}`);
          }

        });

        result.passed = true;
        redis_client.quit();
      });

      redis_client.on('end', function() {
        logger.log('debug', '[redis-sentinel] redis-sentinel.on_end');
        result.info.push('Redis client ends.');
        if (result.passed == true) {
          result.metrics['Redis Sentinel Sanity'] = 1;
        } else {
          result.metrics['Redis Sentinel Sanity'] = 0;
        }

        callback(result);
      });
    }
  });
}

module.exports = check_redis_sentinel;
