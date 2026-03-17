# Influencer Rate Calculator

A smart pricing tool built for a brand partnerships lead to calculate fair influencer collaboration rates using machine learning.

## Origin Story

Built in collaboration with a brand partnerships professional who spent hours weekly manually calculating influencer rates in spreadsheets.

**The Problem**: Manual calculations for 20+ influencers/week, inconsistent pricing, no historical data tracking

**The Solution**: ML-powered calculator that learns from past collaborations

## Key Features & Daily Usage

### Smart Rate Calculator
Enter creator metrics → Get instant pricing with 82% confidence based on historical data
- **Time saved**: 15 min → 30 seconds per calculation
- **ML-powered**: Analyzes similar creators, applies weighted performance + trend multipliers

### Profile Scraper  
Paste URL → Auto-extract metrics from social profiles
- **Impact**: Eliminated 5 min of manual data entry per creator

### Collaboration History
Search past deals → Justify new pricing based on creator growth
- **Value**: Institutional knowledge, contract negotiation leverage

### Actual Results Tracking
Update with real performance → ML learns from 92.4% accuracy
- **Why**: Continuous improvement, validate ROI to stakeholders

### Analytics Dashboard
87% overall prediction accuracy across 42 collaborations
- **Usage**: Monthly reporting, identify best-performing categories

## Relevance to SaaS Roles

Demonstrates:
- **Customer-driven development**: Built iteratively with user feedback
- **Workflow automation**: Reduced task time by 90%
- **Serverless architecture**: AWS Lambda + DynamoDB + Cognito
- **Multi-tenant ready**: Secure user isolation for agencies
- **Data-driven decisions**: ML improves with usage

## Tech Stack

Frontend: React + TypeScript + Vite
Backend: AWS Lambda (Node.js 18)
Database: DynamoDB (NoSQL with GSIs for ML queries)
Auth: AWS Cognito (JWT tokens)
Infrastructure: AWS CDK (IaC)
Hosting: Netlify + AWS

## Impact

- **Time savings**: 5 hours/week → 40 min/week (4.3 hours saved)
- **Accuracy**: 87% prediction rate
- **Scale**: Can evaluate 3x more creators in same time

## Architecture

```
Frontend (Netlify)
    ↓ HTTPS + JWT
API Gateway → Lambda Functions → DynamoDB
                ↓
          Cognito Auth
```

---

**Built by Eric Syvertsen** with a brand partnerships lead

[GitHub](https://github.com/Erics38) | [LinkedIn](https://www.linkedin.com/in/eric-syvertsen38/)

Showcases customer-driven development, serverless architecture, ML automation — applicable to SaaS onboarding & solutions engineering.
