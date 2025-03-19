# Strava Plugin OAuth Proxy

This is a secure backend service that handles OAuth token exchange and refresh for the Strava Plugin Chrome extension. By keeping the client secret on a server-side component, we enhance the security of the OAuth flow.

## Architecture

The backend consists of:

- AWS Lambda function to handle OAuth requests
- API Gateway to expose the Lambda function
- CloudFormation template for infrastructure as code

## Local Development

1. Install dependencies:

```bash
npm install
```

2. Set up AWS SAM CLI for local development:

```bash
pip install aws-sam-cli
```

3. Create a `.env` file with your Strava API credentials:

```
STRAVA_CLIENT_SECRET=your_client_secret_here
```

4. Test locally with SAM:

```bash
sam local start-api
```

## Deployment

### Manual Deployment

1. Deploy using AWS SAM:

```bash
sam build
sam deploy --guided
```

2. Follow the prompts to set your:

   - Stack name (e.g., `strava-plugin-oauth-proxy`)
   - AWS Region
   - Strava Client Secret

3. After deployment, note the API Gateway URL from the output:

```
-----------------------------------------------------------------------------------------------------------
Outputs
-----------------------------------------------------------------------------------------------------------
Key                 ApiEndpoint
Description         API Gateway endpoint URL
Value               https://abcdef123.execute-api.us-east-1.amazonaws.com/prod
-----------------------------------------------------------------------------------------------------------
```

4. Use this URL as the `AUTH_PROXY_URL` in your frontend configuration.

### GitHub Actions Deployment

The repository includes a GitHub Actions workflow that automatically deploys the backend when changes are pushed to the main branch.

To set up automated deployment:

1. Add the following secrets to your GitHub repository:

   - `AWS_ACCESS_KEY_ID`
   - `AWS_SECRET_ACCESS_KEY`
   - `AWS_REGION`
   - `STRAVA_CLIENT_SECRET`

2. Push changes to the `backend/` directory on the main branch.

3. The workflow will:
   - Deploy the backend using SAM
   - Fetch the API Gateway URL
   - Update the `AUTH_PROXY_URL` secret for use in frontend builds

## Security Considerations

- The Strava Client Secret is never exposed to the frontend
- API Gateway is secured with CORS restrictions
- Token exchange/refresh only happens through the secure backend
- Environmental separation between development and production

## Testing

Run tests with:

```bash
npm test
```
