'use client';

import { useId } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RefreshCw, Eye, EyeOff } from 'lucide-react';

interface ConnectionFormProps {
  databaseUrl: string;
  setDatabaseUrl: (url: string) => void;
  showPassword: boolean;
  setShowPassword: (show: boolean) => void;
  maskUrl: (url: string) => string;
  loading: boolean;
  onConnect: () => void;
  onRefresh: () => void;
  hasData: boolean;
}

export function ConnectionForm({
  databaseUrl,
  setDatabaseUrl,
  showPassword,
  setShowPassword,
  maskUrl,
  loading,
  onConnect,
  onRefresh,
  hasData,
}: ConnectionFormProps) {  // Using useId to avoid hydration mismatch with generated IDs
  const inputId = useId();
  
  return (
    <div className="flex gap-2">
      <div className="flex-1 relative">
        <Input
          id={inputId}
          type="text"
          placeholder="postgresql://username:password@your-aiven-host:port/database_name"
          value={showPassword ? databaseUrl : maskUrl(databaseUrl)}
          onChange={(e) => setDatabaseUrl(e.target.value)}
          className="pr-10"
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="absolute right-1 top-1 h-8 w-8"
          onClick={() => setShowPassword(!showPassword)}
        >
          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </Button>
      </div>
      <Button onClick={onConnect} disabled={loading}>
        {loading ? 'Connecting...' : 'Connect'}
      </Button>
      {hasData && (
        <Button onClick={onRefresh} disabled={loading} variant="outline">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      )}
    </div>
  );
}