"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AwsServiceStack = void 0;
const cdk = require("aws-cdk-lib");
const ApiGateway = require("aws-cdk-lib/aws-apigateway");
const Iam = require("aws-cdk-lib/aws-iam");
const S3 = require("aws-cdk-lib/aws-s3");
const aws_s3_1 = require("aws-cdk-lib/aws-s3");
const dynamodb = require("aws-cdk-lib/aws-dynamodb");
const lambda = require("aws-cdk-lib/aws-lambda");
const crypto_1 = require("crypto");
const amplify = require("@aws-cdk/aws-amplify-alpha");
const lambdaTriggers = require("aws-cdk-lib/aws-lambda-event-sources");
const REGION = "us-east-1";
class AwsServiceStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        //  create dynamodb table for our storage of inputs and S3 path
        const dbTable = this.createDynamoDB();
        // create our bucket
        const assetsBucket = this.createBucketForFiles();
        // create policy statement ot access bucket
        const lambdaPolicy = this.createPolicyStatement(assetsBucket, dbTable);
        // create lambda to get presigned url from apigateway.
        const urlLambda = this.createURLLambda(assetsBucket, lambdaPolicy, dbTable);
        const dbLambda = this.createDBLambda(assetsBucket, lambdaPolicy, dbTable);
        dbTable.grantReadWriteData(dbLambda);
        const s3TriggerLambda = this.createTriggerLambda(assetsBucket, lambdaPolicy);
        // create our role for the gateway lambda proxy.
        const urlApiPermission = this.createLambdaPermission(urlLambda);
        // create the lambda api gateway proxy with the lambda handler and the cors options.
        const uploadApiAuthorizer = this.createApiGateway(urlLambda);
        // get our url from the api gateway
        const uploadPath = uploadApiAuthorizer.urlForPath();
        // create role and gateway for dynamoDB
        const dynamoDBLambdaPermission = this.createLambdaPermission(dbLambda);
        const dynamoApiAuthorizer = this.createApiGateway(dbLambda);
        const dynamoPath = dynamoApiAuthorizer.urlForPath();
        // create amplify application
        const amplifyApp = this.createAmplifyApp(uploadPath, dynamoPath);
    }
    createLambdaPermission(urlHandler) {
        return new lambda.CfnPermission(this, 'ApiGatewayPermission', {
            functionName: urlHandler.functionArn,
            action: 'lambda:InvokeFunction',
            principal: 'apigateway.amazonaws.com'
        });
    }
    createApiGateway(urlHandler) {
        return new ApiGateway.LambdaRestApi(this, 'UploadApi', {
            handler: urlHandler,
            defaultCorsPreflightOptions: {
                allowOrigins: ApiGateway.Cors.ALL_ORIGINS,
                allowMethods: ApiGateway.Cors.ALL_METHODS,
                allowHeaders: ['*'],
            }
        });
    }
    createAmplifyApp(uploadPath, dyanmoPath) {
        const amplifyApp = new amplify.App(this, "react-frontend-app", {
            sourceCodeProvider: new amplify.GitHubSourceCodeProvider({
                owner: "RichardFFrank",
                repository: "AWSService-Frontend-React-App",
                oauthToken: cdk.SecretValue.secretsManager('github-token-amplify')
            }),
            environmentVariables: {
                "REACT_APP_PRESIGNED_URL_SOURCE": uploadPath,
                "REACT_APP_DYNAMO_LAMBDA": dyanmoPath,
            },
        });
        amplifyApp.addBranch("main");
        return amplifyApp;
    }
    createDBLambda(bucket, policy, dynamo) {
        // we pass the bucket name to this lambda as well to build our file-path for storage without depending on the front end.
        return new lambda.Function(this, "dynamoDBLambda", {
            runtime: lambda.Runtime.NODEJS_18_X,
            code: lambda.Code.fromAsset("resources"),
            handler: "dynamoDBFunction.handler",
            environment: {
                'BUCKET': bucket.bucketName,
                'DYNAMO': dynamo.tableName,
                'REGION': REGION
            },
            initialPolicy: [policy]
        });
    }
    createURLLambda(bucket, policy, dynamo) {
        return new lambda.Function(this, "urlHandler", {
            runtime: lambda.Runtime.NODEJS_18_X,
            code: lambda.Code.fromAsset("resources"),
            handler: "lambdaFunction.handler",
            environment: {
                'BUCKET': bucket.bucketName,
                'DYNAMO': dynamo.tableName,
                'REGION': REGION
            },
            initialPolicy: [policy]
        });
    }
    createTriggerLambda(bucket, policy) {
        const s3TriggerLambda = new lambda.Function(this, "triggerHandler", {
            runtime: lambda.Runtime.NODEJS_18_X,
            code: lambda.Code.fromAsset("resources"),
            handler: "triggerFunction.handler",
            initialPolicy: [policy]
        });
        const s3PutEventSource = new lambdaTriggers.S3EventSource(bucket, {
            events: [S3.EventType.OBJECT_CREATED_PUT]
        });
        s3TriggerLambda.addEventSource(s3PutEventSource);
        return s3TriggerLambda;
    }
    createBucketForFiles() {
        const int = (0, crypto_1.randomInt)(100);
        const id = `UploadBucket + ${int}`;
        return new S3.Bucket(this, id, {
            encryption: aws_s3_1.BucketEncryption.S3_MANAGED,
            publicReadAccess: false,
            cors: [
                {
                    allowedMethods: [
                        S3.HttpMethods.GET,
                        S3.HttpMethods.POST,
                        S3.HttpMethods.PUT,
                    ],
                    allowedOrigins: ['*'],
                    allowedHeaders: ['*'],
                },
            ],
            autoDeleteObjects: true,
            removalPolicy: cdk.RemovalPolicy.DESTROY
        });
    }
    ;
    createPolicyStatement(bucket, dynamodb) {
        const lambdaPolicyStatement = new Iam.PolicyStatement();
        lambdaPolicyStatement.addActions('s3:PutObject', 'dynamodb:GetItem', 'dynamodb:PutItem', 'dynamodb:Query');
        // lambdaPolicyStatement.addResources(dynamodb.tableArn);
        lambdaPolicyStatement.addResources(bucket.bucketArn + '/*');
        return lambdaPolicyStatement;
    }
    createDynamoDB() {
        return new dynamodb.Table(this, 'FileDetailsTable', {
            partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            tableClass: dynamodb.TableClass.STANDARD_INFREQUENT_ACCESS,
        });
    }
}
exports.AwsServiceStack = AwsServiceStack;
// private createExecutionRole(bucket: S3.IBucket) {
//   const executeRole = new Iam.Role(this, "api-gateway-s3-assume-role", {
//     assumedBy: new Iam.ServicePrincipal("apigateway.amazonaws.com"),
//     roleName: "API-Gateway-S3-Integration-Role",
//   });
//   executeRole.addToPolicy(
//     new Iam.PolicyStatement({
//       resources: [bucket.bucketArn],
//       actions: ["s3:*"],
//     })
//   );
//   return executeRole;
// }
// private createAPIGateway() {
//   return new ApiGateway.RestApi(this, "files-api", {
//     restApiName: "Files provider",
//     description: "Serves files from the S3 bucket.",
//     binaryMediaTypes: ["*/*"],
//     minCompressionSize: cdk.Size.bytes(0),
//     defaultCorsPreflightOptions: {
//       allowOrigins: ApiGateway.Cors.ALL_ORIGINS,
//       allowHeaders: ApiGateway.Cors.DEFAULT_HEADERS,
//       allowMethods: ApiGateway.Cors.ALL_METHODS
//     },
//   });
// }
/*
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "VisualEditor0",
            "Effect": "Allow",
            "Action": [
                "s3:PutObject",
                "dynamodb:PutItem",
                "dynamodb:GetItem",
                "dynamodb:Query"
            ],
            "Resource": [
                "arn:aws:s3:::awsservicestack-uploadbucket283dcfff13-1p0lhvmh87029/*",
                "arn:aws:dynamodb:us-east-1:317751517130:table/AwsServiceStack-FileDetailsTable9895FBF8-8D6BCD95L9BX"
            ]
        }
    ]
}
*/ 
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXdzX3NlcnZpY2Utc3RhY2suanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJhd3Nfc2VydmljZS1zdGFjay50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSxtQ0FBbUM7QUFHbkMseURBQXlEO0FBQ3pELDJDQUEyQztBQUMzQyx5Q0FBeUM7QUFDekMsK0NBQXNEO0FBQ3RELHFEQUFxRDtBQUNyRCxpREFBaUQ7QUFDakQsbUNBQW1DO0FBQ25DLHNEQUFzRDtBQUN0RCx1RUFBdUU7QUFFdkUsTUFBTSxNQUFNLEdBQUcsV0FBVyxDQUFDO0FBRTNCLE1BQWEsZUFBZ0IsU0FBUSxHQUFHLENBQUMsS0FBSztJQUM1QyxZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFFLEtBQXNCO1FBQzlELEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBRXhCLCtEQUErRDtRQUMvRCxNQUFNLE9BQU8sR0FBRyxJQUFJLENBQUMsY0FBYyxFQUFFLENBQUM7UUFFdEMsb0JBQW9CO1FBQ3BCLE1BQU0sWUFBWSxHQUFHLElBQUksQ0FBQyxvQkFBb0IsRUFBRSxDQUFDO1FBRWpELDJDQUEyQztRQUMzQyxNQUFNLFlBQVksR0FBRyxJQUFJLENBQUMscUJBQXFCLENBQUMsWUFBWSxFQUFFLE9BQU8sQ0FBQyxDQUFDO1FBRXZFLHNEQUFzRDtRQUN0RCxNQUFNLFNBQVMsR0FBRyxJQUFJLENBQUMsZUFBZSxDQUFDLFlBQVksRUFBRSxZQUFZLEVBQUUsT0FBTyxDQUFDLENBQUM7UUFFNUUsTUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLGNBQWMsQ0FBQyxZQUFZLEVBQUMsWUFBWSxFQUFFLE9BQU8sQ0FBQyxDQUFDO1FBRXpFLE9BQU8sQ0FBQyxrQkFBa0IsQ0FBQyxRQUFRLENBQUMsQ0FBQztRQUVyQyxNQUFNLGVBQWUsR0FBRyxJQUFJLENBQUMsbUJBQW1CLENBQUMsWUFBWSxFQUFFLFlBQVksQ0FBQyxDQUFDO1FBRTdFLGdEQUFnRDtRQUNoRCxNQUFNLGdCQUFnQixHQUFHLElBQUksQ0FBQyxzQkFBc0IsQ0FBQyxTQUFTLENBQUMsQ0FBQztRQUNoRSxvRkFBb0Y7UUFDcEYsTUFBTSxtQkFBbUIsR0FBRyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsU0FBUyxDQUFDLENBQUM7UUFDN0QsbUNBQW1DO1FBQ25DLE1BQU0sVUFBVSxHQUFHLG1CQUFtQixDQUFDLFVBQVUsRUFBRSxDQUFDO1FBRXBELHVDQUF1QztRQUN2QyxNQUFNLHdCQUF3QixHQUFHLElBQUksQ0FBQyxzQkFBc0IsQ0FBQyxRQUFRLENBQUMsQ0FBQztRQUN2RSxNQUFNLG1CQUFtQixHQUFHLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxRQUFRLENBQUMsQ0FBQTtRQUMzRCxNQUFNLFVBQVUsR0FBRyxtQkFBbUIsQ0FBQyxVQUFVLEVBQUUsQ0FBQztRQUNwRCw2QkFBNkI7UUFDN0IsTUFBTSxVQUFVLEdBQUcsSUFBSSxDQUFDLGdCQUFnQixDQUFDLFVBQVUsRUFBRSxVQUFVLENBQUMsQ0FBQztJQUNuRSxDQUFDO0lBRU8sc0JBQXNCLENBQUMsVUFBNEI7UUFDekQsT0FBTyxJQUFJLE1BQU0sQ0FBQyxhQUFhLENBQUMsSUFBSSxFQUFFLHNCQUFzQixFQUFFO1lBQzVELFlBQVksRUFBRSxVQUFVLENBQUMsV0FBVztZQUNwQyxNQUFNLEVBQUUsdUJBQXVCO1lBQy9CLFNBQVMsRUFBRSwwQkFBMEI7U0FDdEMsQ0FBQyxDQUFBO0lBQ0osQ0FBQztJQUVPLGdCQUFnQixDQUFDLFVBQTRCO1FBQ25ELE9BQU8sSUFBSSxVQUFVLENBQUMsYUFBYSxDQUFDLElBQUksRUFBRSxXQUFXLEVBQUU7WUFDckQsT0FBTyxFQUFFLFVBQVU7WUFDbkIsMkJBQTJCLEVBQUU7Z0JBQzNCLFlBQVksRUFBRSxVQUFVLENBQUMsSUFBSSxDQUFDLFdBQVc7Z0JBQ3pDLFlBQVksRUFBRSxVQUFVLENBQUMsSUFBSSxDQUFDLFdBQVc7Z0JBQ3pDLFlBQVksRUFBRSxDQUFDLEdBQUcsQ0FBQzthQUNwQjtTQUNGLENBQUMsQ0FBQztJQUNMLENBQUM7SUFFTyxnQkFBZ0IsQ0FBQyxVQUFrQixFQUFFLFVBQWtCO1FBQzdELE1BQU0sVUFBVSxHQUFHLElBQUksT0FBTyxDQUFDLEdBQUcsQ0FBQyxJQUFJLEVBQ3JDLG9CQUFvQixFQUFFO1lBQ3RCLGtCQUFrQixFQUFFLElBQUksT0FBTyxDQUFDLHdCQUF3QixDQUFDO2dCQUN2RCxLQUFLLEVBQUUsZUFBZTtnQkFDdEIsVUFBVSxFQUFFLCtCQUErQjtnQkFDM0MsVUFBVSxFQUFFLEdBQUcsQ0FBQyxXQUFXLENBQUMsY0FBYyxDQUFDLHNCQUFzQixDQUFDO2FBQ25FLENBQUM7WUFDRixvQkFBb0IsRUFBRTtnQkFDcEIsZ0NBQWdDLEVBQUUsVUFBVTtnQkFDNUMseUJBQXlCLEVBQUUsVUFBVTthQUN0QztTQUNGLENBQUMsQ0FBQztRQUNILFVBQVUsQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDN0IsT0FBTyxVQUFVLENBQUM7SUFDcEIsQ0FBQztJQUVPLGNBQWMsQ0FBQyxNQUFrQixFQUFFLE1BQTJCLEVBQUUsTUFBc0I7UUFDNUYsd0hBQXdIO1FBQ3hILE9BQU8sSUFBSSxNQUFNLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSxnQkFBZ0IsRUFBRTtZQUNqRCxPQUFPLEVBQUUsTUFBTSxDQUFDLE9BQU8sQ0FBQyxXQUFXO1lBQ25DLElBQUksRUFBRSxNQUFNLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxXQUFXLENBQUM7WUFDeEMsT0FBTyxFQUFFLDBCQUEwQjtZQUNuQyxXQUFXLEVBQUU7Z0JBQ1gsUUFBUSxFQUFFLE1BQU0sQ0FBQyxVQUFVO2dCQUMzQixRQUFRLEVBQUUsTUFBTSxDQUFDLFNBQVM7Z0JBQzFCLFFBQVEsRUFBRSxNQUFNO2FBQ2pCO1lBQ0QsYUFBYSxFQUFFLENBQUMsTUFBTSxDQUFDO1NBQ3hCLENBQUMsQ0FBQTtJQUNKLENBQUM7SUFFTyxlQUFlLENBQUMsTUFBa0IsRUFBRSxNQUEyQixFQUFFLE1BQXNCO1FBQzdGLE9BQU8sSUFBSSxNQUFNLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSxZQUFZLEVBQUU7WUFDN0MsT0FBTyxFQUFFLE1BQU0sQ0FBQyxPQUFPLENBQUMsV0FBVztZQUNuQyxJQUFJLEVBQUUsTUFBTSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsV0FBVyxDQUFDO1lBQ3hDLE9BQU8sRUFBRSx3QkFBd0I7WUFDakMsV0FBVyxFQUFFO2dCQUNYLFFBQVEsRUFBRSxNQUFNLENBQUMsVUFBVTtnQkFDM0IsUUFBUSxFQUFFLE1BQU0sQ0FBQyxTQUFTO2dCQUMxQixRQUFRLEVBQUUsTUFBTTthQUNqQjtZQUNELGFBQWEsRUFBRSxDQUFDLE1BQU0sQ0FBQztTQUN4QixDQUFDLENBQUM7SUFDTCxDQUFDO0lBRU8sbUJBQW1CLENBQUMsTUFBaUIsRUFBRSxNQUEyQjtRQUN4RSxNQUFNLGVBQWUsR0FBRyxJQUFJLE1BQU0sQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLGdCQUFnQixFQUFFO1lBQ2xFLE9BQU8sRUFBRSxNQUFNLENBQUMsT0FBTyxDQUFDLFdBQVc7WUFDbkMsSUFBSSxFQUFFLE1BQU0sQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLFdBQVcsQ0FBQztZQUN4QyxPQUFPLEVBQUUseUJBQXlCO1lBQ2xDLGFBQWEsRUFBRSxDQUFDLE1BQU0sQ0FBQztTQUN4QixDQUFDLENBQUM7UUFFSCxNQUFNLGdCQUFnQixHQUFHLElBQUksY0FBYyxDQUFDLGFBQWEsQ0FBQyxNQUFNLEVBQUU7WUFDaEUsTUFBTSxFQUFFLENBQUMsRUFBRSxDQUFDLFNBQVMsQ0FBQyxrQkFBa0IsQ0FBQztTQUMxQyxDQUFDLENBQUM7UUFFSCxlQUFlLENBQUMsY0FBYyxDQUFDLGdCQUFnQixDQUFDLENBQUM7UUFDakQsT0FBTyxlQUFlLENBQUM7SUFDekIsQ0FBQztJQUVPLG9CQUFvQjtRQUMxQixNQUFNLEdBQUcsR0FBRyxJQUFBLGtCQUFTLEVBQUMsR0FBRyxDQUFDLENBQUM7UUFDM0IsTUFBTSxFQUFFLEdBQUcsa0JBQWtCLEdBQUcsRUFBRSxDQUFBO1FBQ2xDLE9BQU8sSUFBSSxFQUFFLENBQUMsTUFBTSxDQUFDLElBQUksRUFBRSxFQUFFLEVBQUU7WUFDN0IsVUFBVSxFQUFFLHlCQUFnQixDQUFDLFVBQVU7WUFDdkMsZ0JBQWdCLEVBQUUsS0FBSztZQUN2QixJQUFJLEVBQUU7Z0JBQ0o7b0JBQ0UsY0FBYyxFQUFFO3dCQUNkLEVBQUUsQ0FBQyxXQUFXLENBQUMsR0FBRzt3QkFDbEIsRUFBRSxDQUFDLFdBQVcsQ0FBQyxJQUFJO3dCQUNuQixFQUFFLENBQUMsV0FBVyxDQUFDLEdBQUc7cUJBQ25CO29CQUNELGNBQWMsRUFBRSxDQUFDLEdBQUcsQ0FBQztvQkFDckIsY0FBYyxFQUFFLENBQUMsR0FBRyxDQUFDO2lCQUN0QjthQUNGO1lBQ0QsaUJBQWlCLEVBQUUsSUFBSTtZQUN2QixhQUFhLEVBQUUsR0FBRyxDQUFDLGFBQWEsQ0FBQyxPQUFPO1NBQ3pDLENBQUMsQ0FBQTtJQUNKLENBQUM7SUFBQSxDQUFDO0lBRU0scUJBQXFCLENBQUMsTUFBa0IsRUFBRSxRQUF3QjtRQUN4RSxNQUFNLHFCQUFxQixHQUFHLElBQUksR0FBRyxDQUFDLGVBQWUsRUFBRSxDQUFDO1FBQ3hELHFCQUFxQixDQUFDLFVBQVUsQ0FBQyxjQUFjLEVBQUUsa0JBQWtCLEVBQUUsa0JBQWtCLEVBQUUsZ0JBQWdCLENBQUMsQ0FBQztRQUMzRyx5REFBeUQ7UUFDekQscUJBQXFCLENBQUMsWUFBWSxDQUFDLE1BQU0sQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLENBQUM7UUFDNUQsT0FBTyxxQkFBcUIsQ0FBQztJQUMvQixDQUFDO0lBRU8sY0FBYztRQUNwQixPQUFPLElBQUksUUFBUSxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsa0JBQWtCLEVBQUU7WUFDbEQsWUFBWSxFQUFFLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsUUFBUSxDQUFDLGFBQWEsQ0FBQyxNQUFNLEVBQUU7WUFDakUsV0FBVyxFQUFFLFFBQVEsQ0FBQyxXQUFXLENBQUMsZUFBZTtZQUNqRCxhQUFhLEVBQUUsR0FBRyxDQUFDLGFBQWEsQ0FBQyxPQUFPO1lBQ3hDLFVBQVUsRUFBRSxRQUFRLENBQUMsVUFBVSxDQUFDLDBCQUEwQjtTQUMzRCxDQUFDLENBQUM7SUFDTCxDQUFDO0NBQ0Y7QUE1SkQsMENBNEpDO0FBR0Msb0RBQW9EO0FBQ3BELDJFQUEyRTtBQUMzRSx1RUFBdUU7QUFDdkUsbURBQW1EO0FBQ25ELFFBQVE7QUFFUiw2QkFBNkI7QUFDN0IsZ0NBQWdDO0FBQ2hDLHVDQUF1QztBQUN2QywyQkFBMkI7QUFDM0IsU0FBUztBQUNULE9BQU87QUFFUCx3QkFBd0I7QUFDeEIsSUFBSTtBQUVOLCtCQUErQjtBQUMvQix1REFBdUQ7QUFDdkQscUNBQXFDO0FBQ3JDLHVEQUF1RDtBQUN2RCxpQ0FBaUM7QUFDakMsNkNBQTZDO0FBQzdDLHFDQUFxQztBQUNyQyxtREFBbUQ7QUFDbkQsdURBQXVEO0FBQ3ZELGtEQUFrRDtBQUNsRCxTQUFTO0FBQ1QsUUFBUTtBQUNSLElBQUk7QUFHSjs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7RUFvQkUiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0IHsgU3RhY2ssIFN0YWNrUHJvcHMgfSBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tICdjb25zdHJ1Y3RzJztcbmltcG9ydCAqIGFzIEFwaUdhdGV3YXkgZnJvbSBcImF3cy1jZGstbGliL2F3cy1hcGlnYXRld2F5XCI7XG5pbXBvcnQgKiBhcyBJYW0gZnJvbSBcImF3cy1jZGstbGliL2F3cy1pYW1cIjtcbmltcG9ydCAqIGFzIFMzIGZyb20gXCJhd3MtY2RrLWxpYi9hd3MtczNcIjtcbmltcG9ydCB7IEJ1Y2tldEVuY3J5cHRpb24gfSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtczMnO1xuaW1wb3J0ICogYXMgZHluYW1vZGIgZnJvbSBcImF3cy1jZGstbGliL2F3cy1keW5hbW9kYlwiO1xuaW1wb3J0ICogYXMgbGFtYmRhIGZyb20gXCJhd3MtY2RrLWxpYi9hd3MtbGFtYmRhXCI7XG5pbXBvcnQgeyByYW5kb21JbnQgfSBmcm9tICdjcnlwdG8nO1xuaW1wb3J0ICogYXMgYW1wbGlmeSBmcm9tIFwiQGF3cy1jZGsvYXdzLWFtcGxpZnktYWxwaGFcIjtcbmltcG9ydCAqIGFzIGxhbWJkYVRyaWdnZXJzIGZyb20gXCJhd3MtY2RrLWxpYi9hd3MtbGFtYmRhLWV2ZW50LXNvdXJjZXNcIjtcblxuY29uc3QgUkVHSU9OID0gXCJ1cy1lYXN0LTFcIjtcblxuZXhwb3J0IGNsYXNzIEF3c1NlcnZpY2VTdGFjayBleHRlbmRzIGNkay5TdGFjayB7XG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzPzogY2RrLlN0YWNrUHJvcHMpIHtcbiAgICBzdXBlcihzY29wZSwgaWQsIHByb3BzKTtcblxuICAgIC8vICBjcmVhdGUgZHluYW1vZGIgdGFibGUgZm9yIG91ciBzdG9yYWdlIG9mIGlucHV0cyBhbmQgUzMgcGF0aFxuICAgIGNvbnN0IGRiVGFibGUgPSB0aGlzLmNyZWF0ZUR5bmFtb0RCKCk7XG5cbiAgICAvLyBjcmVhdGUgb3VyIGJ1Y2tldFxuICAgIGNvbnN0IGFzc2V0c0J1Y2tldCA9IHRoaXMuY3JlYXRlQnVja2V0Rm9yRmlsZXMoKTtcblxuICAgIC8vIGNyZWF0ZSBwb2xpY3kgc3RhdGVtZW50IG90IGFjY2VzcyBidWNrZXRcbiAgICBjb25zdCBsYW1iZGFQb2xpY3kgPSB0aGlzLmNyZWF0ZVBvbGljeVN0YXRlbWVudChhc3NldHNCdWNrZXQsIGRiVGFibGUpO1xuXG4gICAgLy8gY3JlYXRlIGxhbWJkYSB0byBnZXQgcHJlc2lnbmVkIHVybCBmcm9tIGFwaWdhdGV3YXkuXG4gICAgY29uc3QgdXJsTGFtYmRhID0gdGhpcy5jcmVhdGVVUkxMYW1iZGEoYXNzZXRzQnVja2V0LCBsYW1iZGFQb2xpY3ksIGRiVGFibGUpO1xuXG4gICAgY29uc3QgZGJMYW1iZGEgPSB0aGlzLmNyZWF0ZURCTGFtYmRhKGFzc2V0c0J1Y2tldCxsYW1iZGFQb2xpY3ksIGRiVGFibGUpO1xuXG4gICAgZGJUYWJsZS5ncmFudFJlYWRXcml0ZURhdGEoZGJMYW1iZGEpO1xuXG4gICAgY29uc3QgczNUcmlnZ2VyTGFtYmRhID0gdGhpcy5jcmVhdGVUcmlnZ2VyTGFtYmRhKGFzc2V0c0J1Y2tldCwgbGFtYmRhUG9saWN5KTtcblxuICAgIC8vIGNyZWF0ZSBvdXIgcm9sZSBmb3IgdGhlIGdhdGV3YXkgbGFtYmRhIHByb3h5LlxuICAgIGNvbnN0IHVybEFwaVBlcm1pc3Npb24gPSB0aGlzLmNyZWF0ZUxhbWJkYVBlcm1pc3Npb24odXJsTGFtYmRhKTtcbiAgICAvLyBjcmVhdGUgdGhlIGxhbWJkYSBhcGkgZ2F0ZXdheSBwcm94eSB3aXRoIHRoZSBsYW1iZGEgaGFuZGxlciBhbmQgdGhlIGNvcnMgb3B0aW9ucy5cbiAgICBjb25zdCB1cGxvYWRBcGlBdXRob3JpemVyID0gdGhpcy5jcmVhdGVBcGlHYXRld2F5KHVybExhbWJkYSk7XG4gICAgLy8gZ2V0IG91ciB1cmwgZnJvbSB0aGUgYXBpIGdhdGV3YXlcbiAgICBjb25zdCB1cGxvYWRQYXRoID0gdXBsb2FkQXBpQXV0aG9yaXplci51cmxGb3JQYXRoKCk7XG5cbiAgICAvLyBjcmVhdGUgcm9sZSBhbmQgZ2F0ZXdheSBmb3IgZHluYW1vREJcbiAgICBjb25zdCBkeW5hbW9EQkxhbWJkYVBlcm1pc3Npb24gPSB0aGlzLmNyZWF0ZUxhbWJkYVBlcm1pc3Npb24oZGJMYW1iZGEpO1xuICAgIGNvbnN0IGR5bmFtb0FwaUF1dGhvcml6ZXIgPSB0aGlzLmNyZWF0ZUFwaUdhdGV3YXkoZGJMYW1iZGEpXG4gICAgY29uc3QgZHluYW1vUGF0aCA9IGR5bmFtb0FwaUF1dGhvcml6ZXIudXJsRm9yUGF0aCgpO1xuICAgIC8vIGNyZWF0ZSBhbXBsaWZ5IGFwcGxpY2F0aW9uXG4gICAgY29uc3QgYW1wbGlmeUFwcCA9IHRoaXMuY3JlYXRlQW1wbGlmeUFwcCh1cGxvYWRQYXRoLCBkeW5hbW9QYXRoKTtcbiAgfVxuXG4gIHByaXZhdGUgY3JlYXRlTGFtYmRhUGVybWlzc2lvbih1cmxIYW5kbGVyOiBsYW1iZGEuSUZ1bmN0aW9uKSB7XG4gICAgcmV0dXJuIG5ldyBsYW1iZGEuQ2ZuUGVybWlzc2lvbih0aGlzLCAnQXBpR2F0ZXdheVBlcm1pc3Npb24nLCB7XG4gICAgICBmdW5jdGlvbk5hbWU6IHVybEhhbmRsZXIuZnVuY3Rpb25Bcm4sXG4gICAgICBhY3Rpb246ICdsYW1iZGE6SW52b2tlRnVuY3Rpb24nLFxuICAgICAgcHJpbmNpcGFsOiAnYXBpZ2F0ZXdheS5hbWF6b25hd3MuY29tJ1xuICAgIH0pXG4gIH1cblxuICBwcml2YXRlIGNyZWF0ZUFwaUdhdGV3YXkodXJsSGFuZGxlcjogbGFtYmRhLklGdW5jdGlvbikge1xuICAgIHJldHVybiBuZXcgQXBpR2F0ZXdheS5MYW1iZGFSZXN0QXBpKHRoaXMsICdVcGxvYWRBcGknLCB7XG4gICAgICBoYW5kbGVyOiB1cmxIYW5kbGVyLFxuICAgICAgZGVmYXVsdENvcnNQcmVmbGlnaHRPcHRpb25zOiB7XG4gICAgICAgIGFsbG93T3JpZ2luczogQXBpR2F0ZXdheS5Db3JzLkFMTF9PUklHSU5TLFxuICAgICAgICBhbGxvd01ldGhvZHM6IEFwaUdhdGV3YXkuQ29ycy5BTExfTUVUSE9EUyxcbiAgICAgICAgYWxsb3dIZWFkZXJzOiBbJyonXSxcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIHByaXZhdGUgY3JlYXRlQW1wbGlmeUFwcCh1cGxvYWRQYXRoOiBzdHJpbmcsIGR5YW5tb1BhdGg6IHN0cmluZykge1xuICAgIGNvbnN0IGFtcGxpZnlBcHAgPSBuZXcgYW1wbGlmeS5BcHAodGhpcyxcbiAgICAgIFwicmVhY3QtZnJvbnRlbmQtYXBwXCIsIHtcbiAgICAgIHNvdXJjZUNvZGVQcm92aWRlcjogbmV3IGFtcGxpZnkuR2l0SHViU291cmNlQ29kZVByb3ZpZGVyKHtcbiAgICAgICAgb3duZXI6IFwiUmljaGFyZEZGcmFua1wiLFxuICAgICAgICByZXBvc2l0b3J5OiBcIkFXU1NlcnZpY2UtRnJvbnRlbmQtUmVhY3QtQXBwXCIsXG4gICAgICAgIG9hdXRoVG9rZW46IGNkay5TZWNyZXRWYWx1ZS5zZWNyZXRzTWFuYWdlcignZ2l0aHViLXRva2VuLWFtcGxpZnknKVxuICAgICAgfSksXG4gICAgICBlbnZpcm9ubWVudFZhcmlhYmxlczoge1xuICAgICAgICBcIlJFQUNUX0FQUF9QUkVTSUdORURfVVJMX1NPVVJDRVwiOiB1cGxvYWRQYXRoLFxuICAgICAgICBcIlJFQUNUX0FQUF9EWU5BTU9fTEFNQkRBXCI6IGR5YW5tb1BhdGgsXG4gICAgICB9LFxuICAgIH0pO1xuICAgIGFtcGxpZnlBcHAuYWRkQnJhbmNoKFwibWFpblwiKTtcbiAgICByZXR1cm4gYW1wbGlmeUFwcDtcbiAgfVxuXG4gIHByaXZhdGUgY3JlYXRlREJMYW1iZGEoYnVja2V0OiBTMy5JQnVja2V0LCBwb2xpY3k6IElhbS5Qb2xpY3lTdGF0ZW1lbnQsIGR5bmFtbzogZHluYW1vZGIuVGFibGUpIHtcbiAgICAvLyB3ZSBwYXNzIHRoZSBidWNrZXQgbmFtZSB0byB0aGlzIGxhbWJkYSBhcyB3ZWxsIHRvIGJ1aWxkIG91ciBmaWxlLXBhdGggZm9yIHN0b3JhZ2Ugd2l0aG91dCBkZXBlbmRpbmcgb24gdGhlIGZyb250IGVuZC5cbiAgICByZXR1cm4gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCBcImR5bmFtb0RCTGFtYmRhXCIsIHtcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18xOF9YLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KFwicmVzb3VyY2VzXCIpLFxuICAgICAgaGFuZGxlcjogXCJkeW5hbW9EQkZ1bmN0aW9uLmhhbmRsZXJcIixcbiAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgICdCVUNLRVQnOiBidWNrZXQuYnVja2V0TmFtZSxcbiAgICAgICAgJ0RZTkFNTyc6IGR5bmFtby50YWJsZU5hbWUsXG4gICAgICAgICdSRUdJT04nOiBSRUdJT05cbiAgICAgIH0sXG4gICAgICBpbml0aWFsUG9saWN5OiBbcG9saWN5XVxuICAgIH0pXG4gIH1cblxuICBwcml2YXRlIGNyZWF0ZVVSTExhbWJkYShidWNrZXQ6IFMzLklCdWNrZXQsIHBvbGljeTogSWFtLlBvbGljeVN0YXRlbWVudCwgZHluYW1vOiBkeW5hbW9kYi5UYWJsZSkge1xuICAgIHJldHVybiBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsIFwidXJsSGFuZGxlclwiLCB7XG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMThfWCxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldChcInJlc291cmNlc1wiKSxcbiAgICAgIGhhbmRsZXI6IFwibGFtYmRhRnVuY3Rpb24uaGFuZGxlclwiLFxuICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgJ0JVQ0tFVCc6IGJ1Y2tldC5idWNrZXROYW1lLFxuICAgICAgICAnRFlOQU1PJzogZHluYW1vLnRhYmxlTmFtZSxcbiAgICAgICAgJ1JFR0lPTic6IFJFR0lPTlxuICAgICAgfSxcbiAgICAgIGluaXRpYWxQb2xpY3k6IFtwb2xpY3ldXG4gICAgfSk7XG4gIH1cblxuICBwcml2YXRlIGNyZWF0ZVRyaWdnZXJMYW1iZGEoYnVja2V0OiBTMy5CdWNrZXQsIHBvbGljeTogSWFtLlBvbGljeVN0YXRlbWVudCkge1xuICAgIGNvbnN0IHMzVHJpZ2dlckxhbWJkYSA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgXCJ0cmlnZ2VySGFuZGxlclwiLCB7XG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMThfWCxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldChcInJlc291cmNlc1wiKSxcbiAgICAgIGhhbmRsZXI6IFwidHJpZ2dlckZ1bmN0aW9uLmhhbmRsZXJcIixcbiAgICAgIGluaXRpYWxQb2xpY3k6IFtwb2xpY3ldXG4gICAgfSk7XG5cbiAgICBjb25zdCBzM1B1dEV2ZW50U291cmNlID0gbmV3IGxhbWJkYVRyaWdnZXJzLlMzRXZlbnRTb3VyY2UoYnVja2V0LCB7XG4gICAgICBldmVudHM6IFtTMy5FdmVudFR5cGUuT0JKRUNUX0NSRUFURURfUFVUXVxuICAgIH0pO1xuXG4gICAgczNUcmlnZ2VyTGFtYmRhLmFkZEV2ZW50U291cmNlKHMzUHV0RXZlbnRTb3VyY2UpO1xuICAgIHJldHVybiBzM1RyaWdnZXJMYW1iZGE7XG4gIH1cblxuICBwcml2YXRlIGNyZWF0ZUJ1Y2tldEZvckZpbGVzKCkge1xuICAgIGNvbnN0IGludCA9IHJhbmRvbUludCgxMDApO1xuICAgIGNvbnN0IGlkID0gYFVwbG9hZEJ1Y2tldCArICR7aW50fWBcbiAgICByZXR1cm4gbmV3IFMzLkJ1Y2tldCh0aGlzLCBpZCwge1xuICAgICAgZW5jcnlwdGlvbjogQnVja2V0RW5jcnlwdGlvbi5TM19NQU5BR0VELFxuICAgICAgcHVibGljUmVhZEFjY2VzczogZmFsc2UsXG4gICAgICBjb3JzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBhbGxvd2VkTWV0aG9kczogW1xuICAgICAgICAgICAgUzMuSHR0cE1ldGhvZHMuR0VULFxuICAgICAgICAgICAgUzMuSHR0cE1ldGhvZHMuUE9TVCxcbiAgICAgICAgICAgIFMzLkh0dHBNZXRob2RzLlBVVCxcbiAgICAgICAgICBdLFxuICAgICAgICAgIGFsbG93ZWRPcmlnaW5zOiBbJyonXSxcbiAgICAgICAgICBhbGxvd2VkSGVhZGVyczogWycqJ10sXG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgICAgYXV0b0RlbGV0ZU9iamVjdHM6IHRydWUsXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZXG4gICAgfSlcbiAgfTtcblxuICBwcml2YXRlIGNyZWF0ZVBvbGljeVN0YXRlbWVudChidWNrZXQ6IFMzLklCdWNrZXQsIGR5bmFtb2RiOiBkeW5hbW9kYi5UYWJsZSkge1xuICAgIGNvbnN0IGxhbWJkYVBvbGljeVN0YXRlbWVudCA9IG5ldyBJYW0uUG9saWN5U3RhdGVtZW50KCk7XG4gICAgbGFtYmRhUG9saWN5U3RhdGVtZW50LmFkZEFjdGlvbnMoJ3MzOlB1dE9iamVjdCcsICdkeW5hbW9kYjpHZXRJdGVtJywgJ2R5bmFtb2RiOlB1dEl0ZW0nLCAnZHluYW1vZGI6UXVlcnknKTtcbiAgICAvLyBsYW1iZGFQb2xpY3lTdGF0ZW1lbnQuYWRkUmVzb3VyY2VzKGR5bmFtb2RiLnRhYmxlQXJuKTtcbiAgICBsYW1iZGFQb2xpY3lTdGF0ZW1lbnQuYWRkUmVzb3VyY2VzKGJ1Y2tldC5idWNrZXRBcm4gKyAnLyonKTtcbiAgICByZXR1cm4gbGFtYmRhUG9saWN5U3RhdGVtZW50O1xuICB9XG5cbiAgcHJpdmF0ZSBjcmVhdGVEeW5hbW9EQigpIHtcbiAgICByZXR1cm4gbmV3IGR5bmFtb2RiLlRhYmxlKHRoaXMsICdGaWxlRGV0YWlsc1RhYmxlJywge1xuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6ICdpZCcsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXG4gICAgICBiaWxsaW5nTW9kZTogZHluYW1vZGIuQmlsbGluZ01vZGUuUEFZX1BFUl9SRVFVRVNULFxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcbiAgICAgIHRhYmxlQ2xhc3M6IGR5bmFtb2RiLlRhYmxlQ2xhc3MuU1RBTkRBUkRfSU5GUkVRVUVOVF9BQ0NFU1MsXG4gICAgfSk7XG4gIH1cbn1cblxuXG4gIC8vIHByaXZhdGUgY3JlYXRlRXhlY3V0aW9uUm9sZShidWNrZXQ6IFMzLklCdWNrZXQpIHtcbiAgLy8gICBjb25zdCBleGVjdXRlUm9sZSA9IG5ldyBJYW0uUm9sZSh0aGlzLCBcImFwaS1nYXRld2F5LXMzLWFzc3VtZS1yb2xlXCIsIHtcbiAgLy8gICAgIGFzc3VtZWRCeTogbmV3IElhbS5TZXJ2aWNlUHJpbmNpcGFsKFwiYXBpZ2F0ZXdheS5hbWF6b25hd3MuY29tXCIpLFxuICAvLyAgICAgcm9sZU5hbWU6IFwiQVBJLUdhdGV3YXktUzMtSW50ZWdyYXRpb24tUm9sZVwiLFxuICAvLyAgIH0pO1xuXG4gIC8vICAgZXhlY3V0ZVJvbGUuYWRkVG9Qb2xpY3koXG4gIC8vICAgICBuZXcgSWFtLlBvbGljeVN0YXRlbWVudCh7XG4gIC8vICAgICAgIHJlc291cmNlczogW2J1Y2tldC5idWNrZXRBcm5dLFxuICAvLyAgICAgICBhY3Rpb25zOiBbXCJzMzoqXCJdLFxuICAvLyAgICAgfSlcbiAgLy8gICApO1xuXG4gIC8vICAgcmV0dXJuIGV4ZWN1dGVSb2xlO1xuICAvLyB9XG5cbi8vIHByaXZhdGUgY3JlYXRlQVBJR2F0ZXdheSgpIHtcbi8vICAgcmV0dXJuIG5ldyBBcGlHYXRld2F5LlJlc3RBcGkodGhpcywgXCJmaWxlcy1hcGlcIiwge1xuLy8gICAgIHJlc3RBcGlOYW1lOiBcIkZpbGVzIHByb3ZpZGVyXCIsXG4vLyAgICAgZGVzY3JpcHRpb246IFwiU2VydmVzIGZpbGVzIGZyb20gdGhlIFMzIGJ1Y2tldC5cIixcbi8vICAgICBiaW5hcnlNZWRpYVR5cGVzOiBbXCIqLypcIl0sXG4vLyAgICAgbWluQ29tcHJlc3Npb25TaXplOiBjZGsuU2l6ZS5ieXRlcygwKSxcbi8vICAgICBkZWZhdWx0Q29yc1ByZWZsaWdodE9wdGlvbnM6IHtcbi8vICAgICAgIGFsbG93T3JpZ2luczogQXBpR2F0ZXdheS5Db3JzLkFMTF9PUklHSU5TLFxuLy8gICAgICAgYWxsb3dIZWFkZXJzOiBBcGlHYXRld2F5LkNvcnMuREVGQVVMVF9IRUFERVJTLFxuLy8gICAgICAgYWxsb3dNZXRob2RzOiBBcGlHYXRld2F5LkNvcnMuQUxMX01FVEhPRFNcbi8vICAgICB9LFxuLy8gICB9KTtcbi8vIH1cblxuXG4vKlxue1xuICAgIFwiVmVyc2lvblwiOiBcIjIwMTItMTAtMTdcIixcbiAgICBcIlN0YXRlbWVudFwiOiBbXG4gICAgICAgIHtcbiAgICAgICAgICAgIFwiU2lkXCI6IFwiVmlzdWFsRWRpdG9yMFwiLFxuICAgICAgICAgICAgXCJFZmZlY3RcIjogXCJBbGxvd1wiLFxuICAgICAgICAgICAgXCJBY3Rpb25cIjogW1xuICAgICAgICAgICAgICAgIFwiczM6UHV0T2JqZWN0XCIsXG4gICAgICAgICAgICAgICAgXCJkeW5hbW9kYjpQdXRJdGVtXCIsXG4gICAgICAgICAgICAgICAgXCJkeW5hbW9kYjpHZXRJdGVtXCIsXG4gICAgICAgICAgICAgICAgXCJkeW5hbW9kYjpRdWVyeVwiXG4gICAgICAgICAgICBdLFxuICAgICAgICAgICAgXCJSZXNvdXJjZVwiOiBbXG4gICAgICAgICAgICAgICAgXCJhcm46YXdzOnMzOjo6YXdzc2VydmljZXN0YWNrLXVwbG9hZGJ1Y2tldDI4M2RjZmZmMTMtMXAwbGh2bWg4NzAyOS8qXCIsXG4gICAgICAgICAgICAgICAgXCJhcm46YXdzOmR5bmFtb2RiOnVzLWVhc3QtMTozMTc3NTE1MTcxMzA6dGFibGUvQXdzU2VydmljZVN0YWNrLUZpbGVEZXRhaWxzVGFibGU5ODk1RkJGOC04RDZCQ0Q5NUw5QlhcIlxuICAgICAgICAgICAgXVxuICAgICAgICB9XG4gICAgXVxufVxuKi8iXX0=