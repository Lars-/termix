# Host and Folder Sharing Implementation

This document describes the complete implementation of host and folder sharing functionality in Termix.

## Overview

Admins can now share individual hosts or entire folders with specific users. Shared users have **read-only** access - they can view and use the hosts but cannot edit or delete them.

## What Has Been Implemented

### 1. Database Schema (`src/backend/database/db/schema.ts` & `db/index.ts`)

Two new tables have been added:

#### `host_shares` Table
Tracks individual host shares between users.
```sql
CREATE TABLE host_shares (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    host_id INTEGER NOT NULL,
    owner_id TEXT NOT NULL,
    shared_with_user_id TEXT NOT NULL,
    access_level TEXT NOT NULL DEFAULT 'viewer',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT NOT NULL,
    FOREIGN KEY (host_id) REFERENCES ssh_data (id) ON DELETE CASCADE,
    FOREIGN KEY (owner_id) REFERENCES users (id),
    FOREIGN KEY (shared_with_user_id) REFERENCES users (id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users (id)
);
```

#### `folder_shares` Table
Tracks folder shares - when a folder is shared, ALL hosts in that folder are shared.
```sql
CREATE TABLE folder_shares (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    folder_name TEXT NOT NULL,
    owner_id TEXT NOT NULL,
    shared_with_user_id TEXT NOT NULL,
    access_level TEXT NOT NULL DEFAULT 'viewer',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT NOT NULL,
    FOREIGN KEY (owner_id) REFERENCES users (id),
    FOREIGN KEY (shared_with_user_id) REFERENCES users (id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users (id)
);
```

### 2. Backend API Endpoints (`src/backend/database/routes/ssh.ts`)

All endpoints are prefixed with `/ssh/shares`:

#### Admin-Only Endpoints (require `requireAdmin` middleware)

**Share a Host**
```
POST /ssh/shares/host
Body: { hostId: number, sharedWithUserId: string }
```

**Share a Folder**
```
POST /ssh/shares/folder
Body: { folderName: string, ownerId: string, sharedWithUserId: string }
```

**Get Shares for a Host**
```
GET /ssh/shares/host/:hostId
```

**Get Shares for a Folder**
```
GET /ssh/shares/folder/:ownerId/:folderName
```

**Revoke Host Share**
```
DELETE /ssh/shares/host/:shareId
```

**Revoke Folder Share**
```
DELETE /ssh/shares/folder/:shareId
```

#### User Endpoints (require `authenticateJWT` middleware)

**Get My Shares**
```
GET /ssh/shares/my
Returns: { hostShares: [...], folderShares: [...] }
```

### 3. Modified Host Queries

#### GET `/ssh/db/host` (Line 583)
Now returns:
- User's own hosts (where `userId = currentUser`)
- Hosts shared directly with the user (via `host_shares`)
- Hosts in folders shared with the user (via `folder_shares`)

Each host includes sharing metadata:
- `isShared`: boolean - true if the host is shared with the user
- `isOwner`: boolean - true if the user owns the host
- `shareId`: number - ID of the share (if shared)
- `actualOwnerId`: string - ID of the actual owner (if shared)

#### GET `/ssh/db/host/:id` (Line 768)
Now allows access to:
- Hosts owned by the user
- Hosts shared with the user (directly or via folder)

#### PUT `/ssh/db/host/:id` (Line 373)
Protected - only owners can update hosts. Returns 403 error if non-owner tries to edit:
```json
{ "error": "Cannot edit this host. You can only edit hosts that you own." }
```

#### DELETE `/ssh/db/host/:id` (Line 988)
Protected - only owners can delete hosts. Returns 403 error if non-owner tries to delete:
```json
{ "error": "Cannot delete this host. You can only delete hosts that you own." }
```

### 4. Frontend API Client (`src/ui/main-axios.ts`)

New functions exported from main-axios.ts:

```typescript
// Share a host with a user
shareHost(hostId: number, sharedWithUserId: string): Promise<HostShare>

// Share a folder with a user
shareFolder(folderName: string, ownerId: string, sharedWithUserId: string): Promise<FolderShare>

// Get all shares for a specific host
getHostShares(hostId: number): Promise<HostShare[]>

// Get all shares for a specific folder
getFolderShares(ownerId: string, folderName: string): Promise<FolderShare[]>

// Get shares where current user is the recipient
getMyShares(): Promise<MyShares>

// Revoke a host share
revokeHostShare(shareId: number): Promise<{ message: string }>

// Revoke a folder share
revokeFolderShare(shareId: number): Promise<{ message: string }>
```

### 5. TypeScript Types (`src/types/index.ts`)

Updated `SSHHost` interface:
```typescript
export interface SSHHost {
  // ... existing fields ...

  // Sharing metadata
  isShared?: boolean;      // Is this host shared with me?
  isOwner?: boolean;       // Do I own this host?
  shareId?: number;        // Share ID (if shared)
  actualOwnerId?: string;  // Owner's user ID (if shared)
}
```

New interfaces in `main-axios.ts`:
```typescript
export interface HostShare {
  id: number;
  hostId: number;
  ownerId: string;
  sharedWithUserId: string;
  sharedWithUsername?: string;
  accessLevel: string;
  createdAt: string;
}

export interface FolderShare {
  id: number;
  folderName: string;
  ownerId: string;
  sharedWithUserId: string;
  sharedWithUsername?: string;
  accessLevel: string;
  createdAt: string;
}

export interface MyShares {
  hostShares: Array<{...}>;
  folderShares: Array<{...}>;
}
```

### 6. UI Components (Created but not yet integrated)

#### `ShareHostDialog.tsx`
Admin-only dialog for sharing individual hosts:
- Shows list of users
- Shows current shares for the host
- Allows sharing with new users
- Allows revoking existing shares

#### `ShareFolderDialog.tsx`
Admin-only dialog for sharing entire folders:
- Shows list of users
- Shows current shares for the folder
- Allows sharing with new users
- Allows revoking existing shares

## Integration Guide

### To Add Sharing to Host Manager

1. **Import the share dialog in HostManagerViewer.tsx:**
```typescript
import { ShareHostDialog } from "./ShareHostDialog";
import { Share2 } from "lucide-react";
import { useUser } from "@/hooks/use-user"; // or wherever user context is
```

2. **Add state for the share dialog:**
```typescript
const [shareDialogOpen, setShareDialogOpen] = useState(false);
const [hostToShare, setHostToShare] = useState<SSHHost | null>(null);
const { user } = useUser();
```

3. **Add a Share button for admins in the host actions section:**
```typescript
{user?.is_admin && (
  <Button
    variant="ghost"
    size="sm"
    onClick={() => {
      setHostToShare(host);
      setShareDialogOpen(true);
    }}
  >
    <Share2 className="h-4 w-4" />
  </Button>
)}
```

4. **Add the dialog component:**
```typescript
{hostToShare && (
  <ShareHostDialog
    isOpen={shareDialogOpen}
    onClose={() => {
      setShareDialogOpen(false);
      setHostToShare(null);
    }}
    hostId={hostToShare.id}
    hostName={hostToShare.name}
  />
)}
```

### To Add Sharing to Folder Headers

1. **Import the share folder dialog:**
```typescript
import { ShareFolderDialog } from "./ShareFolderDialog";
```

2. **Add state for folder sharing:**
```typescript
const [shareFolderDialogOpen, setShareFolderDialogOpen] = useState(false);
const [folderToShare, setFolderToShare] = useState<{ name: string; ownerId: string } | null>(null);
```

3. **Add a Share button in folder header:**
```typescript
{user?.is_admin && (
  <Button
    variant="ghost"
    size="sm"
    onClick={() => {
      setFolderToShare({ name: folderName, ownerId: currentUserId });
      setShareFolderDialogOpen(true);
    }}
  >
    <Share2 className="h-4 w-4" />
  </Button>
)}
```

4. **Add the dialog component:**
```typescript
{folderToShare && (
  <ShareFolderDialog
    isOpen={shareFolderDialogOpen}
    onClose={() => {
      setShareFolderDialogOpen(false);
      setFolderToShare(null);
    }}
    folderName={folderToShare.name}
    ownerId={folderToShare.ownerId}
  />
)}
```

### To Show Shared Indicators

In the host list UI, check the `isShared` flag:

```typescript
{host.isShared && (
  <Badge variant="secondary" className="ml-2">
    <Share2 className="h-3 w-3 mr-1" />
    Shared
  </Badge>
)}
```

### To Implement Read-Only Mode

In the HostManagerEditor, check `isOwner`:

```typescript
const isReadOnly = host.isShared && !host.isOwner;

// Disable all form fields when read-only
<Input
  disabled={isReadOnly}
  // ... other props
/>

// Hide save button when read-only
{!isReadOnly && (
  <Button type="submit">Save</Button>
)}

// Show read-only indicator
{isReadOnly && (
  <Alert>
    <Info className="h-4 w-4" />
    <AlertDescription>
      This host is shared with you (read-only). Contact the owner to make changes.
    </AlertDescription>
  </Alert>
)}
```

## Security Features

1. **Admin-Only Sharing**: Only admins can share hosts/folders
2. **Read-Only Access**: Shared users cannot edit or delete hosts
3. **Ownership Checks**: All edit/delete operations verify ownership
4. **Cascade Delete**: When a user is deleted, their shares are automatically revoked
5. **Cascade Delete**: When a host is deleted, all its shares are automatically removed

## Database Migration

The new tables will be created automatically on next server start due to the `CREATE TABLE IF NOT EXISTS` statements in `db/index.ts`.

## Testing Checklist

- [ ] Admin can share a host with a user
- [ ] Admin can share a folder with a user
- [ ] Shared user can see shared hosts in their host list
- [ ] Shared user can connect to shared hosts
- [ ] Shared user CANNOT edit shared hosts (returns 403)
- [ ] Shared user CANNOT delete shared hosts (returns 403)
- [ ] Admin can revoke host shares
- [ ] Admin can revoke folder shares
- [ ] When folder is shared, all hosts in folder are accessible
- [ ] Share indicators appear on shared hosts
- [ ] Host editor shows read-only mode for shared hosts
- [ ] Deleting a host removes all its shares
- [ ] Deleting a user removes all shares to/from that user

## API Testing Examples

### Share a Host (Admin Only)
```bash
curl -X POST http://localhost:30001/ssh/shares/host \
  -H "Authorization: Bearer YOUR_ADMIN_JWT" \
  -H "Content-Type: application/json" \
  -d '{"hostId": 1, "sharedWithUserId": "user-id-here"}'
```

### Get My Shares
```bash
curl http://localhost:30001/ssh/shares/my \
  -H "Authorization: Bearer YOUR_JWT"
```

### Get Shares for a Host (Admin Only)
```bash
curl http://localhost:30001/ssh/shares/host/1 \
  -H "Authorization: Bearer YOUR_ADMIN_JWT"
```

### Revoke a Share (Admin Only)
```bash
curl -X DELETE http://localhost:30001/ssh/shares/host/1 \
  -H "Authorization: Bearer YOUR_ADMIN_JWT"
```

## Future Enhancements

Possible improvements:
1. Different access levels (editor, viewer, etc.)
2. Share expiration dates
3. Share via invitation link
4. Notification when something is shared with you
5. Audit log of sharing activities
6. Bulk share operations
7. Share templates/groups

## Files Modified

- `src/backend/database/db/schema.ts` - Added sharing tables
- `src/backend/database/db/index.ts` - Added CREATE TABLE statements
- `src/backend/database/routes/ssh.ts` - Added sharing endpoints and modified host queries
- `src/ui/main-axios.ts` - Added sharing API client functions
- `src/types/index.ts` - Added sharing metadata to SSHHost

## Files Created

- `src/ui/desktop/apps/host-manager/ShareHostDialog.tsx`
- `src/ui/desktop/apps/host-manager/ShareFolderDialog.tsx`

## Notes

- Shared hosts use the owner's credentials (encrypted with owner's key)
- The connection to shared hosts works transparently for shared users
- Folder sharing is dynamic - if new hosts are added to a shared folder, they're automatically accessible
- Empty folder names are supported and can be shared
