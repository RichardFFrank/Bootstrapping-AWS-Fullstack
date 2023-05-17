import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
export declare class AwsServiceStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps);
    private createLambdaPermission;
    private createApiGateway;
    private createAmplifyApp;
    private createDBLambda;
    private createURLLambda;
    private createTriggerLambda;
    private createBucketForFiles;
    private createPolicyStatement;
    private createDynamoDB;
}
