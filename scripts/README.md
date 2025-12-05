# Scripts Directory

This folder contains utility scripts and test files for development.

## aws-cli-tests/

Contains JSON files for testing DynamoDB operations via AWS CLI.

### Files:
- `query-params.json` - Parameters for querying collaborations
- `get-key.json` - Key for getting specific collaboration
- `new-item.json` - Sample item for testing inserts

### Usage (PowerShell):

```powershell
# Query all collaborations
aws dynamodb query --table-name InfluencerCollaborations --region us-east-1 --key-condition-expression "PK = :pk" --expression-attribute-values file://scripts/aws-cli-tests/query-params.json

# Get specific collaboration
aws dynamodb get-item --table-name InfluencerCollaborations --region us-east-1 --key file://scripts/aws-cli-tests/get-key.json

# Insert test collaboration
aws dynamodb put-item --table-name InfluencerCollaborations --region us-east-1 --item file://scripts/aws-cli-tests/new-item.json
```

### Note:
These files are git-ignored to allow customization without affecting the repository.
