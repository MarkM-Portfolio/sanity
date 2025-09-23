## Build and Run

### Docker images

There are 2 docker images for this service, the actual Sanity application
and an image that is used in *Helm* tests to test the service being up
and running.

 - The file `Dockerfile` is used to build the service docker image.
   ```sh
   docker build -t sanity:dev-1.0 -f Dockerfile .
   ```
 - The file `Dockerfile.tester` is used to build the helm test image.
   ```sh
   docker build -t sanity-tester:dev-1.0 -f Dockerfile.tester .
   ```

### Helm chart
Build the Helm chart and deploy it onto Kubernetes cluster:
```sh
$ helm package deployment/helm/sanity
```

### Deploy onto Kubernetes cluster
Before deploy to Kubernetes, make sure the the docker images has been pushed
to a Docker registry that the Kubernetes cluster has access to:
```sh
docker tag sanity:dev-1.0 my-reg.swg.usma.ibm.com:5000/sanity:dev-1.0
docker push my-reg.swg.usma.ibm.com:5000/sanity:dev-1.0
```

Use Helm to deploy:
```sh
$ helm install -n sanity --namespace connections sanity-x.x.x.tar.gz \
  --set replicaCount=1,image.repository=my-reg.swg.usma.ibm.com:5000,image.tag=dev-1.0
```

## Develop
The Sanity application is written in JavaScript and runs under Node.js

### Start the web application locally:

```sh
npm install
node_modules/.bin/webpack
npm start
```

start the app with different logging levels (error, warn, info, verbose, debug, silly):
```sh
LOG_LEVEL=verbose npm start
```

### Defines Known Services and their Checkers

Modify the JSON file: `services.json`, that defines what serverices to check.

A service has name, and a list of checkers.
```json
...
{ "name": "mongo", "checkers": [ "check_dns", "check_mongo" ] },
{ "name": "sample-https-service",
  "protocol": "https", "selfSigned": true,
  "checkers": [ "check_dns", "check_http" ],
```

### Select services to check
set file `etc/sanity/services-to-check` contains the list of services this app
should check, default `ALL` means all know services should be checked.

### Write Checkers

Checkers are written as Node.js modules, resides under `lib` directory.
A checker exposes a function and the Sanity frame will load the module
based on their names listed in `services.json` file, using `require`.

Checker should expose as a function, such as:
```js
// A sample checker ...
function check_feature_x(svc, callback) {
  var result = {
    checker: 'sample_checker',
    passed: false,
    info:[],
    errors:[],
    warnings:[],
    metrics: {}
    };
  // do all of my checks here and fill in the result ...
  callback(result);
}

module.exports = check_feature_x;
```

#### Result of the Check

The check function should pass the result using the `callback` function, the
result should be a JavaScript object, with the following properties:
 - `checker`, string, the name of this checker, shows in the report.
 - `passed`, boolean, whether the check is passed or not.
 - `metrics`, hash, contains metrics data,
    see <a href="#metrics-data">`metrics data example`</a>

#### Metrics Data
Metrics data is a simple hash that contains the metrics name and value:
```js
{
  checker: 'sample_checker',
  passse
  metrics: {
    "connections.events.analysis": 103,
    "connections.events.profile": 2304,
    "connections.events.itm": 0
  }
}
```
