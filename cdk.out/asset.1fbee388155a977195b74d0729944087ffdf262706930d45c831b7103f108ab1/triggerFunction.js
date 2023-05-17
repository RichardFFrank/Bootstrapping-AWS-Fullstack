const { S3Client } = require("@aws-sdk/client-s3");

const bucketName = process.env.BUCKET;
const dynamoDBTableName = process.env.DYNAMO;
const region = process.env.REGION

exports.handler = async function (event) {
    // // create a new vm. 
    const s3client = new S3Client({ region: region });


    /* ~~~~~~~ In the VM ~~~~~~~~ */

    // download input file from s3.

    // get input text from dynamodb to the input file.
    // append to file in format [existing content] : [inputtext]

    // upload to s3 as [outputFile].txt

    // save to dynamo db.
    
    /* ~~~~~~~ Out of the VM ~~~~~ */

    // kill VM
    console.log("Hello world from the trigger lambda")
    console.log(event)
    console.log(event.body)
}

/* 
One problem, need to break up presigned URL Lambda from dynamoDb lambda 
*/