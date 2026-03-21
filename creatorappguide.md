# Influencer Rate Calculator: Backend Infrastructure & Implementation Guide

guide to build the app

> **Purpose**: This document explains the backend infrastructure architecture and provides a complete implementation plan for migrating from localStorage to serverless AWS.
>
> **Audience**: Development team, technical stakeholders, mentors
>
> **Last Updated**: December 3, 2025

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Backend Infrastructure Explained](#backend-infrastructure-explained)
3. [Implementation Plan](#implementation-plan)
4. [Cost Analysis](#cost-analysis)
5. [Mentor Q&A Reference](#mentor-qa-reference)
6. [Appendix: Technical Specifications](#appendix-technical-specifications)

---

## Project Overview

### Current State
- **Frontend**: React + TypeScript + Vite
- **Data Storage**: Browser localStorage (client-side only)
- **ML Algorithm**: Runs in browser, learns from user's local data
- **Problem**: Data gets wiped, no collective learning, can't scale to multi-user

### Target State
- **Frontend**: Same (no UI changes needed)
- **Data Storage**: AWS DynamoDB (cloud database)
- **ML Algorithm**: Runs in AWS Lambda, learns from ALL users' data
- **Benefits**: Persistent data, better predictions, scalable to SaaS

### Success Criteria
- ✅ All existing features work identically
- ✅ Data never lost (cloud backup)
- ✅ ML predictions improve with more users
- ✅ Costs stay near $0 initially (AWS free tier)
- ✅ Can scale to 1,000+ users without rewrites

---

## Backend Infrastructure Explained

### What We're Building

We're building a **serverless backend** on AWS that consists of 4 main components:

1. **API Gateway** - The front door (receives requests from frontend)
2. **Lambda Functions** - The brains (run your code when needed)
3. **DynamoDB** - The database (stores all collaboration data)
4. **CloudWatch** - The monitor (tracks errors and performance)

### How It Works

```
USER FLOW:
1. User enters creator data in React app
2. Frontend sends HTTPS request to API Gateway
3. API Gateway triggers appropriate Lambda function
4. Lambda runs ML algorithm using data from DynamoDB
5. Lambda returns prediction to frontend
6. User saves → Lambda writes to DynamoDB
```

### Component Breakdown

#### 1. API Gateway (The Front Door)

**What it does**: Routes HTTP requests to the right Lambda function

**Why we need it**:
- Handles HTTPS/SSL automatically (secure)
- Built-in rate limiting (prevents abuse)
- CORS configuration (frontend can call it)
- Request validation (rejects bad data)

**Example**:
- User clicks "Calculate" → `POST https://api.yourapp.com/predictions/calculate`
- API Gateway receives request → triggers `calculatePrediction` Lambda
- Lambda responds → API Gateway returns to frontend

**Cost**: $1 per million requests (first 1M/month free for 12 months)

---

#### 2. Lambda Functions (The Brains)

**What they are**: Small TypeScript functions that run on-demand

**Why serverless Lambda**:
- ✅ Zero cost when not in use (only pay per request)
- ✅ Auto-scales (handles 1 user or 10,000 users)
- ✅ No servers to manage (AWS handles everything)
- ✅ 1M free requests/month

**Lambda functions we'll build**:

| Function | Purpose | Triggered By | What It Does |
|----------|---------|--------------|--------------|
| **calculatePrediction** | ML algorithm | `POST /predictions/calculate` | Queries DynamoDB for historical data, runs smart projection algorithm, returns prediction with confidence score |
| **createCollaboration** | Save calculation | `POST /collaborations` | Validates input, adds computed fields (category, viewsRange), saves to DynamoDB |
| **getCollaborations** | List all data | `GET /collaborations` | Queries DynamoDB by userId, returns paginated list |
| **updateCollaboration** | Add actual results | `PATCH /collaborations/{id}` | Updates item in DynamoDB, auto-calculates accuracy |
| **deleteCollaboration** | Delete record | `DELETE /collaborations/{id}` | Removes item from DynamoDB |
| **searchCollaborations** | Search by name | `GET /collaborations/search?creator=name` | Queries CreatorNameIndex GSI, returns matches |
| **getInsights** | Analytics | `GET /analytics/insights` | Aggregates data, calculates accuracy trends, returns insights |

**Cost**: $0.20 per million requests (first 1M/month free)

---

#### 3. DynamoDB (The Database)

**What it is**: AWS's NoSQL database (like MongoDB but serverless)

**Why DynamoDB over traditional databases**:
- ✅ True pay-per-request (no minimum $15/month like RDS)
- ✅ Auto-scales to any size (10 records or 10 million)
- ✅ No maintenance (no servers, backups automatic)
- ✅ 25GB storage + 25 WCU/RCU free forever

**Our table structure**:

```typescript
Table Name: InfluencerCollaborations

Primary Key:
- PK (Partition Key): userId#global    // Later: userId#<actualUserId>
- SK (Sort Key): COLLAB#2025-12-03T10:30:00Z#1701598200000

Item Example:
{
  PK: "userId#global",
  SK: "COLLAB#2025-12-03T10:30:00Z#1701598200000",

  // Core data
  id: "1701598200000",
  creatorName: "influencer_name",
  averageViews: 15000,
  lowestViews: 8000,
  targetCPM: 20,

  // Prediction
  projectedViews: 11100,
  recommendedPrice: 222,
  confidence: 85,
  reasoning: "mid creator: 5 similar matches...",
  priceRangeMin: 188,
  priceRangeMax: 256,
  dateCalculated: "2025-12-03T10:30:00Z",

  // Actual results (added later)
  actualViews: 12500,
  actualPrice: 250,
  datePosted: "2025-12-10T00:00:00Z",
  notes: "Great engagement",
  accuracy: 88.74,

  // Query optimization fields
  creatorCategory: "mid",              // micro/mid/macro
  viewsRange: "10K-50K",
  hasActualData: true,
  creatorNameLower: "influencer_name"
}
```

**Global Secondary Indexes (GSIs)** - Fast lookup tables:

| GSI Name | PK | SK | Purpose |
|----------|----|----|---------|
| **CategoryIndex** | creatorCategory | averageViews | Find similar creators for ML (e.g., all 'mid' creators with 12K-18K views) |
| **CompletedCollabsIndex** | userId#hasActualData | dateCalculated | Query only completed collaborations for ML training |
| **CreatorNameIndex** | creatorNameLower | dateCalculated | Search by creator name |

**Why GSIs matter**: Without them, you'd have to scan the entire table (expensive, slow). With them, you query only relevant items (cheap, fast).

**Cost**:
- On-demand: $1.25 per million writes, $0.25 per million reads
- At 30 records/month: ~$0.00004/month (free tier)

---

#### 4. CloudWatch (The Monitor)

**What it does**: Logs everything, tracks metrics, sends alerts

**What we'll monitor**:
- Lambda errors (if prediction fails)
- API Gateway 4xx/5xx errors
- DynamoDB throttling
- Prediction accuracy over time (custom metric)

**Cost**: 5GB logs free, $0.50/GB after

---

### Data Flow Example

**Scenario**: User calculates pricing for a new creator

```
STEP 1: User enters data
├─ Frontend: averageViews = 15000, lowestViews = 8000, targetCPM = 20

STEP 2: Frontend calls API
├─ POST https://api.yourapp.com/predictions/calculate
├─ Body: { averageViews: 15000, lowestViews: 8000, targetCPM: 20 }

STEP 3: API Gateway validates and routes
├─ Validates JSON format
├─ Checks rate limit (not exceeded)
├─ Triggers calculatePrediction Lambda

STEP 4: Lambda runs ML algorithm
├─ Queries DynamoDB CompletedCollabsIndex
├─ Gets all completed collaborations: 25 items returned
├─ Categorizes creator: averageViews < 50K → "micro"
├─ Finds similar creators via CategoryIndex GSI:
│   ├─ Query: creatorCategory = "micro" AND averageViews BETWEEN 12000 AND 18000
│   └─ Returns: 5 similar creators
├─ Calculates weighted performance (recency + accuracy)
├─ Applies trend multiplier
├─ Computes final prediction: projectedViews = 11100

STEP 5: Lambda calculates pricing
├─ recommendedPrice = (11100 / 1000) * 20 = $222
├─ confidence = 85% (based on 5 similar matches)
├─ priceRange = { min: $188, max: $256 } (±15% for high confidence)

STEP 6: Lambda returns response
├─ Response: { projectedViews: 11100, recommendedPrice: 222, confidence: 85, ... }

STEP 7: Frontend displays results
├─ User sees prediction with confidence score

STEP 8: User clicks "Save"
├─ POST https://api.yourapp.com/collaborations
├─ Body: { creatorName, averageViews, lowestViews, ..., projectedViews, recommendedPrice }

STEP 9: createCollaboration Lambda saves to DynamoDB
├─ Adds computed fields: creatorCategory = "micro", viewsRange = "10K-50K"
├─ Generates unique ID: Date.now()
├─ PutItem to DynamoDB
├─ Returns: { id: "1701598200000", dateCalculated: "2025-12-03T10:30:00Z", ... }

STEP 10: Frontend shows success toast
├─ "Calculation saved for @influencer_name"
```

**Total time**: 200-500ms (including ML calculation)

**Cost per calculation**: $0.0000015 (less than a tenth of a cent)

---

### Why Serverless?

**Benefits**:
1. **Cost**: $0 when not in use, only pay per request
2. **Scale**: Auto-scales from 1 to 10,000 users without code changes
3. **Maintenance**: No servers to patch, update, or monitor
4. **Reliability**: AWS handles redundancy, backups, uptime

**Trade-offs**:
1. **Cold starts**: First request after idle takes 1-2 seconds (later requests are fast)
2. **Vendor lock-in**: Harder to migrate off AWS (but unlikely need to)
3. **Debugging**: Can't SSH into a server (use CloudWatch logs instead)

For this use case (low initial volume, unpredictable growth), serverless is perfect.

---

### Architecture Diagram

```
┌────────────────────────────────────────────────────────────────┐
│           FRONTEND (React + TypeScript + Vite)                 │
│         Already built - minimal changes needed                 │
└─────────────────────────┬──────────────────────────────────────┘
                          │ HTTPS
                          ▼
┌────────────────────────────────────────────────────────────────┐
│              AWS API GATEWAY (REST API)                        │
│         Route requests to appropriate Lambda                   │
└─┬────┬────┬────┬────┬────┬────┬──────────────────────────────┘
  │    │    │    │    │    │    │
  ▼    ▼    ▼    ▼    ▼    ▼    ▼
┌───┐┌───┐┌───┐┌───┐┌───┐┌───┐┌───┐
│Calc││Create││Get││Update││Delete││Search││Insights│
│Pred││Collab││List││Collab││Collab││ By  ││Lambda │
│Lambda││Lambda││Lambda││Lambda││Lambda││Name ││       │
└─┬─┘└─┬─┘└─┬─┘└─┬─┘└─┬─┘└─┬─┘└──┬──┘
  │    │    │    │    │    │     │
  └────┴────┴────┴────┴────┴─────┘
                 │
                 ▼
┌────────────────────────────────────────────────────────────────┐
│         DYNAMODB TABLE: InfluencerCollaborations               │
│                                                                │
│  Main Table:  PK=userId#global  SK=COLLAB#<timestamp>#<id>    │
│  GSI-1:       PK=creatorCategory  SK=averageViews             │
│  GSI-2:       PK=userId#hasActualData  SK=dateCalculated      │
│  GSI-3:       PK=creatorNameLower  SK=dateCalculated          │
└────────────────────────────────────────────────────────────────┘
```

---

## Implementation Plan

This section provides a step-by-step guide to build and deploy the backend. Estimated time: **4 weeks part-time** (8-12 hours/week) or **1 week full-time**.

---

### Prerequisites

Before you begin, ensure you have:

- [ ] **AWS Account** with admin access
- [ ] **AWS CLI** installed and configured (`aws configure`)
- [ ] **Node.js 18+** installed (`node --version`)
- [ ] **Git** installed
- [ ] **Code editor** (VS Code recommended)
- [ ] **Basic TypeScript knowledge**

**Install AWS CDK** (our infrastructure-as-code tool):
```bash
npm install -g aws-cdk
cdk --version  # Should show 2.x.x
```

---

### Week 1: Infrastructure Setup

**Goal**: Create DynamoDB table, API Gateway, and deploy first Lambda function

#### Step 1.1: Create Backend Project Structure

```bash
# Navigate to project root
cd creator-rate-guide-main

# Create backend directory
mkdir -p backend/src/handlers
mkdir -p backend/src/services
mkdir -p backend/src/models
mkdir -p backend/src/utils

# Create infrastructure directory for AWS CDK
mkdir infrastructure
```

#### Step 1.2: Initialize Backend (TypeScript + Lambda)

```bash
cd backend

# Initialize package.json
npm init -y

# Install dependencies
npm install @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb
npm install zod  # Validation library (already in frontend)

# Install dev dependencies
npm install -D @types/node @types/aws-lambda typescript esbuild
```

**Create `backend/tsconfig.json`**:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**Create `backend/package.json` scripts**:
```json
{
  "scripts": {
    "build": "tsc && esbuild src/handlers/*.ts --bundle --platform=node --outdir=dist/handlers",
    "watch": "tsc --watch"
  }
}
```

#### Step 1.3: Initialize AWS CDK Infrastructure

```bash
cd ../infrastructure

# Initialize CDK app
cdk init app --language typescript

# Install CDK libraries
npm install @aws-cdk/aws-dynamodb @aws-cdk/aws-lambda @aws-cdk/aws-apigateway @aws-cdk/aws-iam
```

#### Step 1.4: Create DynamoDB Table (CDK Code)

**Edit `infrastructure/lib/infrastructure-stack.ts`**:

```typescript
import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import { Construct } from 'constructs';

export class InfrastructureStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // DynamoDB Table
    const collaborationsTable = new dynamodb.Table(this, 'CollaborationsTable', {
      tableName: 'InfluencerCollaborations',
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,  // On-demand pricing
      removalPolicy: cdk.RemovalPolicy.RETAIN,  // Don't delete table on stack destroy
      pointInTimeRecovery: false,  // Enable later at scale
    });

    // GSI-1: Category Index (for ML algorithm)
    collaborationsTable.addGlobalSecondaryIndex({
      indexName: 'CategoryIndex',
      partitionKey: { name: 'creatorCategory', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'averageViews', type: dynamodb.AttributeType.NUMBER },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // GSI-2: Completed Collaborations Index
    collaborationsTable.addGlobalSecondaryIndex({
      indexName: 'CompletedCollabsIndex',
      partitionKey: { name: 'userIdHasActualData', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'dateCalculated', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // GSI-3: Creator Name Index
    collaborationsTable.addGlobalSecondaryIndex({
      indexName: 'CreatorNameIndex',
      partitionKey: { name: 'creatorNameLower', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'dateCalculated', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // Output table name for reference
    new cdk.CfnOutput(this, 'TableName', {
      value: collaborationsTable.tableName,
      description: 'DynamoDB table name',
    });
  }
}
```

#### Step 1.5: Deploy DynamoDB Table

```bash
# Bootstrap CDK (first time only)
cdk bootstrap

# Deploy the stack
cdk deploy

# When prompted, confirm: "Do you wish to deploy these changes (y/n)?" → y
```

**Expected output**:
```
✅ InfrastructureStack

Outputs:
InfrastructureStack.TableName = InfluencerCollaborations
```

**Verify in AWS Console**:
1. Go to [DynamoDB Console](https://console.aws.amazon.com/dynamodbv2/)
2. You should see table `InfluencerCollaborations` with 3 GSIs

---

### Week 2: Core Lambda Functions

**Goal**: Build and deploy all Lambda functions

#### Step 2.1: Create TypeScript Interfaces

**Create `backend/src/models/types.ts`**:

```typescript
export interface CollaborationData {
  id: string;
  creatorName: string;
  averageViews: number;
  lowestViews: number;
  targetCPM: number;
  projectedViews: number;
  recommendedPrice: number;
  confidence: number;
  reasoning: string;
  priceRangeMin: number;
  priceRangeMax: number;
  dateCalculated: string;  // ISO format
  actualViews?: number;
  actualPrice?: number;
  datePosted?: string;
  notes?: string;
  accuracy?: number;
  creatorCategory: 'micro' | 'mid' | 'macro';
  viewsRange: string;
  hasActualData: boolean;
  creatorNameLower: string;
}

export interface PredictionInput {
  averageViews: number;
  lowestViews: number;
  targetCPM: number;
}

export interface PredictionOutput {
  projectedViews: number;
  recommendedPrice: number;
  confidence: number;
  reasoning: string;
  priceRange: { min: number; max: number };
}
```

#### Step 2.2: Create DynamoDB Service

**Create `backend/src/services/dynamoService.ts`**:

```typescript
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
  UpdateCommand,
  DeleteCommand
} from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.TABLE_NAME || 'InfluencerCollaborations';

export const dynamoService = {
  async putItem(item: any) {
    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: item
    }));
    return item;
  },

  async queryByUserId(userId: string) {
    const result = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': `userId#${userId}`,
        ':sk': 'COLLAB#'
      },
      ScanIndexForward: false  // Newest first
    }));
    return result.Items || [];
  },

  async queryCompletedCollaborations(userId: string) {
    const result = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: 'CompletedCollabsIndex',
      KeyConditionExpression: 'userIdHasActualData = :pk',
      ExpressionAttributeValues: {
        ':pk': `userId#${userId}#true`
      },
      ScanIndexForward: false
    }));
    return result.Items || [];
  },

  async querySimilarCreators(category: string, minViews: number, maxViews: number) {
    const result = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: 'CategoryIndex',
      KeyConditionExpression: 'creatorCategory = :cat AND averageViews BETWEEN :min AND :max',
      FilterExpression: 'hasActualData = :true',
      ExpressionAttributeValues: {
        ':cat': category,
        ':min': minViews,
        ':max': maxViews,
        ':true': true
      }
    }));
    return result.Items || [];
  },

  // Add more methods as needed...
};
```

#### Step 2.3: Port ML Algorithm

**Create `backend/src/services/mlService.ts`**:

**Note**: This file should be ported from `src/utils/UnifiedDataService.ts` (lines 173-353). Key methods:
- `getSmartProjection()`
- `calculateDynamicCoefficients()`
- `findSimilarCreators()`
- `calculateWeightedPerformance()`
- `getTrendMultiplier()`

I'll provide a starter version:

```typescript
import { CollaborationData, PredictionOutput } from '../models/types';

export class MLService {
  static getSmartProjection(
    averageViews: number,
    lowestViews: number,
    completedCollaborations: CollaborationData[]
  ): PredictionOutput {

    if (completedCollaborations.length < 3) {
      // Fallback algorithm
      const projectedViews = Math.round((lowestViews * 0.7) + (averageViews * 0.3));
      return {
        projectedViews,
        confidence: 60,
        reasoning: "Using base algorithm (need more completed collaborations)"
      };
    }

    // Determine creator category
    const category = this.getCreatorCategory(averageViews);

    // Find similar creators
    // (Use dynamoService.querySimilarCreators() instead of filtering in-memory)

    // Calculate weighted performance, trend multiplier, etc.
    // (Port logic from UnifiedDataService.ts)

    // Return prediction
    return {
      projectedViews: 11100,  // Replace with actual calculation
      confidence: 85,
      reasoning: `${category} creator: optimized prediction`
    };
  }

  private static getCreatorCategory(averageViews: number): 'micro' | 'mid' | 'macro' {
    if (averageViews < 50000) return 'micro';
    if (averageViews < 500000) return 'mid';
    return 'macro';
  }

  // Add other methods from UnifiedDataService.ts
}
```

**TODO**: Complete porting the full ML algorithm logic.

#### Step 2.4: Create calculatePrediction Lambda

**Create `backend/src/handlers/calculatePrediction.ts`**:

```typescript
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { dynamoService } from '../services/dynamoService';
import { MLService } from '../services/mlService';
import { PredictionInput } from '../models/types';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const body: PredictionInput = JSON.parse(event.body || '{}');
    const { averageViews, lowestViews, targetCPM } = body;

    // Validate input
    if (!averageViews || !lowestViews || !targetCPM) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Missing required fields' })
      };
    }

    // Get completed collaborations from DynamoDB
    const completed = await dynamoService.queryCompletedCollaborations('global');

    // Run ML algorithm
    const prediction = MLService.getSmartProjection(averageViews, lowestViews, completed as any);

    // Calculate price
    const recommendedPrice = Math.round((prediction.projectedViews / 1000) * targetCPM);
    const rangeVariation = prediction.confidence > 75 ? 0.15 : 0.25;

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        ...prediction,
        recommendedPrice,
        priceRange: {
          min: Math.round(recommendedPrice * (1 - rangeVariation)),
          max: Math.round(recommendedPrice * (1 + rangeVariation))
        }
      })
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};
```

#### Step 2.5: Create createCollaboration Lambda

**Create `backend/src/handlers/createCollaboration.ts`**:

```typescript
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { dynamoService } from '../services/dynamoService';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const body = JSON.parse(event.body || '{}');

    const id = Date.now().toString();
    const now = new Date().toISOString();

    // Determine category and view range
    const { averageViews } = body;
    const creatorCategory = averageViews < 50000 ? 'micro' : averageViews < 500000 ? 'mid' : 'macro';
    const viewsRange = averageViews < 10000 ? '0-10K'
                      : averageViews < 50000 ? '10K-50K'
                      : averageViews < 100000 ? '50K-100K'
                      : averageViews < 500000 ? '100K-500K'
                      : '500K+';

    const item = {
      PK: 'userId#global',
      SK: `COLLAB#${now}#${id}`,
      id,
      ...body,
      creatorCategory,
      viewsRange,
      creatorNameLower: body.creatorName.toLowerCase(),
      hasActualData: false,
      dateCalculated: now,
      priceRangeMin: body.priceRange.min,
      priceRangeMax: body.priceRange.max
    };

    await dynamoService.putItem(item);

    return {
      statusCode: 201,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(item)
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};
```

#### Step 2.6: Add Lambda Functions to CDK Stack

**Edit `infrastructure/lib/infrastructure-stack.ts`** (add after DynamoDB table):

```typescript
// Lambda Layer for shared dependencies
const dependenciesLayer = new lambda.LayerVersion(this, 'DependenciesLayer', {
  code: lambda.Code.fromAsset('../backend/node_modules'),
  compatibleRuntimes: [lambda.Runtime.NODEJS_18_X],
});

// calculatePrediction Lambda
const calculatePredictionFn = new lambda.Function(this, 'CalculatePrediction', {
  runtime: lambda.Runtime.NODEJS_18_X,
  handler: 'calculatePrediction.handler',
  code: lambda.Code.fromAsset('../backend/dist/handlers'),
  environment: {
    TABLE_NAME: collaborationsTable.tableName
  },
  timeout: cdk.Duration.seconds(30),
  memorySize: 1024,
});

// Grant DynamoDB read access
collaborationsTable.grantReadData(calculatePredictionFn);

// createCollaboration Lambda
const createCollaborationFn = new lambda.Function(this, 'CreateCollaboration', {
  runtime: lambda.Runtime.NODEJS_18_X,
  handler: 'createCollaboration.handler',
  code: lambda.Code.fromAsset('../backend/dist/handlers'),
  environment: {
    TABLE_NAME: collaborationsTable.tableName
  },
  timeout: cdk.Duration.seconds(10),
  memorySize: 512,
});

// Grant DynamoDB write access
collaborationsTable.grantWriteData(createCollaborationFn);

// API Gateway
const api = new apigateway.RestApi(this, 'InfluencerRatesAPI', {
  restApiName: 'Influencer Rates API',
  defaultCorsPreflightOptions: {
    allowOrigins: apigateway.Cors.ALL_ORIGINS,  // Restrict in production
    allowMethods: apigateway.Cors.ALL_METHODS,
  },
});

// /predictions/calculate endpoint
const predictions = api.root.addResource('predictions');
const calculate = predictions.addResource('calculate');
calculate.addMethod('POST', new apigateway.LambdaIntegration(calculatePredictionFn));

// /collaborations endpoint
const collaborations = api.root.addResource('collaborations');
collaborations.addMethod('POST', new apigateway.LambdaIntegration(createCollaborationFn));

// Output API URL
new cdk.CfnOutput(this, 'ApiUrl', {
  value: api.url,
  description: 'API Gateway URL',
});
```

#### Step 2.7: Build and Deploy

```bash
# Build Lambda functions
cd ../backend
npm run build

# Deploy infrastructure
cd ../infrastructure
cdk deploy
```

**Expected output**:
```
✅ InfrastructureStack

Outputs:
InfrastructureStack.ApiUrl = https://abc123xyz.execute-api.us-east-1.amazonaws.com/prod/
InfrastructureStack.TableName = InfluencerCollaborations
```

#### Step 2.8: Test API with Postman

**Test calculatePrediction**:
```bash
POST https://abc123xyz.execute-api.us-east-1.amazonaws.com/prod/predictions/calculate
Content-Type: application/json

{
  "averageViews": 15000,
  "lowestViews": 8000,
  "targetCPM": 20
}
```

**Expected response**:
```json
{
  "projectedViews": 11100,
  "confidence": 60,
  "reasoning": "Using base algorithm (need more completed collaborations)",
  "recommendedPrice": 222,
  "priceRange": { "min": 167, "max": 278 }
}
```

**Test createCollaboration**:
```bash
POST https://abc123xyz.execute-api.us-east-1.amazonaws.com/prod/collaborations
Content-Type: application/json

{
  "creatorName": "test_influencer",
  "averageViews": 15000,
  "lowestViews": 8000,
  "targetCPM": 20,
  "projectedViews": 11100,
  "recommendedPrice": 222,
  "confidence": 60,
  "reasoning": "test",
  "priceRange": { "min": 167, "max": 278 }
}
```

---

### Week 3: Frontend Integration

**Goal**: Update frontend to call API instead of localStorage

#### Step 3.1: Create API Client

**Create `src/api/collaborationsApi.ts`**:

```typescript
const API_BASE = import.meta.env.VITE_API_URL || '';

export const collaborationsApi = {
  async calculatePrediction(input: {
    averageViews: number;
    lowestViews: number;
    targetCPM: number;
  }) {
    const response = await fetch(`${API_BASE}/predictions/calculate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input)
    });

    if (!response.ok) throw new Error('Prediction failed');
    return response.json();
  },

  async create(data: any) {
    const response = await fetch(`${API_BASE}/collaborations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (!response.ok) throw new Error('Create failed');
    return response.json();
  },

  async getAll() {
    const response = await fetch(`${API_BASE}/collaborations`);
    if (!response.ok) throw new Error('Fetch failed');
    return response.json();
  },

  // Add other methods...
};
```

#### Step 3.2: Create Environment File

**Create `.env.local`** in project root:

```
VITE_API_URL=https://abc123xyz.execute-api.us-east-1.amazonaws.com/prod
VITE_USE_CLOUD_BACKEND=true
```

#### Step 3.3: Update PricingCalculator

**Modify `src/components/PricingCalculator.tsx`** (line 52-83):

```typescript
const calculatePricing = async () => {
  const avgViews = parseFloat(averageViews);
  const lowViews = parseFloat(lowestViews);
  const cpm = parseFloat(targetCPM);

  if (!avgViews || !lowViews || !cpm) return;

  // Call API instead of local algorithm
  const prediction = await collaborationsApi.calculatePrediction({
    averageViews: avgViews,
    lowestViews: lowViews,
    targetCPM: cpm
  });

  setResults({
    averageViews: avgViews,
    lowestViews: lowViews,
    targetCPM: cpm,
    ...prediction
  });
};
```

#### Step 3.4: Update UnifiedDataService

**Modify `src/utils/UnifiedDataService.ts`**:

```typescript
import { collaborationsApi } from '@/api/collaborationsApi';

export class UnifiedDataService {
  private static USE_CLOUD = import.meta.env.VITE_USE_CLOUD_BACKEND === 'true';

  static async saveCalculation(data: Omit<CollaborationData, 'id' | 'dateCalculated'>): Promise<CollaborationData> {
    if (this.USE_CLOUD) {
      // Save to cloud
      const result = await collaborationsApi.create(data);
      // Also cache in localStorage
      this.saveToLocalStorage(result);
      return result;
    } else {
      // Original localStorage logic
      return this.saveToLocalStorageOnly(data);
    }
  }

  static async getCollaborations(): Promise<CollaborationData[]> {
    if (this.USE_CLOUD) {
      try {
        const { items } = await collaborationsApi.getAll();
        return items;
      } catch (error) {
        console.error('Cloud fetch failed, using localStorage:', error);
        return this.getFromLocalStorage();
      }
    } else {
      return this.getFromLocalStorage();
    }
  }

  // Keep localStorage methods as fallback
  private static saveToLocalStorage(data: CollaborationData) {
    // Existing localStorage save logic
  }

  private static getFromLocalStorage(): CollaborationData[] {
    // Existing localStorage get logic
  }
}
```

#### Step 3.5: Test Frontend

```bash
npm run dev
```

Navigate to `http://localhost:5173`:
1. Enter creator data
2. Click "Calculate" (should call API)
3. Click "Save" (should save to DynamoDB)
4. Check browser Network tab to confirm API calls

---

### Week 4: Migration & Production Deployment

**Goal**: Migrate localStorage data and deploy to production

#### Step 4.1: Create Migration Tool

**Create `src/utils/migrateToCloud.ts`**:

```typescript
import { UnifiedDataService } from './UnifiedDataService';
import { collaborationsApi } from '@/api/collaborationsApi';

export async function migrateLocalStorageToCloud() {
  const localData = UnifiedDataService.getFromLocalStorage();

  console.log(`Migrating ${localData.length} collaborations to cloud...`);

  for (const item of localData) {
    try {
      await collaborationsApi.create(item);
      console.log(`✓ Migrated: ${item.creatorName}`);
    } catch (error) {
      console.error(`✗ Failed: ${item.creatorName}`, error);
    }
  }

  console.log('Migration complete!');
}
```

#### Step 4.2: Add Migration Button to UI

**Add to `src/components/UnifiedCollaborationHistory.tsx`**:

```typescript
import { migrateLocalStorageToCloud } from '@/utils/migrateToCloud';

// Inside component:
const handleMigrate = async () => {
  toast({ title: "Migrating data to cloud..." });
  await migrateLocalStorageToCloud();
  toast({ title: "Migration complete!" });
};

// In JSX:
<Button onClick={handleMigrate}>
  Migrate to Cloud
</Button>
```

#### Step 4.3: Complete Remaining Lambda Functions

**TODO**: Implement these Lambda handlers:
- `getCollaborations.ts` (GET list)
- `updateCollaboration.ts` (PATCH with actual results)
- `deleteCollaboration.ts` (DELETE by ID)
- `searchCollaborations.ts` (search by creator name)
- `getInsights.ts` (analytics)

**Add to CDK stack** and redeploy:
```bash
cd infrastructure
cdk deploy
```

#### Step 4.4: Production Checklist

- [ ] Test all API endpoints
- [ ] Migrate localStorage data
- [ ] Set up CloudWatch alarms (error rate > 5%)
- [ ] Configure custom domain (optional)
- [ ] Restrict CORS to your domain only
- [ ] Enable DynamoDB backups
- [ ] Document API for team

---

## Cost Analysis

### Table: `InfluencerCollaborations`

**Configuration**:
- Billing Mode: **On-Demand** (pay per request, no provisioned capacity)
- Encryption: AWS-managed (SSE)
- Point-in-Time Recovery: Disabled initially (enable at scale)

**Primary Key**:
```
PK (Partition Key): userId#<userId>    // "userId#global" for now
SK (Sort Key): COLLAB#<timestamp>#<id>  // Enables chronological sorting
```

**Full Schema**:
```typescript
{
  // Keys
  PK: "userId#global",
  SK: "COLLAB#2025-12-03T10:30:00Z#1701598200000",

  // Core data
  id: "1701598200000",
  creatorName: "influencer_name",
  averageViews: 15000,
  lowestViews: 8000,
  targetCPM: 20,

  // Prediction data
  projectedViews: 11100,
  recommendedPrice: 222,
  confidence: 85,
  reasoning: "mid creator: 5 similar matches...",
  priceRangeMin: 188,
  priceRangeMax: 256,
  dateCalculated: "2025-12-03T10:30:00Z",

  // Actual results (optional)
  actualViews: 12500,
  actualPrice: 250,
  datePosted: "2025-12-10T00:00:00Z",
  notes: "Great engagement",
  accuracy: 88.74,

  // Query optimization
  creatorCategory: "mid",              // micro/mid/macro
  viewsRange: "10K-50K",              // For analytics
  hasActualData: true,                // Boolean for filtering
  creatorNameLower: "influencer_name" // Case-insensitive search
}
```

### Global Secondary Indexes (GSIs)

**GSI-1: CategoryIndex**
- PK: `creatorCategory` (micro/mid/macro)
- SK: `averageViews` (number)
- Purpose: Find similar creators by category for ML algorithm
- Example query: "Find all 'mid' creators with 12K-18K average views"

**GSI-2: CompletedCollabsIndex**
- PK: `userId#hasActualData` (e.g., "userId#global#true")
- SK: `dateCalculated` (ISO string)
- Purpose: Query only completed collaborations with recency weighting
- Example query: "Get all completed collaborations sorted by date"

**GSI-3: CreatorNameIndex**
- PK: `creatorNameLower`
- SK: `dateCalculated`
- Purpose: Search by creator name, get history for that creator
- Example query: "Find all calculations for @influencer_name"

---

## API Design

### Base URL
```
Production:  https://api.influencer-rates.com/v1
Development: https://dev-api.influencer-rates.com/v1
```

### REST Endpoints

#### 1. **POST /collaborations**
Create new collaboration calculation

Request:
```json
{
  "creatorName": "influencer_name",
  "averageViews": 15000,
  "lowestViews": 8000,
  "targetCPM": 20,
  "projectedViews": 11100,
  "recommendedPrice": 222,
  "confidence": 85,
  "reasoning": "mid creator: 5 similar matches...",
  "priceRange": { "min": 188, "max": 256 }
}
```

Response (201 Created):
```json
{
  "id": "1701598200000",
  "dateCalculated": "2025-12-03T10:30:00Z",
  ...allRequestData
}
```

#### 2. **GET /collaborations**
Retrieve all collaborations

Query params:
- `?limit=50` (default 100, max 500)
- `?cursor=<token>` (pagination)
- `?hasActualData=true` (filter completed only)

Response (200 OK):
```json
{
  "items": [...],
  "nextCursor": "base64encodedtoken",
  "count": 30
}
```

#### 3. **GET /collaborations/{id}**
Get single collaboration by ID

Response (200 OK): Full collaboration object

#### 4. **PATCH /collaborations/{id}**
Update collaboration (add actual results)

Request:
```json
{
  "actualViews": 12500,
  "actualPrice": 250,
  "datePosted": "2025-12-10",
  "notes": "Great engagement"
}
```

Response (200 OK): Updated collaboration with auto-calculated accuracy

#### 5. **DELETE /collaborations/{id}**
Delete collaboration

Response (204 No Content)

#### 6. **GET /collaborations/search?creator=name**
Search by creator name

Response (200 OK): List of matching collaborations

#### 7. **POST /predictions/calculate**
ML calculation endpoint (client calls before saving)

Request:
```json
{
  "averageViews": 15000,
  "lowestViews": 8000,
  "targetCPM": 20
}
```

Response (200 OK):
```json
{
  "projectedViews": 11100,
  "recommendedPrice": 222,
  "confidence": 85,
  "reasoning": "mid creator: 5 similar matches...",
  "priceRange": { "min": 188, "max": 256 }
}
```

#### 8. **GET /analytics/insights**
Get analytics and insights

Response (200 OK):
```json
{
  "totalCollaborations": 30,
  "completedCollaborations": 15,
  "averageAccuracy": 87.5,
  "bestPerformingRange": "10K-50K",
  "topPerformingCreators": [...],
  "recommendations": [...]
}
```

---

## Lambda Functions

### Backend Structure
```
/backend
├── /src
│   ├── /handlers
│   │   ├── createCollaboration.ts
│   │   ├── getCollaborations.ts
│   │   ├── updateCollaboration.ts
│   │   ├── deleteCollaboration.ts
│   │   ├── searchCollaborations.ts
│   │   ├── calculatePrediction.ts
│   │   └── getInsights.ts
│   ├── /services
│   │   ├── dynamoService.ts      // DynamoDB operations
│   │   ├── mlService.ts          // ML algorithm (port from UnifiedDataService)
│   │   ├── validationService.ts  // Zod schemas
│   │   └── analyticsService.ts   // Insights calculation
│   ├── /models
│   │   └── types.ts              // TypeScript interfaces
│   └── /utils
│       ├── response.ts           // API response helpers
│       └── errors.ts             // Custom errors
├── package.json
├── tsconfig.json
└── infrastructure/               // AWS CDK code
```

### Key Functions

**1. calculatePrediction Lambda** (Most Important)
- **Memory**: 1024 MB (ML calculations need more)
- **Timeout**: 30s
- **Purpose**: Run ML algorithm server-side
- **Logic**: Port `UnifiedDataService.getSmartProjection()` from frontend
- **Queries**: Uses GSI-1 to find similar creators efficiently

**2. createCollaboration Lambda**
- **Memory**: 512 MB
- **Timeout**: 10s
- **Purpose**: Save new collaboration to DynamoDB
- **Logic**: Validate input, add computed fields (category, viewsRange), save to table

**3. getCollaborations Lambda**
- **Memory**: 256 MB
- **Timeout**: 10s
- **Purpose**: List all collaborations with pagination
- **Logic**: Query by PK, support cursor pagination

**4. updateCollaboration Lambda**
- **Memory**: 256 MB
- **Timeout**: 10s
- **Purpose**: Update collaboration with actual results
- **Logic**: Auto-calculate accuracy when actualViews is added

**5. getInsights Lambda**
- **Memory**: 512 MB
- **Timeout**: 30s
- **Purpose**: Calculate analytics and insights
- **Logic**: Port `UnifiedDataService.getInsights()` from frontend

### ML Service (Critical Component)

**Port from**: `src/utils/UnifiedDataService.ts` (lines 173-353)

**Key Algorithm Features**:
- **Dynamic Coefficients**: Learns optimal lowest/average view ratios per category
- **Similar Creator Matching**: Finds creators with ±20% or ±40% variance
- **Weighted Performance**: Applies recency bias (12-month decay) and accuracy weighting
- **Trend Analysis**: Compares recent 3 vs older 3 collaborations
- **Confidence Scoring**: 60-95% based on data availability

**DynamoDB Query Optimization**:
```typescript
// Use CategoryIndex GSI for efficient similar creator lookup
const similarCreators = await dynamodb.query({
  TableName: 'InfluencerCollaborations',
  IndexName: 'CategoryIndex',
  KeyConditionExpression: 'creatorCategory = :cat AND averageViews BETWEEN :min AND :max',
  FilterExpression: 'hasActualData = :true',
  ExpressionAttributeValues: {
    ':cat': 'mid',
    ':min': 12000,  // ±20% or ±40% of input
    ':max': 18000,
    ':true': true
  }
});
```

---

## Frontend Changes

### Files to Modify

**1. Create API Client** (`src/api/collaborationsApi.ts` - NEW FILE)
```typescript
const API_BASE = import.meta.env.VITE_API_URL;

export const collaborationsApi = {
  async create(data: CreateCollaborationInput) {
    const response = await fetch(`${API_BASE}/collaborations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return response.json();
  },

  async getAll() {
    const response = await fetch(`${API_BASE}/collaborations`);
    return response.json();
  },

  async calculatePrediction(input: PredictionInput) {
    const response = await fetch(`${API_BASE}/predictions/calculate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input)
    });
    return response.json();
  },

  // ... other methods
};
```

**2. Update UnifiedDataService** (`src/utils/UnifiedDataService.ts`)
- Add cloud mode flag: `USE_CLOUD = import.meta.env.VITE_USE_CLOUD_BACKEND === 'true'`
- Modify `saveCalculation()` to call API when USE_CLOUD is true
- Modify `getCollaborations()` to fetch from API
- Keep localStorage as fallback/cache

**3. Update PricingCalculator** (`src/components/PricingCalculator.tsx`)
- Change line 60: Call API `/predictions/calculate` instead of local `getSmartProjection()`
- Keep UI exactly the same (no changes needed)
- Add loading states for API calls

**4. Add React Query Hooks** (`src/hooks/useCollaborations.ts` - NEW FILE)
```typescript
export const useCollaborations = () => {
  const { data, isLoading } = useQuery({
    queryKey: ['collaborations'],
    queryFn: collaborationsApi.getAll,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const createMutation = useMutation({
    mutationFn: collaborationsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collaborations'] });
    }
  });

  return { collaborations: data?.items || [], isLoading, createCollaboration: createMutation.mutate };
};
```

**5. Environment Variables** (`.env` - NEW FILE)
```
VITE_API_URL=https://api.influencer-rates.com/v1
VITE_USE_CLOUD_BACKEND=true
```

---

## Migration Strategy

### Phase 1A: Dual-Mode Operation (Week 1-2)

**Goal**: Allow users to optionally sync localStorage to cloud

1. Deploy backend infrastructure (DynamoDB + Lambda + API Gateway)
2. Add API client layer to frontend
3. Implement hybrid mode: Try cloud first, fall back to localStorage
4. Add "Migrate to Cloud" button in UI (one-time upload of all localStorage data)

### Phase 1B: Cloud-First (Week 3)

**Goal**: Default to cloud, localStorage as cache only

1. Set `VITE_USE_CLOUD_BACKEND=true`
2. localStorage becomes read-only cache
3. All writes go to API
4. Show warning banner if localStorage detected but not migrated

### Phase 1C: Cloud-Only (Month 2)

**Goal**: Remove localStorage completely

1. Remove all localStorage code
2. Pure API-based data layer
3. React Query handles all caching

---

## Security

### Phase 1 (No Authentication)

**API Gateway**:
- Rate limiting: 1000 requests/hour per IP
- CORS: Only allow your frontend domain
- Request validation: Validate all inputs against JSON schemas

**Lambda IAM Roles**:
- Principle of least privilege
- Only grant DynamoDB table access (no S3, no SES, etc.)

**Input Validation**:
- Use Zod schemas in Lambda functions
- Sanitize all user inputs
- Validate number ranges (views < 1B, CPM < $10K)

**DynamoDB**:
- Enable encryption at rest (AWS-managed keys)
- Weekly on-demand backups (free tier)

### Phase 3 (Multi-Tenant with Auth)

**AWS Cognito**:
- User pools for authentication
- JWT tokens in Authorization header
- Custom attributes: agencyId, role

**API Gateway Authorizer**:
- Cognito User Pool authorizer
- Extract userId from JWT claims
- All queries filtered by userId

**Row-Level Security**:
- Change PK from `userId#global` to `userId#<actualUserId>`
- Lambda middleware extracts userId from JWT
- All DynamoDB queries scoped to user's data

---

## Cost Estimates

### At 1 User, 30 Records/Month (Current)

| Service | Usage | Cost/Month |
|---------|-------|------------|
| API Gateway | 300 requests | $0.001 |
| Lambda | 300 invocations, 500ms avg, 512MB | $0.00001 |
| DynamoDB | 30 writes, 300 reads, 0.001 GB | **FREE** |
| CloudWatch Logs | 0.1 GB | **FREE** |
| Data Transfer | 1 GB | **FREE** |
| **TOTAL** | | **~$0.001/month** |

**Key Point**: At this scale, you'll stay in AWS free tier for 12+ months. Essentially $0/month.

### At 100 Users, 3,000 Records/Month (Year 1 Goal)

| Service | Usage | Cost/Month |
|---------|-------|------------|
| API Gateway | 30,000 requests | $0.11 |
| Lambda | 30,000 invocations | $0.10 |
| DynamoDB | 3,000 writes, 30,000 reads, 0.1 GB | $0.38 |
| CloudWatch | 5 GB logs | $0.25 |
| Data Transfer | 10 GB | $0.90 |
| **TOTAL** | | **$1.74/month** |

### At 1,000 Users (SaaS Scale)

| Service | Usage | Cost/Month |
|---------|-------|------------|
| API Gateway | 300,000 requests | $1.05 |
| Lambda | 300,000 invocations | $1.00 |
| DynamoDB | 30,000 writes, 300,000 reads, 1 GB | $3.75 |
| Cognito (auth) | 1,000 MAU | **FREE** |
| CloudWatch | 50 GB logs | $2.50 |
| Data Transfer | 100 GB | $9.00 |
| **TOTAL** | | **$17.30/month** |

**Cost Optimization**:
- Use Lambda ARM64 (20% cheaper)
- Set CloudWatch log retention to 7 days
- Consider HTTP API instead of REST API (70% cheaper)
- DynamoDB on-demand perfect for unpredictable load

---

## Implementation Phases

### **Phase 1: MVP Backend (Weeks 1-4)**

**Week 1: Infrastructure Setup**
- [ ] Set up AWS CDK project
- [ ] Create DynamoDB table with 3 GSIs
- [ ] Configure API Gateway (REST API)
- [ ] Set up IAM roles and policies
- [ ] Deploy initial Lambda functions (create, read)

**Week 2: Core Lambda Functions**
- [ ] Implement all CRUD operations (create, read, update, delete, search)
- [ ] Port ML algorithm to `mlService.ts` (from `UnifiedDataService.ts`)
- [ ] Add Zod validation schemas
- [ ] Implement error handling
- [ ] Test all endpoints with Postman

**Week 3: Frontend Integration**
- [ ] Create API client layer (`src/api/collaborationsApi.ts`)
- [ ] Implement hybrid DataService (localStorage + cloud)
- [ ] Add React Query hooks (`src/hooks/useCollaborations.ts`)
- [ ] Update `PricingCalculator.tsx` to call API
- [ ] Add loading states and error handling
- [ ] Test dual-mode operation

**Week 4: Migration & Testing**
- [ ] Add "Migrate to Cloud" button in UI
- [ ] Implement one-time localStorage upload
- [ ] End-to-end testing (create, update, calculate, analytics)
- [ ] Performance testing (Lambda cold starts, query speed)
- [ ] Deploy to production
- [ ] Monitor CloudWatch metrics

**Deliverables**:
✅ Fully functional serverless backend
✅ Frontend using cloud API
✅ Migration path from localStorage
✅ Cost: ~$0/month (free tier)

---

### **Phase 2: Social Media Integration (Months 2-3)**

**Goal**: Auto-scrape Instagram, TikTok, YouTube profiles

**New Services**:
- Instagram scraper Lambda (Instagram Basic Display API)
- TikTok scraper Lambda (TikTok Business API)
- YouTube scraper Lambda (YouTube Data API v3)
- EventBridge scheduled rules (daily scraping)
- SQS queue for batch processing

**New DynamoDB Table**: `SocialProfiles`
```typescript
{
  PK: "userId#global",
  SK: "PROFILE#instagram#username",
  platform: "instagram" | "tiktok" | "youtube",
  username: string,
  lastScraped: timestamp,
  metrics: { followers, avgViews, engagementRate }
}
```

**API Endpoints**:
- `POST /scraper/extract` - Scrape profile on-demand
- `GET /profiles` - List saved profiles

**Cost Impact**: +$2-5/month (API calls + longer Lambda duration)

**Defer to Phase 3**: Real-time scraping, webhook integrations

---

### **Phase 3: Multi-Tenant SaaS (Months 4-6)**

**Goal**: User authentication, agency seats, billing

**New Services**:
- AWS Cognito (user authentication)
- Stripe integration (subscriptions)
- User management Lambdas

**Data Model Changes**:
- Change `userId#global` → `userId#<actualUserId>`
- Add `agencyId` attribute for team collaboration
- Update all GSIs to include userId scoping

**New DynamoDB Tables**:

`Users`:
```typescript
{
  PK: "USER#<userId>",
  email: string,
  agencyId?: string,
  role: "owner" | "admin" | "member",
  tier: "free" | "pro" | "agency"
}
```

`Agencies`:
```typescript
{
  PK: "AGENCY#<agencyId>",
  name: string,
  tier: "agency",
  seatLimit: number,
  members: string[] // userIds
}
```

**API Changes**:
- Add JWT authorization to all endpoints
- Filter all queries by userId (from JWT claims)
- Add agency-level endpoints (`/agencies/{id}/analytics`)

**Cost Impact**: +$0/month initially (Cognito free for 50K MAU)

---

## Deployment Strategy

### Infrastructure as Code (AWS CDK)

**Install CDK**:
```bash
npm install -g aws-cdk
cdk init app --language typescript
```

**Deploy**:
```bash
cd backend
npm run build
cd ../infrastructure
cdk deploy --profile your-aws-profile
```

### CI/CD Pipeline (GitHub Actions)

```yaml
# .github/workflows/deploy.yml
name: Deploy to AWS

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: 18
      - name: Build Lambda functions
        run: cd backend && npm ci && npm run build
      - name: Deploy to AWS
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
        run: cd infrastructure && npm ci && cdk deploy --require-approval never
```

---

## Monitoring & Observability

### CloudWatch Dashboards

**Lambda Metrics**:
- Invocation count, error rate, duration (p50/p95/p99)
- Cold start frequency
- Throttles

**DynamoDB Metrics**:
- Consumed read/write capacity
- Throttled requests
- Query latency

**API Gateway Metrics**:
- Request count by endpoint
- 4xx/5xx error rates
- Latency

### Custom Metrics

Track ML-specific metrics:
- Prediction accuracy over time
- ML confidence scores by category
- Similar creator match rates

### Alarms

Set up alarms for:
- Lambda error rate > 5 in 1 minute
- API Gateway 5xx rate > 1%
- DynamoDB throttling > 0

---

## Critical Files to Modify

### Backend (New Files)

1. **`/backend/src/services/mlService.ts`** - Port ML algorithm from frontend
   - Source: `src/utils/UnifiedDataService.ts` (lines 173-353)
   - Key methods: `getSmartProjection()`, `calculateDynamicCoefficients()`, `findSimilarCreators()`

2. **`/backend/src/handlers/calculatePrediction.ts`** - Prediction endpoint
   - Queries DynamoDB for completed collaborations
   - Calls `mlService.calculateSmartProjection()`
   - Returns prediction with confidence score

3. **`/infrastructure/lib/stack.ts`** - AWS CDK infrastructure code
   - DynamoDB table with 3 GSIs
   - 6 Lambda functions
   - API Gateway with CORS

### Frontend (Modify Existing)

4. **`src/utils/UnifiedDataService.ts`** - Add cloud mode
   - Lines 32-44: Modify `saveCalculation()` to call API
   - Lines 46-66: Modify `getCollaborations()` to fetch from API
   - Lines 173-236: Move `getSmartProjection()` logic to backend (keep as fallback)

5. **`src/components/PricingCalculator.tsx`** - Call API for predictions
   - Line 60: Change to `await collaborationsApi.calculatePrediction()`
   - Line 106: Change to `await collaborationsApi.create()`
   - Add loading states

6. **`src/api/collaborationsApi.ts`** - NEW: API client layer
   - Implement all REST endpoint calls
   - Error handling and retry logic

7. **`src/hooks/useCollaborations.ts`** - NEW: React Query hooks
   - `useCollaborations()` - List all
   - `useCreateCollaboration()` - Create mutation
   - `useUpdateCollaboration()` - Update mutation

---

## Risks & Mitigation

### Risk 1: Lambda Cold Starts
- **Impact**: 1-2 second delay on first request
- **Mitigation**: Use provisioned concurrency at scale, ARM64 for faster starts, keep functions warm with EventBridge

### Risk 2: DynamoDB Throttling
- **Impact**: Failed requests when scaling
- **Mitigation**: Start with on-demand, monitor metrics, switch to provisioned at predictable scale

### Risk 3: API Gateway Costs at Scale
- **Impact**: $3.50 per million requests
- **Mitigation**: Switch to HTTP API (70% cheaper) when ready, implement caching

### Risk 4: Social Media API Rate Limits (Phase 2)
- **Impact**: Can't scrape more than X profiles/day
- **Mitigation**: Implement queue system, batch processing, user quota management

### Risk 5: Multi-Tenant Data Isolation (Phase 3)
- **Impact**: Data leaks between agencies
- **Mitigation**: Implement row-level security in Lambda, test access control extensively, audit logs

---

## Success Metrics

### Phase 1 (MVP)
- [ ] All localStorage data successfully migrated to DynamoDB
- [ ] API response time < 500ms (p95)
- [ ] Zero data loss during migration
- [ ] ML algorithm accuracy matches frontend (±2%)
- [ ] Monthly AWS cost < $0.10

### Phase 2 (Social Media)
- [ ] Auto-scraping works for Instagram, TikTok, YouTube
- [ ] Scraping success rate > 80%
- [ ] Time saved per calculation > 5 minutes

### Phase 3 (Multi-Tenant)
- [ ] 10+ agencies onboarded
- [ ] Zero security incidents
- [ ] Authentication uptime > 99.9%
- [ ] Positive user feedback on team collaboration

---

## MENTOR Q&A PREP

### Questions Your Mentor Will Likely Ask

#### **1. Architecture & Design**

**Q: "Walk me through the architecture - how do the pieces fit together?"**

A: We're using a serverless architecture on AWS:
1. React frontend makes REST API calls to API Gateway
2. API Gateway triggers Lambda functions (TypeScript)
3. Lambdas interact with DynamoDB (NoSQL database)
4. DynamoDB has 3 Global Secondary Indexes for efficient querying

The flow is: User enters data → Frontend calls `/predictions/calculate` → Lambda queries historical data from DynamoDB → ML algorithm runs → Returns prediction → User saves → Another Lambda writes to DynamoDB

Everything is serverless, so we only pay for what we use. At our current scale (1 user, 30 records/month), we'll stay in the free tier.

---

**Q: "Why DynamoDB over RDS/PostgreSQL?"**

A: Three reasons:
1. **Flexible schema** - Our data model is still evolving. DynamoDB lets us add fields without migrations.
2. **Serverless** - True pay-per-request pricing. RDS has a minimum $15/month cost even with Aurora Serverless.
3. **Scalability** - When we hit thousands of users, DynamoDB scales automatically without tuning.

The trade-off is we lose SQL joins and complex queries, but our access patterns are simple (get by user, query by category, search by name). DynamoDB's GSIs handle all our use cases.

---

**Q: "What are your access patterns? How did you design the table?"**

A: We have 5 main access patterns:
1. Get all collaborations for a user (sorted by date)
2. Find similar creators by category + view range (for ML)
3. Get completed collaborations with actual results
4. Search by creator name
5. Get insights/analytics across all data

I designed the primary table with PK=userId, SK=timestamp. Then added 3 GSIs:
- **CategoryIndex**: Query by creator category (micro/mid/macro) + average views
- **CompletedCollabsIndex**: Filter to only completed collabs, sorted by date
- **CreatorNameIndex**: Search by creator name

This gives us efficient queries without table scans.

---

#### **2. Scalability & Performance**

**Q: "What happens when you get 10,000 users? What breaks first?"**

A: Let me break down the bottlenecks:

**What scales automatically**:
- DynamoDB (on-demand mode handles any read/write load)
- Lambda (auto-scales to 1000 concurrent executions)
- API Gateway (handles millions of requests)

**What might break**:
1. **Lambda cold starts** - First request after idle takes 1-2 seconds. Solution: Provisioned concurrency (keeps 2-5 instances warm) costs ~$10/month.
2. **DynamoDB costs** - At 10K users doing 30 calcs/month = 300K writes/month = $375/month. Solution: Switch to provisioned capacity (cheaper at predictable load).
3. **API Gateway costs** - $3.50 per million requests. At scale, switch to HTTP API (70% cheaper).

**First to optimize**: I'd add CloudFront CDN for frontend ($1/month) and implement API response caching.

---

**Q: "How are you handling concurrent writes to DynamoDB?"**

A: DynamoDB handles concurrency natively with its distributed architecture. Each write gets a unique partition key (userId + timestamp + unique ID), so there are no write conflicts.

For updates (like adding actual results to a prediction), we use conditional updates with the full item key (PK + SK). If two users somehow try to update the same item, DynamoDB handles it with optimistic locking.

The only concurrency concern is read-after-write consistency, but since all our writes go to the same partition key, DynamoDB guarantees immediate consistency.

---

**Q: "What's your read/write capacity planning?"**

A: We're starting with **on-demand pricing** because:
1. Unpredictable load at this stage
2. Very low volume (30 writes, 300 reads/month)
3. No upfront capacity planning needed

At ~1,000 users (30K writes, 300K reads/month), we'd switch to **provisioned capacity**:
- Writes: 12 WCUs (1 per second avg, $0.60/month)
- Reads: 120 RCUs (10 per second avg, $0.60/month)
- Auto-scaling: Scale up to 100 WCU / 500 RCU on spikes

This would cost ~$1.20/month vs $38 on-demand. The break-even point is around 500 users."

---

#### **3. Cost & Economics**

**Q: "What's your estimated monthly AWS cost at 100 users? 1,000 users?"**

A:
- **1 user (current)**: $0.001/month (essentially free, within free tier)
- **100 users**: $1.74/month (mostly DynamoDB + data transfer)
- **1,000 users**: $17.30/month (still cheap, DynamoDB becomes majority)

**Breakdown at 1,000 users**:
- DynamoDB: $3.75 (30K writes, 300K reads)
- Lambda: $1.00 (300K invocations)
- API Gateway: $1.05 (300K requests)
- Data Transfer: $9.00 (100 GB out)
- CloudWatch: $2.50 (logs)

**Cost per user**: $0.017/month = **$0.20/year per user**

Even if we 10x this for overhead, we're at $2/user/year. If we charge $10/month per seat, margins are great."

---

**Q: "How does cost scale with usage?"**

A:Almost perfectly linear until we hit AWS free tier limits:
- Free tier covers first 1M API requests/month
- First 25GB DynamoDB storage is free
- First 1M Lambda requests/month are free

So we stay near $0 until ~100 users. After that:
- Every 1,000 users adds ~$17/month
- Every 10,000 users adds ~$170/month

The beautiful thing is there's no fixed cost. If we get zero users next month, AWS bill is $0. If we explode to 100K users overnight, it works (just costs $1,700/month).

Compare to running an EC2 server: $30/month minimum even with zero users."

---

#### **4. Security**

**Q: "How are you securing the API endpoints?"**

A:**Phase 1 (now - no auth)**:
- Rate limiting: 1,000 requests/hour per IP (prevents abuse)
- CORS: Only allow our frontend domain (no cross-origin attacks)
- Request validation: JSON schema validation on all inputs
- Input sanitization: Zod validation, reject invalid data
- DDoS protection: API Gateway has built-in AWS Shield

**Phase 3 (multi-tenant)**:
- Add AWS Cognito authentication
- API Gateway Cognito authorizer (validates JWT tokens)
- Every request requires valid token
- Lambda extracts userId from JWT claims
- All DynamoDB queries filtered by userId (row-level security)

We're OK without auth initially because:
1. No sensitive data (just influencer metrics, no PII)
2. Rate limiting prevents abuse
3. Data is meant to be shared (collective learning)
4. Only 1 user (you) has the URL"

---

**Q: "Where are you storing social media API keys?"**

A:**Phase 2** (when we add scraping):
- API keys stored in **AWS Secrets Manager** ($0.40/month per secret)
- Lambda functions retrieve keys at runtime
- Never hardcode in code or environment variables
- Rotate keys every 90 days
- Different keys per environment (dev/prod)

**Alternative** (cheaper for our scale):
- AWS Systems Manager Parameter Store (free)
- Encrypted with AWS KMS
- Lambda IAM role has permission to decrypt

For Instagram/TikTok/YouTube:
- Use OAuth 2.0 where possible (user authorizes our app)
- Store access tokens per user in DynamoDB (encrypted)
- Refresh tokens before expiry"

---

**Q: "What's your data privacy/GDPR strategy?"**

A:**Phase 1**:
- No PII collected (just creator names + public metrics)
- Data is public information (anyone can see view counts)
- No EU users yet, so GDPR doesn't apply

**Phase 3 (SaaS)**:
- Add Terms of Service + Privacy Policy
- Implement data export (GDPR right to access)
- Implement data deletion (GDPR right to erasure)
- Add opt-out for collective data pool
- Log all data access (CloudWatch + S3)
- Add DPA (Data Processing Agreement) for agencies

**For GDPR compliance**:
- Store data in `us-east-1` (or `eu-west-1` for EU users)
- Implement data retention policies (delete after 2 years)
- Encrypt all data at rest (DynamoDB SSE)
- Encrypt all data in transit (HTTPS)"

---

#### **5. Data Model**

**Q: "Show me your DynamoDB table design"**

A:Primary table: `InfluencerCollaborations`

**Keys**:
- PK (partition key): `userId#global` (later `userId#<actualUserId>`)
- SK (sort key): `COLLAB#<timestamp>#<id>`

This design lets us:
- Query all collaborations for a user (PK = userId)
- Sort by date (SK starts with timestamp)
- Get single item by ID (PK + SK)

**Attributes**:
- Core: creatorName, averageViews, lowestViews, targetCPM
- Prediction: projectedViews, recommendedPrice, confidence, reasoning
- Actual: actualViews, actualPrice, datePosted, notes
- Computed: accuracy, creatorCategory, viewsRange

**GSIs**:
1. **CategoryIndex** (PK=creatorCategory, SK=averageViews) - Find similar creators
2. **CompletedCollabsIndex** (PK=userId#hasActualData, SK=dateCalculated) - ML training data
3. **CreatorNameIndex** (PK=creatorNameLower, SK=dateCalculated) - Search

This supports all our query patterns without table scans."

---

**Q: "How does the ML algorithm access historical data efficiently?"**

A:The ML algorithm needs to find 'similar creators' (±20% view variance) for weighted predictions.

**Naive approach** (BAD):
- Scan entire table
- Filter in Lambda
- Cost: $0.25 per million items, slow

**Our approach** (GOOD):
- Use **CategoryIndex GSI**
- Query by creatorCategory (micro/mid/macro)
- Add BETWEEN clause on averageViews (e.g., 12K-18K)
- Filter by hasActualData=true
- Cost: $0.25 per million reads, but only reads relevant items

Example:
```typescript
// Find similar 'mid' creators with 12K-18K avg views
query({
  IndexName: 'CategoryIndex',
  KeyConditionExpression: 'creatorCategory = :cat AND averageViews BETWEEN :min AND :max',
  FilterExpression: 'hasActualData = :true'
})
```

This returns 5-20 items instead of scanning 10,000+ items. **95% cost reduction**."

---

#### **6. Risk & Mitigation**

**Q: "What are your biggest technical risks?"**

A:Top 5 risks:

**1. Lambda cold starts** (1-2 second delays)
- Impact: Poor UX on first request
- Mitigation: Provisioned concurrency, keep functions warm

**2. DynamoDB throttling at scale**
- Impact: Failed writes when we go viral
- Mitigation: Start on-demand, add auto-scaling, monitor metrics

**3. Social media API rate limits** (Phase 2)
- Impact: Can't scrape more than 200 profiles/day (Instagram limit)
- Mitigation: Queue system, batch at night, user quotas

**4. Multi-tenant data leakage** (Phase 3)
- Impact: Agency A sees Agency B's data
- Mitigation: Row-level security in Lambda, extensive testing, audit logs

**5. AWS account limits**
- Impact: Hit 1000 concurrent Lambda limit
- Mitigation: Request limit increases, monitor usage"

---

**Q: "What happens if DynamoDB goes down?"**

A:DynamoDB has 99.99% uptime SLA (4 minutes downtime/month), but if it does go down:

**Immediate response**:
- API returns 503 Service Unavailable
- Frontend shows error toast: 'Service temporarily unavailable'
- React Query automatically retries (3 attempts, exponential backoff)

**Graceful degradation**:
- Keep localStorage as read-only cache
- Show cached data with warning banner: 'Showing cached data, sync disabled'
- Queue writes in localStorage, sync when API recovers

**Long-term solution** (if we're paranoid):
- Enable DynamoDB Global Tables (multi-region replication)
- Cost: 2x DynamoDB costs
- Failover to `us-west-2` if `us-east-1` is down
- Probably overkill for our use case"

---

**Q: "What's your backup/disaster recovery plan?"**

A:**Backups**:
- DynamoDB Continuous Backups (Point-in-Time Recovery)
- Cost: $0.20 per GB-month
- Restore to any second in last 35 days
- Weekly on-demand backups (free tier covers 10GB)

**Disaster scenarios**:

1. **Accidental table deletion**
   - Recovery: Restore from backup (5-10 minutes)
   - Prevention: CloudFormation stack protection, IAM policies

2. **Data corruption**
   - Recovery: Point-in-time restore to before corruption
   - Prevention: Validation in Lambda, DynamoDB Streams for audit log

3. **AWS region outage**
   - Recovery: Deploy to another region (30-60 minutes manual)
   - Prevention: Multi-region architecture (overkill for now)

4. **Account compromise**
   - Recovery: MFA on root account, IAM users with least privilege
   - Prevention: Rotate credentials, enable CloudTrail logging

**RTO (Recovery Time Objective)**: 15 minutes
**RPO (Recovery Point Objective)**: 1 second (continuous backups)"

---

#### **7. Development & Timeline**

**Q: "What's your MVP? What can you cut?"**

A:**MVP (Week 4)**:
- ✅ DynamoDB table with basic structure
- ✅ CRUD API endpoints (create, read, update, delete)
- ✅ ML algorithm running server-side
- ✅ Frontend calling API instead of localStorage
- ✅ One-click migration from localStorage

**Can cut from MVP**:
- ❌ Social media auto-scraping (keep manual entry) - Phase 2
- ❌ Advanced analytics dashboard - Phase 2
- ❌ Data export (CSV download) - Phase 2
- ❌ Multi-user authentication - Phase 3
- ❌ Real-time updates (polling is fine) - Phase 3
- ❌ Email notifications - Phase 3

**Must have**:
- ✅ Data persistence (DynamoDB)
- ✅ ML predictions working
- ✅ Migration from localStorage (or data loss)
- ✅ Basic error handling

The MVP should prove: 'Can we collect data in a scalable database and improve predictions over time?' Everything else is nice-to-have."

---

**Q: "How long will this take to build?"**

A:**Realistic timeline**:

**Week 1: Infrastructure** (8-12 hours)
- Set up AWS CDK project
- Create DynamoDB table + GSIs
- Deploy initial Lambda functions
- Get 'Hello World' API working

**Week 2: Backend Logic** (12-16 hours)
- Port ML algorithm to TypeScript backend
- Implement all API endpoints
- Add validation + error handling
- Test with Postman

**Week 3: Frontend Integration** (8-12 hours)
- Create API client
- Update components to use API
- Add loading states
- Test end-to-end

**Week 4: Migration + Polish** (4-8 hours)
- Build migration tool
- Test with real data
- Fix bugs
- Deploy to production

**Total: 32-48 hours spread over 4 weeks**

This assumes:
- No major blockers
- You have AWS account set up
- You're comfortable with TypeScript
- Part-time work (8-12 hours/week)

Full-time: Could finish in 1 week."

---

**Q: "How will you test this?"**

A:**Testing strategy**:

**1. Unit Tests** (Lambda functions)
- Jest for TypeScript
- Test ML algorithm accuracy
- Test validation logic
- Target: 80% code coverage

**2. Integration Tests** (API endpoints)
- Test DynamoDB queries return correct data
- Test GSI queries match expected results
- Mock DynamoDB with local DynamoDB

**3. End-to-End Tests** (Full flow)
- Create collaboration → Save → Retrieve → Update → Delete
- Test ML predictions match expected accuracy
- Test migration from localStorage

**4. Load Testing** (Phase 2)
- Apache JMeter or Artillery
- Simulate 100 concurrent users
- Test Lambda auto-scaling
- Identify bottlenecks

**5. Manual Testing**
- Test in production with real data
- Monitor CloudWatch for errors
- Fix bugs as they appear

**CI/CD**:
- GitHub Actions runs tests on every commit
- Automatic deployment to dev environment
- Manual approval for production"

---

#### **8. Multi-tenancy (Future)**

**Q: "How will you add authentication later without breaking things?"**

A:**Migration path**:

**Step 1: Add Cognito (no enforcement)**
- Deploy Cognito User Pool
- Add sign-up/login UI
- Create default user for existing data
- All PK values stay `userId#global`

**Step 2: Soft authentication**
- API accepts both authenticated and anonymous requests
- If JWT present, extract userId
- If no JWT, use 'global'
- No breaking changes

**Step 3: Data migration**
- Script to copy all `userId#global` items to `userId#<defaultUserId>`
- Run in off-hours
- Validate data integrity

**Step 4: Hard authentication**
- Enforce JWT on all endpoints
- Remove 'global' user support
- All queries scoped to userId

By using `userId#X` as PK from day 1, we're already prepared for multi-tenancy. We just change the `X` from 'global' to actual user IDs.

---

**Q: "How will you partition data by agency when you add seats?"**

A:Two approaches:

**Option 1: Agency-level data sharing** (recommended)
```
PK: agencyId#<agencyId>
SK: COLLAB#<timestamp>#<id>
Attributes: { creatorName, ..., createdBy: userId }
```
- All team members share same data
- ML benefits from team's collective knowledge
- Simpler queries

**Option 2: User-level with agency grouping**
```
PK: userId#<userId>
SK: COLLAB#<timestamp>#<id>
Attributes: { creatorName, ..., agencyId: agencyId }
```
- Add GSI: agencyId + timestamp
- Query across all team members
- More complex, better privacy

I'd go with **Option 1** because:
- Influencer marketing is collaborative (teams work together)
- Better ML (more data per agency)
- Simpler access control

Add role-based permissions:
- Owner: Full access, manage team
- Admin: Full access, no team management
- Member: Read-only or limited write"

---

## Next Steps

1. **Review this plan with your mentor**
2. **Get AWS account credentials ready** (IAM user with admin access)
3. **Set up development environment** (Node.js 18+, AWS CLI, AWS CDK)
4. **Start with Week 1 tasks** (infrastructure setup)

---

## Questions for Your Mentor

After presenting this plan, ask your mentor:

1. **Architecture**: "Do you see any major flaws in this architecture design?"
2. **Cost**: "Are there cheaper alternatives to any of these AWS services?"
3. **Risk**: "What's the biggest risk I'm not seeing?"
4. **Timeline**: "Does 4 weeks seem realistic for MVP, or am I underestimating?"
5. **Scale**: "At what point would you recommend moving away from serverless?"
6. **Security**: "What security measures am I missing for Phase 1?"

---

*Last Updated: 2025-12-03*
*Author: Claude Code*
*Status: Ready for Review*
