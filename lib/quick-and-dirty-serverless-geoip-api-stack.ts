import {
  Stack,
  App,
  StackProps,
  Duration,
  CfnOutput,
  aws_apigatewayv2_integrations,
  aws_lambda,
  aws_lambda_nodejs,
  aws_apigatewayv2,
} from "aws-cdk-lib";

import * as path from "path";

export class QuickAndDirtyServerlessGeoipApiStack extends Stack {
  constructor(scope: App, id: string, props?: StackProps) {
    super(scope, id, props);

    const geoIPLookupFunction = new aws_lambda_nodejs.NodejsFunction(
      this,
      "geoIPLookup",
      {
        runtime: aws_lambda.Runtime.NODEJS_20_X,
        entry: path.join(__dirname, "../lambda/index.js"),
        handler: "handler",
        timeout: Duration.seconds(25),
        memorySize: 512,
        bundling: {
          commandHooks: {
            // Copy a file so that it will be included in the bundled asset
            afterBundling(inputDir: string, outputDir: string): string[] {
              return [`cp ${inputDir}/lambda/GeoLite2-City.mmdb ${outputDir}`];
            },
            beforeInstall(inputDir: string, outputDir: string): string[] {
              return [];
            },
            beforeBundling(inputDir: string, outputDir: string): string[] {
              return [];
            },
          },
        },
      }
    );

    const httpApi = new aws_apigatewayv2.HttpApi(this, "HttpApi");

    const geoIPLookupIntegration =
      new aws_apigatewayv2_integrations.HttpLambdaIntegration(
        "geoIPLookupIntegration",
        geoIPLookupFunction
      );
    httpApi.addRoutes({
      path: "/",
      methods: [aws_apigatewayv2.HttpMethod.GET],
      integration: geoIPLookupIntegration,
    });

    new CfnOutput(this, "sampleApiEndpoint", {
      value: httpApi.apiEndpoint,
    });
  }
}
