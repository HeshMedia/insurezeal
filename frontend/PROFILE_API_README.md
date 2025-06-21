# Profile API Documentation

This document explains how to use the profile API functions and TanStack Query hooks for managing user profiles in the InsureZeal frontend application.

## Type Definitions

All types are defined in `src/types/profile.types.ts`:

- `UserProfile` - Complete user profile interface
- `UpdateProfileRequest` - Interface for updating profile data
- `DocumentType` - Enum for document types
- `ProfileImageUploadResponse` - Response from profile image upload
- `DocumentUploadResponse` - Response from document upload
- `DocumentListResponse` - Response from getting user documents

## API Functions

The profile API functions are available in `src/lib/api/profile.ts`:

### Core API Functions

```typescript
import { profileApi } from '@/lib/api/profile'

// Get current user profile
const profile = await profileApi.getCurrentProfile()

// Update profile
const updatedProfile = await profileApi.updateProfile(profileData)

// Upload profile image
const imageResponse = await profileApi.uploadProfileImage(file)

// Delete profile image
await profileApi.deleteProfileImage()

// Upload document
const documentResponse = await profileApi.uploadDocument({
  file,
  document_type: 'aadhaar',
  document_name: 'Aadhaar Card'
})

// Get user documents
const documents = await profileApi.getUserDocuments()

// Delete document
await profileApi.deleteDocument(documentId)
```

## TanStack Query Hooks

Use the React Query hooks for better state management:

```typescript
import { useProfile } from '@/lib/api/profile'

function ProfileComponent() {
  const profileHooks = useProfile()
  
  // Query hooks
  const { data: profile, isLoading, error } = profileHooks.useGetProfile()
  const { data: documents } = profileHooks.useGetDocuments()
  
  // Mutation hooks
  const updateProfile = profileHooks.useUpdateProfile()
  const uploadImage = profileHooks.useUploadProfileImage()
  const uploadDocument = profileHooks.useUploadDocument()
  const deleteDocument = profileHooks.useDeleteDocument()
  
  // Use the hooks...
}
```

## Usage Examples

### 1. Get and Display Profile

```typescript
const { data: profile, isLoading, error } = profileHooks.useGetProfile()

if (isLoading) return <div>Loading...</div>
if (error) return <div>Error: {error.message}</div>

return (
  <div>
    <h1>{profile?.first_name} {profile?.last_name}</h1>
    <p>Email: {profile?.email}</p>
    {profile?.avatar_url && (
      <img src={profile.avatar_url} alt="Profile" />
    )}
  </div>
)
```

### 2. Update Profile

```typescript
const updateProfileMutation = profileHooks.useUpdateProfile()

const handleUpdate = (formData: UpdateProfileRequest) => {
  updateProfileMutation.mutate(formData, {
    onSuccess: () => {
      toast.success('Profile updated successfully!')
    },
    onError: (error: Error) => {
      toast.error(`Failed to update: ${error.message}`)
    }
  })
}
```

### 3. Upload Profile Image

```typescript
const uploadImageMutation = profileHooks.useUploadProfileImage()

const handleImageUpload = (file: File) => {
  uploadImageMutation.mutate(file, {
    onSuccess: (response) => {
      toast.success('Image uploaded successfully!')
      console.log('New avatar URL:', response.avatar_url)
    },
    onError: (error: Error) => {
      toast.error(`Upload failed: ${error.message}`)
    }
  })
}

// Usage with file input
const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
  const file = event.target.files?.[0]
  if (file) {
    handleImageUpload(file)
  }
}
```

### 4. Upload Documents

```typescript
const uploadDocumentMutation = profileHooks.useUploadDocument()

const handleDocumentUpload = (file: File, type: DocumentType, name: string) => {
  uploadDocumentMutation.mutate({
    file,
    document_type: type,
    document_name: name
  }, {
    onSuccess: (response) => {
      toast.success('Document uploaded successfully!')
    },
    onError: (error: Error) => {
      toast.error(`Upload failed: ${error.message}`)
    }
  })
}
```

### 5. Manage Documents

```typescript
const { data: documents } = profileHooks.useGetDocuments()
const deleteDocumentMutation = profileHooks.useDeleteDocument()

const handleDeleteDocument = (documentId: string) => {
  deleteDocumentMutation.mutate(documentId, {
    onSuccess: () => {
      toast.success('Document deleted successfully!')
    }
  })
}

return (
  <div>
    <h2>Documents ({documents?.total_count || 0})</h2>
    {documents?.documents.map((doc) => (
      <div key={doc.document_id}>
        <span>{doc.document_name} ({doc.document_type})</span>
        <button onClick={() => handleDeleteDocument(doc.document_id)}>
          Delete
        </button>
      </div>
    ))}
  </div>
)
```

## Document Types

Available document types:
- `aadhaar` - Aadhaar Card
- `pan` - PAN Card
- `educational_certificate` - Educational Certificate
- `experience_certificate` - Experience Certificate
- `passport_photo` - Passport Size Photo
- `bank_passbook` - Bank Passbook
- `cancelled_cheque` - Cancelled Cheque
- `irdai_license` - IRDAI License
- `training_certificate` - Training Certificate
- `residence_proof` - Residence Proof
- `income_proof` - Income Proof

## File Upload Constraints

### Profile Images
- Formats: JPEG, PNG, GIF, WebP
- Maximum size: 5MB

### Documents
- Formats: PDF, JPEG, PNG
- Maximum size: 10MB

## Error Handling

All API functions throw Error objects that can be caught and handled:

```typescript
try {
  await profileApi.updateProfile(data)
} catch (error) {
  console.error('Update failed:', error.message)
}
```

When using mutations, handle errors in the onError callback:

```typescript
mutation.mutate(data, {
  onError: (error: Error) => {
    // Handle error
    console.error(error.message)
  }
})
```

## Query Keys

The following query keys are used for caching:

```typescript
profileQueryKeys.all         // ['profile']
profileQueryKeys.profile()   // ['profile', 'current'] 
profileQueryKeys.documents() // ['profile', 'documents']
```

These are automatically managed by the hooks, but you can use them for manual cache manipulation if needed.
