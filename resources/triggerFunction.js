const { S3Client } = require("@aws-sdk/client-s3");

const bucketName = process.env.BUCKET;
const dynamoDBTableName = process.env.DYNAMO;
const region = process.env.REGION

exports.handler = async function (event) {
    // // create a new vm. 
    const s3client = new S3Client({ region: region });

    // again, another annoying thing is how we parse the event data from the s3 event. See below.
    const data = event.Records[0]
    const bucketName = data.s3.bucket.name;
    const object = data.s3.object.key;
    const path = bucketName + '/' + object;
    console.log(bucketName);
    console.log(path);
    console.log(object);
    
    console.log(data)



    /* ~~~~~~~ In the VM ~~~~~~~~ */

    // download input file from s3.

    // get input text from dynamodb to the input file.
    // append to file in format [existing content] : [inputtext]

    // upload to s3 as [outputFile].txt

    // save to dynamo db.
    
    /* ~~~~~~~ Out of the VM ~~~~~ */

    // kill VM
    // want to see if the trigger event contains the s3 name.
}

/* 
One problem, need to break up presigned URL Lambda from dynamoDb lambda 
*/