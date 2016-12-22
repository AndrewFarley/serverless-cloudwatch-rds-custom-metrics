/**
 * This script calls another lambda which is expected to return
 * a cloudwatch metrics array which we will push to cloudwatch.
 *
 * Once you've deployed this to AWS and confirmed the mysql gather
 * script works, try this with...
 *    serverless invoke -f push-to-cloudwatch --log
 *
 * @summary   A NodeJS-based Custom CloudWatch Metric script using data from another Lambda
 *
 * @link      https://github.com/AndrewFarley/serverless-cloudwatch-rds-custom-metrics
 * @requires  aws-sdk
 * @author    Farley <farley@neonsurge.com> <farley@olindata.com>
 * @license   MIT
 */

// Required libraries
var AWS = require('aws-sdk');
// TODO, set the region automatically
var lambda = new AWS.Lambda();
var cloudwatch = new AWS.CloudWatch({apiVersion: '2010-08-01'});

// Lambda Handler
console.log("Started up, waiting for someone to call the exports.handler...");
exports.handler = function(event, context, callback) {
  // For NodeJS 4.3 Instant-Callback Support
  context.callbackWaitsForEmptyEventLoop = false;
  console.log("Started up: ");

  // Then lets call our Lambda that is in our VPC to get data from RDS to put into cloudwatch
  lambda.invoke({
    // TODO Get service name here?
    FunctionName: 'serverless-cloudwatch-rds-custom-metrics-demo-gather-mysql-stats-from-rds',
    Payload: JSON.stringify(event, null, 2),
  }, function(error, data) {
    if (error) {
      console.log("caught error");
      return callback( "Error while calling lambda " + JSON.stringify(error), null );
    }
    if(data.Payload){
      console.log("Received statistic data from MySQL, pushing to cloudwatch...");
      var data_parsed = JSON.parse(data.Payload)
      cloudwatch.putMetricData(data_parsed, function(err, data) {
        console.log("Successfully pushed " + data_parsed['MetricData'].length + " metrics");
        if (err) return callback( "Error while pushing metrics " + JSON.stringify(err), null );
        else     return callback( null, "Successfully pushed " + data_parsed['MetricData'].length + " metrics" );
      });
    } else {
      return callback( "Error while trying to invoke stats gathering lambda", null );
    }
  });
}

// For debugging/development, so you can test locally, but your local user must be able to execute the remote lambda.  It will not detect and call the local gather-mysql-stats-from-rds
// exports.handler({}, function() { var callbackWaitsForEmptyEventLoop = true }, function( err, success ) { console.log('Error result:'); console.log(err); console.log('Success result:'); console.log(success); process.exit(); });
