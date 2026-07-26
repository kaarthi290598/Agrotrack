"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth as useClerkAuth, useOrganization } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useAuth } from "../../components/auth/AuthProvider";
import { UserRole, canManageMembers } from "../../types";
import { useToast } from "../../components/ui/Toast";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { Dialog } from "../../components/ui/Dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/Card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/Table";
import { ListPageSkeleton } from "../../components/skeletons/PageSkeletons";
import { formatClerkMemberName, getInitials } from "../../lib/clerk-user";
import { Plus, RefreshCw, Trash2, Users } from "lucide-react";

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: "ADMIN", label: "Admin" },
  { value: "SUPERVISOR", label: "Supervisor" },
  { value: "MEMBER", label: "Member" },
];

type MemberRow = {
  _id: Id<"users">;
  clerkUserId: string;
  email: string;
  fullName: string;
  imageUrl?: string;
  role: UserRole;
};

export default function MembersPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { orgId, isLoaded: isClerkLoaded } = useClerkAuth();
  const { user } = useAuth();
  const isAdmin = canManageMembers(user?.role);
  const { memberships } = useOrganization({
    memberships: {
      pageSize: 100,
      keepPreviousData: true,
    },
  });

  const syncOrgMembers = useMutation(api.users.syncOrgMembers);
  const updateRole = useMutation(api.users.updateRole);
  const clearPendingInvites = useMutation(api.users.clearPendingInvites);

  const me = useQuery(
    api.users.getCurrentUser,
    orgId && user?.id ? {} : "skip"
  );
  const members = useQuery(
    api.users.listByOrg,
    orgId && user?.id ? { orgId } : "skip"
  );

  const [isSyncing, setIsSyncing] = useState(false);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [lastAutoSyncKey, setLastAutoSyncKey] = useState<string | null>(null);
  /** Pause auto-sync briefly after delete while Clerk cache catches up. */
  const [suppressAutoSyncUntil, setSuppressAutoSyncUntil] = useState(0);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [memberEmail, setMemberEmail] = useState("");
  const [memberRole, setMemberRole] = useState<UserRole>("MEMBER");
  const [isAdding, setIsAdding] = useState(false);
  const [memberToDelete, setMemberToDelete] = useState<MemberRow | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (user && !isAdmin) {
      toast({
        type: "error",
        title: "Access Denied",
        description: "Member role management is restricted to Admin users.",
      });
      router.replace("/billing");
    }
  }, [user, isAdmin, router, toast]);

  // Wipe leftover pending-invite rows from the old invite flow
  useEffect(() => {
    if (!orgId || !user?.id || !isAdmin || me?.role !== "ADMIN") return;
    void clearPendingInvites({
      orgId,
    }).catch(() => null);
  }, [orgId, user?.id, isAdmin, me?.role, clearPendingInvites]);

  const handleSync = async ({ allowPrune = true }: { allowPrune?: boolean } = {}) => {
    if (!orgId || !user?.id) return;

    const clerkMembers =
      memberships?.data
        ?.map((membership) => {
          const data = membership.publicUserData;
          if (!data?.userId) return null;
          return {
            clerkUserId: data.userId,
            email: data.identifier || "",
            fullName: formatClerkMemberName(
              data.firstName,
              data.lastName,
              data.identifier
            ),
            imageUrl: data.imageUrl || undefined,
            clerkOrgRole: membership.role,
          };
        })
        .filter((m): m is NonNullable<typeof m> => !!m && !!m.email) || [];

    if (clerkMembers.length === 0) {
      toast({
        type: "error",
        title: "No members found",
        description: "Could not load organization members from Clerk yet.",
      });
      return;
    }

    // Only prune when the loaded page holds every Clerk membership, otherwise
    // members beyond the first page would be deleted from Convex.
    const loadedCount = memberships?.data?.length ?? 0;
    const totalCount = memberships?.count ?? loadedCount;
    const prune =
      allowPrune &&
      loadedCount >= totalCount &&
      clerkMembers.length === loadedCount;

    setIsSyncing(true);
    try {
      const result = await syncOrgMembers({
        orgId,
        prune,
        members: clerkMembers,
      });
      toast({
        type: "success",
        title: "Members synced",
        description: `Created ${result.created}, updated ${result.updated}${
          result.removed ? `, removed ${result.removed}` : ""
        }.`,
      });
    } catch (error) {
      toast({
        type: "error",
        title: "Sync failed",
        description:
          error instanceof Error ? error.message : "Could not sync members.",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    if (!isAdmin || !orgId || !user?.id) return;
    if (!me || me.role !== "ADMIN") return;
    if (members === undefined) return;
    if (isSyncing) return;
    if (Date.now() < suppressAutoSyncUntil) return;

    const clerkCount = memberships?.data?.length ?? 0;
    if (clerkCount === 0) return;
    if (members.length === clerkCount) return;

    // Re-run whenever Clerk and Convex counts diverge (e.g. user deleted in Clerk).
    const syncKey = `${orgId}:${clerkCount}:${members.length}`;
    if (lastAutoSyncKey === syncKey) return;

    setLastAutoSyncKey(syncKey);
    // Never prune automatically: the cached Clerk membership list can lag
    // behind a just-added member and would delete their app role.
    void handleSync({ allowPrune: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isAdmin,
    orgId,
    user?.id,
    me?._id,
    me?.role,
    memberships?.data?.length,
    members,
    isSyncing,
    lastAutoSyncKey,
    suppressAutoSyncUntil,
  ]);

  useEffect(() => {
    setLastAutoSyncKey(null);
  }, [orgId]);

  const handleRoleChange = async (userId: Id<"users">, role: UserRole) => {
    if (!orgId || !user?.id) return;

    setUpdatingUserId(userId);
    try {
      await updateRole({
        orgId,
        userId,
        role,
      });
      toast({
        type: "success",
        title: "Role updated",
        description: `Application role set to ${role}.`,
      });
    } catch (error) {
      toast({
        type: "error",
        title: "Update failed",
        description:
          error instanceof Error ? error.message : "Could not update role.",
      });
    } finally {
      setUpdatingUserId(null);
    }
  };

  const handleDeleteMember = async () => {
    if (!orgId || !user?.id || !memberToDelete) return;

    setIsDeleting(true);
    try {
      // Removal happens server-side: app ADMINs are Clerk `org:member` and cannot
      // remove Clerk memberships from the browser.
      const res = await fetch("/api/org/members", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId, userId: memberToDelete._id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to remove member");
      }

      // Clerk's membership hook often still lists the user for a bit; block
      // auto-sync so it cannot recreate the Convex row from that stale list.
      setSuppressAutoSyncUntil(Date.now() + 15_000);
      setLastAutoSyncKey(
        `${orgId}:removed:${memberToDelete.clerkUserId}:${Date.now()}`
      );
      memberships?.revalidate?.();

      toast({
        type: "success",
        title: "Member removed",
        description: data.deletedClerkUser
          ? `${memberToDelete.fullName} was deleted from Clerk and the app.`
          : `${memberToDelete.fullName} was removed from this organization and the app.`,
      });
      setMemberToDelete(null);
    } catch (error) {
      toast({
        type: "error",
        title: "Remove failed",
        description:
          error instanceof Error ? error.message : "Could not remove member.",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const openAddMember = () => {
    setMemberEmail("");
    setMemberRole("MEMBER");
    setIsAddOpen(true);
  };

  const handleAddMember = async () => {
    if (!orgId || !user?.id) return;

    const email = memberEmail.trim().toLowerCase();
    if (!email.includes("@")) {
      toast({
        type: "error",
        title: "Invalid email",
        description: "Enter a valid email address.",
      });
      return;
    }

    setIsAdding(true);
    try {
      const res = await fetch("/api/org/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, orgId, role: memberRole }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to add member");
      }

      memberships?.revalidate?.();

      const assignedRole = (data.role as UserRole) || memberRole;
      toast({
        type: "success",
        title: data.createdUser ? "Member created" : "Member added",
        description: data.createdUser
          ? `${email} added as ${assignedRole}. They can sign in at /sign-in and set a password via Forgot password.`
          : `${email} was added as ${assignedRole}.`,
      });
      setIsAddOpen(false);
      setMemberEmail("");
      setMemberRole("MEMBER");
    } catch (error) {
      toast({
        type: "error",
        title: "Add member failed",
        description:
          error instanceof Error
            ? error.message
            : "Could not add this member.",
      });
    } finally {
      setIsAdding(false);
    }
  };

  if (!isClerkLoaded || !user || !isAdmin || members === undefined) {
    return <ListPageSkeleton />;
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Users className="h-6 w-6 text-emerald-600" />
            Members
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Add members by email and manage their application roles.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => handleSync()}
            disabled={isSyncing}
            className="gap-2"
          >
            <RefreshCw
              className={`h-4 w-4 ${isSyncing ? "animate-spin" : ""}`}
            />
            Sync
          </Button>
          <Button type="button" onClick={openAddMember} className="gap-2">
            <Plus className="h-4 w-4" />
            Add Member
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Organization members</CardTitle>
          <CardDescription>
            Application roles (Admin / Supervisor / Member) are stored in Convex.
            Clerk always uses <code className="text-xs">org:member</code> for
            added users — that is expected and separate from the app role.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {members.length === 0 ? (
            <div className="px-6 py-10 text-center space-y-3">
              <p className="text-sm text-slate-500">
                No members yet. Add someone to get started.
              </p>
              <Button type="button" onClick={openAddMember} className="gap-2">
                <Plus className="h-4 w-4" />
                Add Member
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead className="w-45">App role</TableHead>
                    <TableHead className="w-16 text-right"> </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((member) => (
                    <TableRow key={member._id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {member.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={member.imageUrl}
                              alt=""
                              className="h-8 w-8 rounded-full object-cover"
                            />
                          ) : (
                            <div className="h-8 w-8 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 flex items-center justify-center text-xs font-bold">
                              {getInitials(member.fullName)}
                            </div>
                          )}
                          <div>
                            <div className="font-medium text-slate-900 dark:text-slate-100">
                              {member.fullName}
                            </div>
                            {member.clerkUserId === user.id && (
                              <div className="text-[10px] font-semibold uppercase tracking-wide text-emerald-600">
                                You
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-slate-500 dark:text-slate-400">
                        {member.email}
                      </TableCell>
                      <TableCell>
                        <Select
                          options={ROLE_OPTIONS}
                          value={member.role}
                          disabled={updatingUserId === member._id}
                          onChange={(e) =>
                            handleRoleChange(
                              member._id,
                              e.target.value as UserRole
                            )
                          }
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <button
                          type="button"
                          title={
                            member.clerkUserId === user.id
                              ? "You cannot remove yourself"
                              : "Remove member"
                          }
                          disabled={member.clerkUserId === user.id}
                          onClick={() =>
                            setMemberToDelete({
                              _id: member._id,
                              clerkUserId: member.clerkUserId,
                              email: member.email,
                              fullName: member.fullName,
                              imageUrl: member.imageUrl,
                              role: member.role,
                            })
                          }
                          className="inline-flex p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        isOpen={isAddOpen}
        onClose={() => !isAdding && setIsAddOpen(false)}
        title="Add Member"
        footer={
          <>
            <Button
              variant="outline"
              disabled={isAdding}
              onClick={() => setIsAddOpen(false)}
              className="cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              isLoading={isAdding}
              onClick={handleAddMember}
              className="cursor-pointer"
            >
              Create Member
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Email address"
            type="email"
            value={memberEmail}
            onChange={(e) => setMemberEmail(e.target.value)}
            placeholder="member@example.com"
            autoFocus
          />
          <Select
            key={`role-${isAddOpen}-${memberRole}`}
            label="Application role"
            options={ROLE_OPTIONS}
            value={memberRole}
            onChange={(e) => setMemberRole(e.target.value as UserRole)}
          />
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Creates their account with the selected app role (
            <span className="font-semibold">{memberRole}</span>
            ). Clerk org role stays <span className="font-medium">org:member</span>.
            They sign in at <span className="font-medium">/sign-in</span> and set
            a password via Forgot password.
          </p>
        </div>
      </Dialog>

      <Dialog
        isOpen={!!memberToDelete}
        onClose={() => !isDeleting && setMemberToDelete(null)}
        title="Remove member"
        footer={
          <>
            <Button
              variant="outline"
              disabled={isDeleting}
              onClick={() => setMemberToDelete(null)}
              className="cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              isLoading={isDeleting}
              onClick={handleDeleteMember}
              className="cursor-pointer"
            >
              Remove
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Remove <strong>{memberToDelete?.fullName}</strong> (
          {memberToDelete?.email}) from this organization? Their app record will
          be deleted, and their Clerk account will be deleted if they do not
          belong to any other organization.
        </p>
      </Dialog>
    </div>
  );
}
