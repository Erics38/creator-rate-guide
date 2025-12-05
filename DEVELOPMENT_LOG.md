# Development Log - Influencer Rate Calculator Backend Migration

> **Purpose**: Track what we're building, why we're building it, lessons learned, and bugs encountered.
>
> **Started**: December 4, 2024
>
> **Goal**: Migrate from localStorage to AWS serverless backend

---

## Table of Contents
- [Overview](#overview)
- [Phase 1: DynamoDB Setup](#phase-1-dynamodb-setup)
- [Bugs & Issues](#bugs--issues)
- [Lessons Learned](#lessons-learned)

---

## Overview

### Current State (Before Migration)
- **Frontend**: React + TypeScript + Vite
- **Data Storage**: Browser localStorage (client-side only)
- **Problem**: Data gets wiped when browser cache clears, no cloud backup

### Target State (After Migration)
- **Frontend**: Same (minimal changes)
- **Data Storage**: AWS DynamoDB (cloud database)
- **Benefits**:
  - Data never lost
  - Can scale to multiple users
  - Foundation for ML improvements
  - Professional, production-ready architecture

### Migration Strategy
We're taking a **minimal incremental approach**:
1. ✅ **Phase 1**: DynamoDB table (just the database)
2. 🔲 **Phase 2**: Lambda functions (API endpoints)
3. 🔲 **Phase 3**: Frontend integration (connect to API)

**Why this order?**
- Test each piece independently
- Easy to debug (isolate issues)
- Can rollback if needed
- Learn incrementally

---

## Phase 1: DynamoDB Setup

**Status**: ✅ COMPLETED (Dec 4, 2024)

### What We Built

#### 1. Backend Data Models (`backend/src/models/types.ts`)

**Purpose**: Define TypeScript interfaces for our data structures

**Key Interfaces**:
```typescript
export interface CollaborationData {
  // DynamoDB Keys - required for database queries
  PK: string;  // Partition key: "userId#global" (all data under one user for now)
  SK: string;  // Sort key: "COLLAB#<timestamp>#<id>" (auto-sorted by date)

  // Core fields
  id: string;              // Unique identifier (timestamp)
  creatorName: string;     // Instagram/TikTok handle

  // Input parameters (what user enters)
  averageViews: number;    // Creator's average views
  lowestViews: number;     // Creator's lowest views
  targetCPM: number;       // Cost per 1000 views target

  // Prediction results (calculated by algorithm)
  projectedViews: number;
  recommendedPrice: number;
  confidence: number;
  reasoning: string;
  priceRangeMin: number;
  priceRangeMax: number;
  dateCalculated: string;  // ISO 8601 timestamp

  // Optional: Actual results (added later when collaboration posts)
  actualViews?: number;
  actualPrice?: number;
  datePosted?: string;
  notes?: string;

  // Computed
  accuracy?: number;       // Calculated from projected vs actual
}
```

**Why these fields?**
- Matches existing localStorage structure (easy migration)
- `PK`/`SK` follow DynamoDB best practices
- Optional fields support two-phase workflow (predict → save actuals later)

---

#### 2. CDK Infrastructure Stack (`infrastructure/lib/infrastructure-stack.ts`)

**Purpose**: Define AWS resources as code (Infrastructure as Code)

**What it creates**:
```typescript
const collaborationsTable = new dynamodb.Table(this, 'CollaborationsTable', {
  tableName: 'InfluencerCollaborations',

  // Primary key structure
  partitionKey: { name: 'PK', type: STRING },  // Groups items (all under "userId#global")
  sortKey: { name: 'SK', type: STRING },        // Orders items (by date)

  // Billing
  billingMode: PAY_PER_REQUEST,  // Only pay for what you use (no minimum cost)

  // Safety
  removalPolicy: RETAIN,          // Don't delete table if we destroy the CDK stack
  pointInTimeRecovery: false      // Can enable later for backups
});
```

**Key Design Decisions**:

1. **Table Name: `InfluencerCollaborations`**
   - Descriptive and clear
   - Follows AWS naming conventions

2. **Partition Key (`PK`): `"userId#global"`**
   - Why "global"? All data under one partition for now (simplest start)
   - Later: Can change to actual user IDs when we add authentication
   - Format: `userId#{id}` leaves room for multi-user in future

3. **Sort Key (`SK`): `"COLLAB#<timestamp>#<id>"`**
   - Automatically sorts items by date (newest first when queried backwards)
   - Includes ID for uniqueness
   - Format: `COLLAB#2024-12-04T20:52:00Z#1701598200000`

   **Why this format?**
   - `COLLAB#` prefix: Allows different item types in same table later
   - Timestamp: Human-readable and sortable
   - ID: Ensures uniqueness even if two items created same millisecond

4. **Pay-per-Request Billing**
   - **Alternative**: Provisioned capacity (pay for reserved capacity)
   - **Why on-demand?**
     - $0 when not in use
     - Auto-scales (no capacity planning needed)
     - Free tier: 25 GB storage, 25 WCU/RCU (write/read capacity units)
     - Perfect for unpredictable/low traffic

5. **No GSIs (Global Secondary Indexes)**
   - **What are GSIs?** Additional "search tables" for different query patterns
   - **Why skip them?** Don't need complex queries yet
   - **When to add?**
     - Need to search by creator name → add CreatorNameIndex
     - Need to filter by view range → add CategoryIndex
     - ML algorithm needs completed collaborations → add CompletedCollabsIndex
   - **Can add later?** YES! No data loss, just update the stack

6. **RemovalPolicy: RETAIN**
   - If we accidentally run `cdk destroy`, table won't be deleted
   - Prevents data loss from mistyped commands
   - Must manually delete table in AWS Console (intentional friction)

---

### Deployment Process

**Commands executed**:
```bash
# 1. Build CDK TypeScript code
cd infrastructure
npm run build

# 2. Preview what will be created (CloudFormation template)
cdk synth

# 3. Deploy to AWS
cdk deploy --require-approval never
```

**What happened**:
1. CDK synthesized CloudFormation template (JSON description of resources)
2. CloudFormation created DynamoDB table in us-east-1
3. Table became available in ~31 seconds

**Deployment output**:
```
✅ InfrastructureStack

Outputs:
  TableName = InfluencerCollaborations
  TableArn = arn:aws:dynamodb:us-east-1:027660363574:table/InfluencerCollaborations
```

---

### Current State

**AWS Resources Created**:
- ✅ DynamoDB table: `InfluencerCollaborations`
- ✅ Region: us-east-1
- ✅ Billing mode: On-demand
- ✅ Keys configured: PK (partition), SK (sort)
- ✅ No GSIs (keeping it simple)

**Can we query it?** YES - next step is to test with AWS CLI

**Cost so far**: $0.00 (within free tier)

---

## Next Steps

### Immediate (Today)
- [ ] Test database with AWS CLI (put/get items)
- [ ] Verify data structure works as expected
- [ ] Document test results

### Phase 2 (Next Session)
- [ ] Create Lambda function: `saveCollaboration`
- [ ] Create Lambda function: `getCollaborations`
- [ ] Set up API Gateway
- [ ] Test API endpoints with Postman

### Phase 3 (After Phase 2)
- [ ] Update frontend to call API
- [ ] Test end-to-end flow
- [ ] Keep localStorage as fallback
- [ ] Production testing

---

## Bugs & Issues

### 1. CDK Deprecation Warning
**Date**: Dec 4, 2024
**Severity**: Low (warning, not error)

**Issue**:
```
[WARNING] aws-cdk-lib.aws_dynamodb.TableOptions#pointInTimeRecovery is deprecated.
  use `pointInTimeRecoverySpecification` instead
```

**What it means**:
- We used old property name `pointInTimeRecovery`
- Should use `pointInTimeRecoverySpecification` instead

**Impact**: None (still works, just deprecated)

**Fix**: Update in next iteration (not urgent)

**How to fix**:
```typescript
// Old (current)
pointInTimeRecovery: false

// New
pointInTimeRecoverySpecification: {
  pointInTimeRecoveryEnabled: false
}
```

---

## Lessons Learned

### 1. Start Simple, Add Complexity Later
**What we did**: Created table with NO GSIs
**Why it worked**: Can add GSIs later without data migration
**Takeaway**: Don't over-engineer upfront. Build incrementally.

### 2. Infrastructure as Code (IaC) is Powerful
**Tool**: AWS CDK
**Benefit**: One command (`cdk deploy`) created entire infrastructure
**Alternative**: Manually clicking in AWS Console (error-prone, not repeatable)
**Takeaway**: CDK lets us version-control our infrastructure, easy to recreate

### 3. DynamoDB Key Design Matters
**Decision**: Using composite sort key `COLLAB#<timestamp>#<id>`
**Benefit**:
- Auto-sorted by date
- Supports future item types in same table
- Human-readable in AWS Console

**Best practice**: Always prefix sort keys with entity type

### 4. Pay-per-Request vs Provisioned Capacity
**Choice**: Pay-per-request
**Why**: Unpredictable traffic, want $0 idle cost
**When to switch**: If traffic becomes steady/predictable, provisioned can be cheaper
**Takeaway**: Billing mode can be changed later (not locked in)

---

## Developer Notes

### Code Comments Philosophy
We're using **extensive inline comments** to explain:
- What the code does
- Why we chose this approach
- What alternatives exist
- When to revisit decisions

**Example**:
```typescript
// Pay-per-request billing: Only pay for actual reads/writes
// Alternative: Provisioned capacity (better for steady traffic)
// Why we chose this: Unpredictable usage, want $0 idle cost
billingMode: PAY_PER_REQUEST,
```

### Documentation Strategy
- **This file (DEVELOPMENT_LOG.md)**: High-level decisions, timeline, bugs
- **Code comments**: Inline technical explanations
- **creatorappguide.md**: Comprehensive reference guide

---

## Useful Commands

### CDK
```bash
# Preview changes
cdk diff

# Deploy stack
cdk deploy

# Destroy stack (table will remain due to RETAIN policy)
cdk destroy

# Synthesize CloudFormation template
cdk synth
```

### AWS CLI (DynamoDB)
```bash
# List tables
aws dynamodb list-tables --region us-east-1

# Describe table
aws dynamodb describe-table --table-name InfluencerCollaborations --region us-east-1

# Put item (coming next)
aws dynamodb put-item --table-name InfluencerCollaborations --item '...'

# Query items (coming next)
aws dynamodb query --table-name InfluencerCollaborations --key-condition-expression '...'
```

---

**Last Updated**: December 4, 2024, 8:52 PM EST
