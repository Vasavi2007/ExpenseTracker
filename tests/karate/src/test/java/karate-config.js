function fn() {
  var config = {};
  config.baseUrl = karate.properties['baseUrl'] || 'http://localhost:5000';
  return config;
}
