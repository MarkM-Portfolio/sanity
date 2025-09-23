const util = require('util');

function checkSelf(svc, callback) {
  const result = {
    checker: 'self',
    passed: false,
    info: [],
    errors: [],
    warnings: [],
  };
  const memUsage = process.memoryUsage();
  const keys = Object.keys(memUsage);
  for (let i = 0; i < keys.length; i += 1) {
    const key = keys[i];
    const nMB = Math.round(memUsage[key] / 1024 / 1024);
    result.info.push(util.format('memory (%s): %d MB', key, nMB));
  }
  result.passed = true;
  callback(result);
}

module.exports = checkSelf;
