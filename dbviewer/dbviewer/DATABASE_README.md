# Database Connection Guide

## PostgreSQL Connection Strings

This application supports connecting to PostgreSQL databases using connection strings.

### Connection String Format

```
postgres://username:password@hostname:port/database_name?sslmode=require
```

or

```
postgresql://username:password@hostname:port/database_name?sslmode=require
```

### SSL Configuration

For cloud-hosted PostgreSQL databases (like Aiven, AWS RDS, Azure Database for PostgreSQL, etc.) that use SSL:

- The application automatically handles self-signed certificates
- No additional configuration is required
- Always include `?sslmode=require` in your connection string for cloud-hosted databases

### Connection Examples

#### Aiven PostgreSQL:
```
postgres://avnadmin:password@hostname-project-name.aivencloud.com:port/defaultdb?sslmode=require
```

#### AWS RDS:
```
postgresql://username:password@your-instance.region.rds.amazonaws.com:5432/database_name?sslmode=require
```

#### Local PostgreSQL:
```
postgres://postgres:password@localhost:5432/database_name
```
