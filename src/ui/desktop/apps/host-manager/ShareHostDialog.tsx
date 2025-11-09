import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../../../components/ui/dialog";
import { Button } from "../../../components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../components/ui/select";
import { Label } from "../../../components/ui/label";
import { Trash2 } from "lucide-react";
import {
  shareHost,
  getHostShares,
  revokeHostShare,
  getUserList,
  type HostShare,
} from "../../../main-axios";
import { useToast } from "../../../components/ui/use-toast";

interface UserInfo {
  userId: string;
  username: string;
  is_admin: boolean;
  is_oidc: boolean;
  totp_enabled: boolean;
}

interface ShareHostDialogProps {
  isOpen: boolean;
  onClose: () => void;
  hostId: number;
  hostName: string;
}

export function ShareHostDialog({
  isOpen,
  onClose,
  hostId,
  hostName,
}: ShareHostDialogProps) {
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [shares, setShares] = useState<HostShare[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, hostId]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [usersResponse, sharesData] = await Promise.all([
        getUserList(),
        getHostShares(hostId),
      ]);
      setUsers(usersResponse.users);
      setShares(sharesData);
    } catch (error) {
      console.error("Failed to load data:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load sharing data",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleShare = async () => {
    if (!selectedUserId) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please select a user to share with",
      });
      return;
    }

    try {
      setIsLoading(true);
      await shareHost(hostId, selectedUserId);
      toast({
        title: "Success",
        description: "Host shared successfully",
      });
      setSelectedUserId("");
      await loadData();
    } catch (error: any) {
      console.error("Failed to share host:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error?.response?.data?.error || "Failed to share host",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRevoke = async (shareId: number) => {
    try {
      setIsLoading(true);
      await revokeHostShare(shareId);
      toast({
        title: "Success",
        description: "Access revoked successfully",
      });
      await loadData();
    } catch (error: any) {
      console.error("Failed to revoke share:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error?.response?.data?.error || "Failed to revoke access",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Filter out users who already have access
  const availableUsers = users.filter(
    (user) => !shares.some((share) => share.sharedWithUserId === user.userId)
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Share Host: {hostName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Share with new user */}
          <div className="space-y-2">
            <Label>Share with user</Label>
            <div className="flex gap-2">
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Select a user" />
                </SelectTrigger>
                <SelectContent>
                  {availableUsers.length === 0 ? (
                    <div className="p-2 text-sm text-muted-foreground">
                      All users already have access
                    </div>
                  ) : (
                    availableUsers.map((user) => (
                      <SelectItem key={user.userId} value={user.userId}>
                        {user.username}
                        {user.is_admin && " (Admin)"}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <Button
                onClick={handleShare}
                disabled={isLoading || !selectedUserId}
              >
                Share
              </Button>
            </div>
          </div>

          {/* Current shares */}
          <div className="space-y-2">
            <Label>Current shares</Label>
            <div className="border rounded-md">
              {shares.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground text-center">
                  This host is not shared with anyone
                </div>
              ) : (
                <div className="divide-y">
                  {shares.map((share) => (
                    <div
                      key={share.id}
                      className="flex items-center justify-between p-3"
                    >
                      <div className="flex-1">
                        <div className="font-medium">
                          {share.sharedWithUsername || share.sharedWithUserId}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {share.accessLevel === "viewer"
                            ? "Read-only"
                            : share.accessLevel}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRevoke(share.id)}
                        disabled={isLoading}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
