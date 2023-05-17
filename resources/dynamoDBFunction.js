const { DynamoDBClient, PutItemCommand } = require("@aws-sdk/client-dynamodb");

const bucketName = process.env.BUCKET;
const dynamoDBTableName = process.env.DYNAMO;
const region = process.env.REGION

if (!bucketName) {
  throw console.error(`S3 bucketName not set`);
}

exports.handler = async function (event) {
  try {
    // This is really annoying. I got stuck for hours because I didn't think to parse the body since it was already a json object.
    // had to parse json from a json object.  
    // apigateway returns 200 but an empty body because the request works but the lambda wasn't working.
    // NOTE - JSON.parse also causes local tests to fail but it runs in prod.
    const body = JSON.parse(event.body);
    const id = body.id;
    const inputText = body.inputText;
    const filePath = bucketName + "/" + body.fileName + ".txt";
    const updateDB = await postToDynamoDBTable(dynamoDBTableName, region, id, inputText, filePath);
    return formatResponse("success");
  } catch (error) {
    throw Error(error);
  }
}

async function postToDynamoDBTable(dynamoDBTableName, region, id, input_text, filePath) {
  try {
    const client = new DynamoDBClient({ region: region });
    const input = {
      TableName: dynamoDBTableName,
      Item: {
        'id': { S: id },
        'input_text': { S: input_text },
        'input_file_path': { S: filePath }
      }
    }
    const command = new PutItemCommand(input);
    return client.send(command);
  } catch (error) {
    throw Error(error);
  }
}

var formatResponse = function (body) {
  var response = {
    "statusCode": 200,
    "headers": {
      "Content-Type": "application/json",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "OPTIONS,POST,GET"
    },
    "body": body
  }
  return response
} 