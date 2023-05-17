import * as cdk from 'aws-cdk-lib';
import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ApiGateway from "aws-cdk-lib/aws-apigateway";
import * as Iam from "aws-cdk-lib/aws-iam";
import * as S3 from "aws-cdk-lib/aws-s3";
import { BucketEncryption } from 'aws-cdk-lib/aws-s3';
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { randomInt } from 'crypto';
import * as amplify from "@aws-cdk/aws-amplify-alpha";
import * as lambdaTriggers from "aws-cdk-lib/aws-lambda-event-sources";

const REGION = "us-east-1";

export class AwsServiceStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    //  create dynamodb table for our storage of inputs and S3 path
    const dbTable = this.createDynamoDB();

    // create our bucket
    const assetsBucket = this.createBucketForFiles();

    // create policy statement ot access bucket
    const lambdaPolicy = this.createPolicyStatement(assetsBucket);

    // create lambda to get presigned url from apigateway.
    const urlLambda = this.createLambdaFunction(assetsBucket, lambdaPolicy, dbTable, "generatePresignedURL.handler");

    const dbLambda = this.createLambdaFunction(assetsBucket,lambdaPolicy, dbTable, "dynamoDBFunction.handler");

    // assign permisstions to our DB lambda to write to dynamo.
    dbTable.grantReadWriteData(dbLambda);

    const s3TriggerLambda = this.createTriggerLambda(assetsBucket, lambdaPolicy);

    // create our role for the gateway lambda proxy.
    const urlApiPermission = this.createLambdaPermission(urlLambda, "urlApiGatewayPermission");
    // create the lambda api gateway proxy with the lambda handler and the cors options.
    const uploadApiAuthorizer = this.createApiGateway(urlLambda, "urlApiGateway");
    // get our url from the api gateway
    const uploadPath = uploadApiAuthorizer.urlForPath();

    // create role and gateway for dynamoDB
    const dynamoDBLambdaPermission = this.createLambdaPermission(dbLambda, "dbApiGatewayPermission");
    const dynamoApiAuthorizer = this.createApiGateway(dbLambda, "dbApiGateway");
    const dynamoPath = dynamoApiAuthorizer.urlForPath();
    // create amplify application
    const amplifyApp = this.createAmplifyApp(uploadPath, dynamoPath);
  }

  private createLambdaPermission(urlHandler: lambda.IFunction, permissionName: string) {
    return new lambda.CfnPermission(this, permissionName, {
      functionName: urlHandler.functionArn,
      action: 'lambda:InvokeFunction',
      principal: 'apigateway.amazonaws.com'
    })
  }

  private createApiGateway(urlHandler: lambda.IFunction, gatewayName: string) {
    return new ApiGateway.LambdaRestApi(this, gatewayName, {
      handler: urlHandler,
      defaultCorsPreflightOptions: {
        allowOrigins: ApiGateway.Cors.ALL_ORIGINS,
        allowMethods: ApiGateway.Cors.ALL_METHODS,
        allowHeaders: ['*'],
      }
    });
  }

  private createAmplifyApp(uploadPath: string, dyanmoPath: string) {
    const amplifyApp = new amplify.App(this,
      "react-frontend-app", {
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

  private createLambdaFunction(bucket: S3.IBucket, policy: Iam.PolicyStatement, dynamo: dynamodb.Table, handlerName: string) {
    return new lambda.Function(this, handlerName, {
      runtime: lambda.Runtime.NODEJS_18_X,
      code: lambda.Code.fromAsset("resources"),
      handler: handlerName,
      environment: {
        'BUCKET': bucket.bucketName,
        'DYNAMO': dynamo.tableName,
        'REGION': REGION
      },
      initialPolicy: [policy]
    });
  }

  private createTriggerLambda(bucket: S3.Bucket, policy: Iam.PolicyStatement) {
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

  private createBucketForFiles() {
    const int = randomInt(100);
    const id = `UploadBucket + ${int}`
    return new S3.Bucket(this, id, {
      encryption: BucketEncryption.S3_MANAGED,
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
    })
  };

  private createPolicyStatement(bucket: S3.IBucket) {
    const lambdaPolicyStatement = new Iam.PolicyStatement();
    lambdaPolicyStatement.addActions('s3:PutObject', 'dynamodb:GetItem', 'dynamodb:PutItem', 'dynamodb:Query');
    lambdaPolicyStatement.addResources(bucket.bucketArn + '/*');
    return lambdaPolicyStatement;
  }

  private createDynamoDB() {
    return new dynamodb.Table(this, 'FileDetailsTable', {
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      tableClass: dynamodb.TableClass.STANDARD_INFREQUENT_ACCESS,
    });
  }
}