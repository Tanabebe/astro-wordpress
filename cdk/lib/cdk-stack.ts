import * as cdk from 'aws-cdk-lib'
import { Construct } from 'constructs'
import * as s3 from 'aws-cdk-lib/aws-s3'
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment'
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront'
import * as cloudfrontOrigins from 'aws-cdk-lib/aws-cloudfront-origins'
import * as iam from 'aws-cdk-lib/aws-iam'

export class CdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props)

    // S3Bucket
    const s3Bucket = new s3.Bucket(this, 'AstroS3Bucket', {
      // bucketNameはlowerCamelかkebab
      bucketName: 'astro-s3-bucket',
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    })

    // cloudfrontのみからの参照に絞る
    const originAccessIdentity = new cloudfront.OriginAccessIdentity(
      this,
      'OriginAccessIdentity',
      {
        comment: 'astro-cloudfront-distribution-originAccessIdentity',
      }
    )

    // s3バケットのポリシーを設定する、CloudFront以外からはAccessDeniedにする
    const cloudfrontAccessPolicy = new iam.PolicyStatement({
      actions: ['s3:GetObject'],
      effect: iam.Effect.ALLOW,
      principals: [
        new iam.CanonicalUserPrincipal(
          originAccessIdentity.cloudFrontOriginAccessIdentityS3CanonicalUserId
        ),
      ],
      resources: [`${s3Bucket.bucketArn}/*`],
    })

    // ポリシーのアタッチ
    s3Bucket.addToResourcePolicy(cloudfrontAccessPolicy)

    // CloudFront
    const cloudFrontDistribution = new cloudfront.Distribution(
      this,
      'AstroCloudFrontDistribution',
      {
        comment: 'astro-cloudfront-distribution',
        defaultRootObject: 'index.html',
        defaultBehavior: {
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
          cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
          viewerProtocolPolicy:
            cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          origin: new cloudfrontOrigins.S3Origin(s3Bucket, {
            originAccessIdentity,
          }),
        },
        errorResponses: [
          {
            httpStatus: 404,
            responseHttpStatus: 200,
            responsePagePath: '/index.html',
          },
        ],
      }
    )

    // Astroでyarn buildしたdistをS3へアップロードする
    new s3deploy.BucketDeployment(this, 'AstroBuildDeployment', {
      sources: [s3deploy.Source.asset('dist')],
      destinationBucket: s3Bucket,
      distribution: cloudFrontDistribution,
    })

    new cdk.CfnOutput(this, 'CloudFrontUrl', {
      value: `https://${cloudFrontDistribution.domainName}`,
    })
  }
}
