'use strict';

const fs = require('fs');
const path = require('path');
const util = require('util');

const newrelic = require('./newrelic');

const SERVICES_FILE = 'services.json';
const CONNECTIONS_ENV_PATH = 'var/config';
const SANITY_CONFIG_PATH = 'etc/sanity'

const logger = require('./logger');

var Checkup = function () {
  this.services = [];
  this.connections_env = {};
  this.sanity_config = {};

  this.run_checkers = function(svc, checkers, callback) {
    var config_map = this.connections_env.entries;
    var fn = function(result) {
        if (result) {
          status.checks.push(result);
        }
        if (i < length) {
          try {
            checkers[i++](svc, fn, config_map);
          } catch (e) {
            fn({checker: 'unknown', passed: false,
              info: [],
              warnings: [],
              errors: [e.toString()]
            });
          }
        } else {
          status.check_finished_at = Date.now();
          status.ready = all_check_passed(status.checks);
          callback(null, status);
        }
      };
    var status = { checks: []}
    if (! checkers) {
      status.ready = true;
      callback(null, status);
      return;
    }
    var i = 0, length = checkers.length;
    status.check_started_at = Date.now();
    fn();
  }

  this.check = function() {
    var self = this;
    const memUsage = process.memoryUsage();
    logger.log('verbose', `[sanity] process.memoryUsage.rss = ${memUsage.rss}`);
    this.loadConfigMap(this.connections_env, CONNECTIONS_ENV_PATH);
    this.loadConfigMap(this.sanity_config, SANITY_CONFIG_PATH);
    this.updateLoggerLevel();
    this.loadServices(SERVICES_FILE);
    for (var i=0; i < self.services.length; i++) {
      let svc = self.services[i];
      logger.log('verbose', `[checkup] about to check '${svc.name}'`);
      if (self.services[i].in_progress) {
        logger.log('verbose', `[checkup] checking '${svc.name}' in progress, skip ...`);
        return;
      }
      svc.in_progress = true;
      self.run_checkers(svc, svc.checkers, function(err, result){
        svc.in_progress = false;
        if(err) {
          logger.log('error', "AGHHHHH!!! BUG!!!");
          return;
        }
        svc.status = result;
      });
    }
    if (this.connections_env.entries['new-relic-enabled'] == 'true') {
      newrelic(this.services);
    }
  };

  this.updateLoggerLevel = () => {
    const currentLevel = logger.level,
          newLevel = this.sanity_config.entries['log-level'];
    if (currentLevel != newLevel) {
      logger.log('warn', `Change log level '${currentLevel}' -> '${newLevel}'`);
      logger.level = newLevel;
    }
  }

  this.wantedListOfServicesNames = function() {
    var wanted = this.sanity_config.entries['services-to-check'];
    if (wanted == 'ALL') {
      wanted = undefined;
    }
    if (wanted) {
      // wanted service names can be separated by ' ' or '/', in case our
      // Helm chart value is given as a list, it will be surrounded by [].
      // exmampe:
      // 1) "[mongodb redis solr]"
      // 2) "mongodb/redis/solr"
      // 3) "[mongodb/redis solr]"
      if (wanted.startsWith('[') && wanted.endsWith(']')) {
        wanted = wanted.substring(1, wanted.length - 1).trim();
      }
      wanted = wanted.split(/[ \/]+/);
    }
    return wanted;
  }

  this.isUp2Date = function(time_loaded, file_path) {
    var up_to_date;
    if (time_loaded) {
      var stats = fs.statSync(file_path);
      var mtime = new Date(util.inspect(stats.mtime));
      logger.log('debug', `[checkup.isUp2Date] file ${file_path} last modified at ${mtime}`);
      if (mtime < this.services_loaded_at) {
        // the file is older than the time we load it.
        logger.log('debug', `[checkup.isUp2Date] file ${file_path} is up-to-date.`);
        up_to_date = true;
      }
    } else {
      logger.log('debug', `[checkup.isUp2Date] file ${file_path} never loaded.`);
      up_to_date = false;
    }
    return up_to_date;
  }

  this.loadServices = function(filename) {
    var services = [],
        wanted = this.wantedListOfServicesNames();

    if (! this.isUp2Date(this.services_loaded_at, filename)) {
      this.known_services = JSON.parse(fs.readFileSync(filename, 'utf8'));
      this.services_loaded_at = Date.now();
      logger.log('verbose', `[checkup] Known services loaded from: ${filename}'`);
      for (var i = 0; i < this.known_services.length; i ++ ) {
        let svc = this.known_services[i];
        if (svc.checkers) {
          for (var c = 0; c < svc.checkers.length; c ++) {
            let chkr = require('./' + svc.checkers[c]);
            logger.log('verbose', `[checkup] "${svc.checkers[c]}" added to ${svc.name}`);
            svc.checkers[c] = chkr;
          }
        }
      }
      logger.log('verbose', `[checkup] ${this.known_services.length} services loaded.`);
    }
    // filter services so we only check the wanted ones
    if (this.services_selected_at === undefined ||
        this.services_selected_at < this.services_loaded_at ||
        this.services_selected_at < this.sanity_config.loaded_at['services-to-check'])
    {
      for (var i = 0; i < this.known_services.length; i ++ ) {
        let svc = this.known_services[i];
        if ( wanted === undefined || wanted.includes(svc.name)) {
          logger.log('verbose', `[checkup] '${svc.name}' added to check list`);
          services.push(svc);
        } else {
          logger.log('verbose', `[checkup] '${svc.name}' is not unwanted`);
        }
      }
      this.services = services;
      this.services_selected_at = Date.now();
      logger.log('verbose', `[checkup] services to check updated`);
    } else {
      logger.log('verbose', '[checkup] services to check is up to date.');
    }
  }

  this.loadConfigMap = function(m, from_path) {
    logger.log('verbose', `[checkup] loading ConfigMap '${from_path}'`);
    var entries_names = fs.readdirSync(from_path);
    if (m.entries === undefined) {
      m.entries = {};
    }
    if (m.loaded_at === undefined) {
      m.loaded_at = {};
    }
    for (var i=0; i < entries_names.length; i++) {
      let name = entries_names[i];
      let fname = path.join(from_path, name);
      if (fs.statSync(fname).isDirectory()) {
        continue;
      }
      if (this.isUp2Date(m.loaded_at[name], fname)) {
        continue;
      }
      let v = fs.readFileSync(fname, {encoding: 'utf8'}).trim();
      m.entries[name] = v;
      m.loaded_at[name] = Date.now();
      logger.log('verbose', `[checkup] ConfigMap updated: ${name} -> ${v}`);
    }
    logger.log('verbose', `[checkup] ConfigMap '${from_path}' loaded`);
  }

  function all_check_passed(check_reports) {
    return check_reports.reduce(function(total, r){
      return total && r.passed;
    }, true);
  };

  this.results = function() {
    var self = this;
    var summary = self.services.map(function(x){
      return {
        name: x.name,
        status: x.status
      };
    });
    return summary;
  };
};

var c = new Checkup();
c.check();
setInterval(function () {
  c.check();
}, 30000);

module.exports = c;
