import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
// import * as sqs from 'aws-cdk-lib/aws-sqs';

export class AstroCdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // context読み込み
    const bucketName: string = this.node.tryGetContext('s3').bucketName;

    // S3Bucket
    const s3Bucket = new cdk.aws_s3.Bucket(this, `s3-${this.stackName}`, {
      bucketName,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    })

    // cloudfrontのみからの参照に絞る
    const originAccessIdentity = new cdk.aws_cloudfront.OriginAccessIdentity(
      this,
      'OriginAccessIdentity',
      {
        comment: 'frontend-distribution-originAccessIdentity',
      }
    );

    // s3バケットのポリシーを設定する、CloudFront以外からはAccessDeniedにする
    const frontendBucketPolicy = new cdk.aws_iam.PolicyStatement({
      actions: ['s3:GetObject'],
      effect: cdk.aws_iam.Effect.ALLOW,
      principals: [
        new cdk.aws_iam.CanonicalUserPrincipal(
          originAccessIdentity.cloudFrontOriginAccessIdentityS3CanonicalUserId
        ),
      ],
      resources: [`${s3Bucket.bucketArn}/*`],
    });

    // ポリシーのアタッチ
    s3Bucket.addToResourcePolicy(frontendBucketPolicy);

    // CloudFront
    const cloudFrontDistribution = new cdk.aws_cloudfront.Distribution(this, 'AstroFrontDist', {
      comment: "frontend-distribution",
      defaultRootObject: "index.html",
      defaultBehavior: {
        allowedMethods: cdk.aws_cloudfront.AllowedMethods.ALLOW_GET_HEAD,
        cachedMethods: cdk.aws_cloudfront.CachedMethods.CACHE_GET_HEAD,
        cachePolicy: cdk.aws_cloudfront.CachePolicy.CACHING_OPTIMIZED,
        viewerProtocolPolicy: cdk.aws_cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        origin: new cdk.aws_cloudfront_origins.S3Origin(s3Bucket, {
          originAccessIdentity,
        }),
      },
      errorResponses: [{
        httpStatus: 404,
        responseHttpStatus: 200,
        responsePagePath: '/index.html'
      }]
    })

    // Astroでyarn buildしたdistをS3へアップロードする
    new cdk.aws_s3_deployment.BucketDeployment(this, 'AstroBucketDeployment', {
      sources: [cdk.aws_s3_deployment.Source.asset('../dist')],
      destinationBucket: s3Bucket,
      distribution: cloudFrontDistribution
    })
  }
}
