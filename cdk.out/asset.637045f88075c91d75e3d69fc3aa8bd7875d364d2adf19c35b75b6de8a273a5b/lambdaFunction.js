const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");


const bucket = process.env.BUCKET

if (!bucket) {
  throw console.error(`S3 bucket not set`);
}

exports.handler = async function (event) {
  try {
    const key = event.body['fileName'];

    if (!key) {
      throw Error('Need S3 key.')
    }
    const s3client = new S3Client({
      region: "us-east-1",
    });

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    const url = await getSignedUrl(s3client, command, { expiresIn: 3600 });
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/plain'
      },
      body: url
    }
  } catch (error) {
    throw Error(error)
  }
}