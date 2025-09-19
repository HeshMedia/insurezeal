# VPS Deployment Guide (Coolify)

This guide covers deploying the Insurezeal API to a VPS using Coolify.

## Prerequisites

1. **VPS Server** with Docker installed
2. **Coolify** installed and configured on your VPS
3. **PostgreSQL Database** running on the VPS or accessible externally
4. **Domain/Subdomain** pointed to your VPS (optional but recommended)

## Environment Configuration

### 1. Database Setup

Create a PostgreSQL database on your VPS:

```bash
# Using Docker Compose or Coolify's database service
docker run -d \
  --name insurezeal-postgres \
  --restart unless-stopped \
  -e POSTGRES_DB=insurezeal \
  -e POSTGRES_USER=insurezeal \
  -e POSTGRES_PASSWORD=your_secure_password \
  -v postgres_data:/var/lib/postgresql/data \
  -p 5432:5432 \
  postgres:15
```

### 2. Environment Variables

Set the following environment variables in Coolify:

```env
# Database Configuration  
DATABASE_URL=postgresql+asyncpg://insurezeal:your_secure_password@localhost:5432/insurezeal

# Supabase Configuration (Keep for authentication)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_STORAGE_BUCKET=insurezeal

# Webhook Security (Generate a strong random string)
SUPABASE_WEBHOOK_SECRET=your-webhook-secret-here

# JWT Configuration
JWT_SECRET_KEY=your-jwt-secret-key

# AI Services
GEMINI_API_KEY=your-gemini-api-key
LLMWHISPERER_API_KEY=your-llm-whisper-api-key

# Google Sheets Integration (Service Account Credentials as Environment Variables)
GOOGLE_SHEETS_TYPE=service_account
GOOGLE_SHEETS_PROJECT_ID=your-project-id
GOOGLE_SHEETS_PRIVATE_KEY_ID=your-private-key-id
GOOGLE_SHEETS_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nyour-private-key-content-here\n-----END PRIVATE KEY-----\n"
GOOGLE_SHEETS_CLIENT_EMAIL=your-service-account-email
GOOGLE_SHEETS_CLIENT_ID=your-client-id
GOOGLE_SHEETS_AUTH_URI=https://accounts.google.com/o/oauth2/auth
GOOGLE_SHEETS_TOKEN_URI=https://oauth2.googleapis.com/token
GOOGLE_SHEETS_AUTH_PROVIDER_X509_CERT_URL=https://www.googleapis.com/oauth2/v1/certs
GOOGLE_SHEETS_CLIENT_X509_CERT_URL=your-client-x509-cert-url
GOOGLE_SHEETS_UNIVERSE_DOMAIN=googleapis.com
GOOGLE_SHEETS_DOCUMENT_ID=your-google-sheets-document-id

# Application Environment
ENVIRONMENT=prod

# Server Configuration
HOST=0.0.0.0
PORT=8000
WORKERS=4
```

### 3. Supabase Webhook Configuration

Configure Supabase to send webhooks to your VPS:

1. Go to your Supabase Dashboard
2. Navigate to Database > Webhooks
3. Create a new webhook with:
   - **Name**: `User Auth Sync`
   - **Table**: `auth.users`
   - **Events**: `INSERT`, `UPDATE`, `DELETE`
   - **Type**: `HTTP Request`
   - **HTTP URL**: `https://your-domain.com/auth/webhooks/supabase`
   - **HTTP Headers**: 
     ```
     Authorization: Bearer your-webhook-secret-here
     Content-Type: application/json
     ```

## Coolify Deployment

### 1. Create New Project

1. Open Coolify dashboard
2. Create a new project: "Insurezeal API"
3. Choose "Deploy from Git Repository"

### 2. Repository Configuration

- **Repository URL**: `https://github.com/your-username/insurezeal.git`
- **Branch**: `main` or your production branch
- **Build Pack**: `Docker`
- **Dockerfile Location**: `backend/Dockerfile`
- **Context Directory**: `backend`

### 3. Build Configuration

```dockerfile
# Coolify will use the Dockerfile in backend/
# No additional build configuration needed
```

### 4. Domain Configuration

- Set up domain: `api.yourdomain.com`
- Enable SSL (Let's Encrypt)
- Configure reverse proxy

### 5. Persistent Storage

Mount volumes for:
- **Google Sheets Credentials**: `/app/credentials`
- **Logs**: `/app/logs` (optional)

## Database Migration

After first deployment, run migrations:

```bash
# Connect to your container
docker exec -it <container-name> bash

# Run migrations
alembic upgrade head
```

Or set up automatic migrations in Coolify startup script:

```bash
#!/bin/bash
echo "Running database migrations..."
alembic upgrade head
echo "Starting application..."
exec "$@"
```

## Health Checks

Coolify health check endpoint: `GET /health`

Expected response:
```json
{
  "status": "healthy",
  "service": "insurezeal-api"
}
```

## SSL Configuration

1. **Automatic SSL**: Coolify handles Let's Encrypt automatically
2. **Custom SSL**: Upload your certificates in Coolify dashboard
3. **Force HTTPS**: Enable redirect in Coolify settings

## Monitoring

### Application Logs
- Accessible through Coolify dashboard
- Real-time log streaming available

### Health Monitoring
- **Endpoint**: `/health`
- **Frequency**: Every 30 seconds
- **Timeout**: 30 seconds

## Scaling

### Horizontal Scaling
```bash
# Increase replicas in Coolify
replicas: 3
```

### Vertical Scaling
- **CPU**: 1-2 cores recommended
- **RAM**: 2-4 GB recommended
- **Storage**: 20+ GB

## Backup Strategy

### Database Backup
```bash
# Automated PostgreSQL backup
pg_dump -h localhost -U insurezeal insurezeal > backup_$(date +%Y%m%d).sql
```

### File Backup
- Google Sheets credentials
- Environment configuration
- Application logs

## Security Considerations

1. **Firewall**: Only expose ports 80, 443, 22
2. **Database**: Restrict to local connections only
3. **Webhook Secret**: Use strong, random strings
4. **Environment Variables**: Never commit secrets to git
5. **Updates**: Keep system and Docker images updated

## Troubleshooting

### Common Issues

1. **Database Connection Failed**
   ```bash
   # Check database connectivity
   docker exec -it postgres-container psql -U insurezeal -d insurezeal
   ```

2. **Webhook Not Working**
   - Verify webhook URL is accessible
   - Check webhook secret matches
   - Review Supabase webhook logs

3. **Build Failures**
   - Check Dockerfile syntax
   - Verify requirements.txt dependencies
   - Review Coolify build logs

### Useful Commands

```bash
# View container logs
docker logs <container-name> -f

# Access container shell
docker exec -it <container-name> bash

# Check database connections
docker exec -it <postgres-container> psql -U insurezeal

# Restart application
# (Use Coolify dashboard)
```

## Performance Optimization

1. **Database Indexing**: Ensure proper indexes on foreign keys
2. **Connection Pooling**: Configure in DATABASE_URL
3. **Caching**: Consider Redis for session/data caching
4. **CDN**: Use for static file serving (if applicable)

## Maintenance

### Regular Tasks
- **Weekly**: Review logs and metrics
- **Monthly**: Update dependencies and system packages
- **Quarterly**: Review and rotate secrets

### Updates
1. Update git repository
2. Coolify auto-deploys on git push (if configured)
3. Run database migrations if needed
4. Monitor deployment in Coolify dashboard
