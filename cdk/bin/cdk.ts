#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { AstroCdkStack } from '../lib/astro-cdk-stack';

const app = new cdk.App();
new AstroCdkStack(app, 'AstroCdkStack', {});