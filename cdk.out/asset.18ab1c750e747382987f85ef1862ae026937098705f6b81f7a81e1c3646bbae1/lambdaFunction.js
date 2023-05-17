const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");

const bucket = process.env.BUCKET

if (!bucket) {
  throw console.error(`S3 bucket not set`);
}

exports.handler = async function (event) {
  try {
    // This is really annoying. I got stuck for hours because I didn't think to parse the body since it was already a json object.
    // had to parse json from a json object.  
    // apigateway returns 200 but an empty body because the request works but the lambda wasn't working.
    // NOTE - JSON.parse also causes local tests to fail but it runs in prod.
    const body = JSON.parse(event.body);
    const key = body.key;
    const action = body.action;
    
    if (!key) {
      throw Error("Key parsing error.")
    }
    if (action != "getURL") {
      throw Error("not allowed")
    }
    
    const s3client = new S3Client({
      region: "us-east-1",
    });

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    const url = await getSignedUrl(s3client, command, { expiresIn: 3600 });
    return formatResponse(JSON.stringify(url));
    } catch (error) {
      throw Error(error)
    }
}
  
var formatResponse = function(body){
  var response = {
    "statusCode": 200,
    "headers": {
      "Content-Type": "application/json",
      "Access-Control-Allow-Headers" : "Content-Type",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "OPTIONS,POST,GET"
    },
    "body": body
  }
  return response
}  