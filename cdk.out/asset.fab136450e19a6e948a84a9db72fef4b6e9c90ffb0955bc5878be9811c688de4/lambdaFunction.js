const AWS = require('aws-sdk');

const s3 = new AWS.S3({ signatureVersion: 'v4 ' })

const bucket = process.env.BUCKET

if (!bucket) {
  throw console.error(`S3 bucket not set`);
}

exports.handler = async function (event) {
  try {
    const key = JSON.parse(event.body)['object_key'];

    if (!key) {
      throw Error('Need S3 key.')
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/plain'
      },
      body: s3.getSignedUrl("putObject", {
        Bucket: bucket,
        Key: key,
        Expires: 24 * 60 * 60
      })
    }
  } catch (error) {
    throw Error(`another error here: ${error}`)
  }
}