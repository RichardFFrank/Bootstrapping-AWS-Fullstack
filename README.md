# This repository contains all code referenced in the medium article [Bootstrapping a fullstack application using aws cdk (2023)](https://medium.com/@rich.f.frank/bootstrapping-a-full-stack-application-using-aws-cdk-2023-60d2eaf999cc)
                                                                        
                                                                        
# Navigating the Repo.
- lib
  - aws_service_stack.ts -> infrastucture code

- resources
  - dynamoDBFunction.js     -> code for updating dynamoDB instance
  - generatePresignedURL.js -> code for generating presigned url based on the request from the frontend.
  - triggerFuntion.js       -> code to be run on an S3 put event. 
 
