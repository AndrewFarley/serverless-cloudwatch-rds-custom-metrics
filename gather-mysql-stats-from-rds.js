/**
 * This script collects data from a MySQL-based RDS server and
 * returns it to the requester.  This script is designed to run
 * in your RDS's VPC that may not (does not by default) have a
 * NAT Gateway for you to use.
 *
 * To develop/test this script, I typically setup a SSH port forward
 * from my jumpbox in the VPC in which RDS lives so I can test the queries
 * below.  The command(s) to run (in Linux/OS-X) to do this is...
 *
 *    LOCALPORT="3306" && \
 *    REMOTEPORT="3306" && \
 *    REMOTEHOST="rds-hostname-here.us-east-1.rds.amazonaws.com" && \
 *    URL="username@jumpbox.myawesomeservice.com" && \
 *    ssh -N -L $LOCALPORT:$REMOTEHOST:$REMOTEPORT $URL
 *
 * Also uncomment the last line in this script and then simply run this
 * via node with: node gather-mysql-stats-from-rds
 *
 * OR once you've deployed this to AWS, simply use...
 *    serverless invoke -f gather-mysql-stats-from-rds
 *
 * @summary   A NodeJS-based MySQL RDS Data Collection script for AWS Lambda
 *
 * @link      https://github.com/AndrewFarley/cloudwatch-rds-custom-metrics-serverless
 * @requires  mysql
 * @requires  bluebird
 * @author    Farley <farley@neonsurge.com> <farley@olindata.com>
 * @license   MIT
 */

// Required includes
var mysql      = require('mysql');
var Promise    = require('bluebird');

// Initialization notification
console.log("MySQL Custom Application CloudWatch Metrics - Script initiated");

///////////////////////////////////
// Configuration variables start //
///////////////////////////////////
// Connect to our database
var connection = mysql.createConnection({
    // host: 'localhost',  // Use this with the above SSH port forward to test this script and your queries below
    host: 'awsdbname.abcdefg12345.us-east-1.rds.amazonaws.com',
    user: 'usernameHere',
    password: 'passwordHere',
    database: 'databaseNameHere'
});

// Our queries we want to run every time this script is run, please edit the query, unit, and label to what you wish.
//    NOTE: The label will be the name of the CloudWatch metric created by push-to-cloudwatch, and the unit is the Unit value used in CloudWatch
var queries = [
  "SELECT COUNT(*) AS metric, 'users_total' AS label, 'Count' AS unit FROM users",
  "SELECT UNIX_TIMESTAMP()-max(task_last_succeeded_at) AS metric, 'task_last_succeeded' AS label, 'Seconds' AS unit FROM task_engine",
  "SELECT COALESCE(NOW()-max(creation_time), 0) AS metric, 'mail_queue_seconds_behind' AS label, 'Seconds' AS unit FROM mail_queue_table",
  "SELECT COUNT(*) AS metric, 'mail_queue_items' AS label, 'Count' AS unit FROM mail_queue",
  "SELECT COUNT(*) AS metric, 'users_added' AS label, 'Count' AS unit FROM users where creation_date >= now() - INTERVAL 1 MINUTE"
];

// Our CloudWatch params array.  Edit the namespace you wish to use in CloudWatch here
var params = {
  MetricData: [],
  Namespace: 'CustomRDSMetrics' /* required */
};
/////////////////////////////////
// Configuration variables end //
/////////////////////////////////

// Connect to our mysql and Promisify our connection object to simplify the code/logic below
console.log("Connecting to MySQL...");
connection.connect();
Promise.promisifyAll(connection);

// Lambda Handler
console.log("Started up, waiting for someone to call the exports.handler...");
exports.handler = function(event, context, callback) {
  console.log("MySQL Custom Application CloudWatch Metrics - Handler called");
  // Clone the params global instance for this iteration
  var params_instance = JSON.parse(JSON.stringify(params));

  // For AWS Lambda NodeJS 4.3 Instant-Callback Support
  context.callbackWaitsForEmptyEventLoop = false;

  // Run all of our queries asynchonously with promises...
  Promise.map(queries, function(query) {
    return connection.queryAsync(query).then(function(row) {
      // console.log("Got metric " + row[0].label + " value " + row[0].metric);  // For debugging/development
      // Push our metrics data into a collector in the format ready for insertion into CloudWatch that we'll return when all our promises are complete
      params_instance['MetricData'].push({
         MetricName: row[0].label,
         Timestamp: new Date,
         Unit: row[0].unit,
         Value: row[0].metric
      });
    });
  }).then(function() {
    // Return the data back to our caller
    console.log("Ran successfully, returning params");
    // console.log(JSON.stringify(params_instance));
    return callback( null, params_instance );
  });
}

// For debugging/development, so you can test locally is your queries if you setup a SSH port forward or run this on a server in your VPC.  Please do not have this uncommented when you deploy to Lambda
// exports.handler({}, function() { var callbackWaitsForEmptyEventLoop = true }, function( err, success ) { console.log('Error result:'); console.log(err); console.log('Success result:'); console.log(success); process.exit(); });
