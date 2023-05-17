// import * as cdk from 'aws-cdk-lib';
// import { Construct } from 'constructs';
// import * as ApiGateway from "aws-cdk-lib/aws-apigateway";
// import * as Iam from "aws-cdk-lib/aws-iam";
// import * as S3 from "aws-cdk-lib/aws-s3";
// import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
// import * as lambda from "aws-cdk-lib/aws-lambda";


// class UploadService extends Construct {
//     constructor(scope, id) {
//       super(scope, id);

//       // create our bucket
//     const assetsBucket = this.createBucketForFiles();

//     // create lambda to get presigned url from apigateway.
//     const urlLambda = this.createURLLambda(assetsBucket);

//     // create api-gateway
//     const api = new ApiGateway.RestApi(this, "s3UrlAPI", {
//       restApiName: "S3 Signed URL",
//       description: "returns signed url."
//     })

//     const getURLIntegration = new ApiGateway.LambdaIntegration(urlLambda, {
//       requestTemplates: { "application/json": '{ "statusCode": "200" }' }
//     });
//     api.root.addMethod("GET", getURLIntegration); // GET /




//     const apiGateway = this.createAPIGateway();
//     apiGateway.root
//       .addResource('s3Url')
//       .addMethod("GET", )

//     // create role and assign permissions on bucket.
//     const executeRole = this.createExecutionRole(assetsBucket);
//     assetsBucket.grantReadWrite(executeRole);

//     // // define the integration with s3
//     // const s3Integration = this.createS3Integration(assetsBucket, executeRole);

//     // this.addAssetsEndpoint(apiGateway, s3Integration);


//   }

// createURLLambda(bucket) {
//     return new lambda.Function(this, "urlHandler", {
//       runtime: lambda.Runtime.NODEJS_18_X,
//       code: lambda.Code.fromAsset("resources"),
//       handler: "lambdaFunction.main",
//       environment: {
//         BUCKET: bucket.bucketName
//       }
//     });
//   }

//   createBucketForFiles() {
//     return new S3.Bucket(this, "FileBucket", {
//       bucketName: "s3-fovus-richfrank",
//     });
//   }

//   createAPIGateway() {
//     return new ApiGateway.RestApi(this, "files-api", {
//       restApiName: "Files provider",
//       description: "Serves files from the S3 bucket.",
//       binaryMediaTypes: ["*/*"],
//       minCompressionSize: cdk.Size.bytes(0),
//       defaultCorsPreflightOptions: {
//         allowOrigins: ApiGateway.Cors.ALL_ORIGINS,
//         allowHeaders: ApiGateway.Cors.DEFAULT_HEADERS,
//         allowMethods: ApiGateway.Cors.ALL_METHODS
//       },
//     });
//   }

//   private createExecutionRole(bucket: S3.IBucket) {
//     const executeRole = new Iam.Role(this, "api-gateway-s3-assume-role", {
//       assumedBy: new Iam.ServicePrincipal("apigateway.amazonaws.com"),
//       roleName: "API-Gateway-S3-Integration-Role",
//     });

//     executeRole.addToPolicy(
//       new Iam.PolicyStatement({
//         resources: [bucket.bucketArn],
//         actions: ["s3:*"],
//       })
//     );

//     return executeRole;
//   }


//   // s3 path needs to be bucketname/filename.txt
//   private createS3Integration(assetsBucket: S3.IBucket, executeRole: Iam.Role) {
//     return new ApiGateway.AwsIntegration({
//       service: "s3",
//       integrationHttpMethod: "PUT",
//       path: `${assetsBucket.bucketName}/{folder}/{object}`,
//       options: {
//         credentialsRole: executeRole,
//         integrationResponses: [
//           {
//             statusCode: "200",
//             responseParameters: {
//               "method.response.header.Content-Type": "integration.response.header.Content-Type",
//               "method.response.header.Access-Control-Allow-Origin": "'*'"
//             },
//           },
//         ],

//         requestParameters: {
//           "integration.request.header.Content-Type": "method.request.header.Content-Type",
//           "integration.request.path.folder": "method.request.path.textInput",
//           "integration.request.path.object": "method.request.path.uploadFile",
//         },
//       },
//     });
//   }

//   // creates our api post endpoint associated with our s3 bucket endpoint.
//   private addAssetsEndpoint(
//     apiGateway: ApiGateway.RestApi,
//     s3Integration: ApiGateway.AwsIntegration
//   ) {
//     apiGateway.root
//       .addResource('upload')
//       .addMethod("PUT", s3Integration, {
//         methodResponses: [
//           {
//             statusCode: "200",
//             responseParameters: {
//               "method.response.header.Content-Type": true,
//               'method.response.header.Access-Control-Allow-Origin': true,
//               'method.response.header.Access-Control-Allow-Credentials': true
//             },
//           },
//         ],
//         requestParameters: {
//           "method.request.path.uploadFile": true,
//           "method.request.path.textInput": true,
//           "method.request.header.Content-Type": true,
//         },
//       });
//   }
// }

// module.exports = { WidgetService }
//     // // create dynamodb table for our storage of inputs and S3 path
//     // const table = new dynamodb.Table(this, "UploadTable", {
//     //   partitionKey: { name: "id", type: dynamodb.AttributeType.STRING },
//     // })

//     // // create dynamo db
//     // const dynamoDbLambda = new lambda.Function(this, "DynamoDBLambdaHandler", {
//     //   runtime: lambda.Runtime.NODEJS_18_X,
//     //   code: lambda.Code.fromAsset("functions"),
//     //   handler: "dynamo.handler",
//     //   environment: {
//     //     TABLE_NAME: table.tableName,
//     //   }
//     // })

//     // table.grantReadWriteData(dynamoDbLambda);


  