#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { AwsServiceStack } from '../lib/aws_service-stack';

const app = new cdk.App();
new AwsServiceStack(app, 'AwsServiceStack', {});