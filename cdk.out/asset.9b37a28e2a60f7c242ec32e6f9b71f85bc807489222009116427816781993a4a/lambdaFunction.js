const AWS = require('aws-sdk');

const S3 = new AWS.S3();

exports.handler = function (event, context) {
    const bucket = process.env['BUCKET']

    if (!bucket) {
        console.log('bucket not set:') 
        context.done(new Error(`S3 bucket not set`))
    }

    const key = `my-location/${event.input.name}`

    if (!key) {
      console.log('key missing:')
      context.done(new Error('S3 object key missing'))
      return;
    }
  
    const params = {
      'Bucket': bucket,
      'Key': key,
      ContentType: event.input.filetype
    };
  
    S3.getSignedUrl('putObject', params, (error, url) => {
      if (error) {
        console.log('error:', error)
        context.done(error)
      } else {
        context.done(null, {
          url: url, 
          name: key, 
          filetype: event.input.filetype
        });
      }
    })
  
  }