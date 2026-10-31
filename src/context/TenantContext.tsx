import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import supabase from "../lib/supabaseClient";
import {
  getAccessibleBranches,
  getMyOrganization,
  getSessionClaims,
  switchActiveBranch,
} from "../services/middleware.service";
import type { Branch } from "../services/types";

export type TenantStatus =
  | "loading"
  | "signed-out"
  | "ready"
  | "no-access"
  /** Nothing the user can reach is active: their branch (or whole organization) has been paused. */
  | "paused"
  | "error";

interface TenantState {
  status: TenantStatus;
  organizationName: string | null;
  /** ACTIVE, or SUSPENDED / CANCELLED when the whole organization has been paused. */
  organizationStatus: string | null;
  branches: Branch[];
  activeBranchId: string | null;
  /** Increases whenever the active branch changes, so screens can remount and refetch. */
  epoch: number;
}

interface TenantContextValue extends TenantState {
  activeBranch: Branch | null;
  switchBranch: (branchId: string) => Promise<void>;
  reload: () => Promise<void>;
}

const INITIAL: TenantState = {
  status: "loading",
  organizationName: null,
  organizationStatus: null,
  branches: [],
  activeBranchId: null,
  epoch: 0,
};

function sameState(a: TenantState, b: TenantState): boolean {
  return (
    a.status === b.status &&
    a.organizationName === b.organizationName &&
    a.organizationStatus === b.organizationStatus &&
    a.activeBranchId === b.activeBranchId &&
    a.epoch === b.epoch &&
    a.branches.length === b.branches.length &&
    a.branches.every(
      (branch, i) =>
        branch.id === b.branches[i].id &&
        branch.name === b.branches[i].name &&
        branch.status === b.branches[i].status &&
        branch.renewalDate === b.branches[i].renewalDate
    )
  );
}

const TenantContext = createContext<TenantContextValue | null>(null);

/**
 * Holds the signed-in user's organization, the branches they can use, and the
 * branch they are working in.
 *
 * The active branch always comes from the access token (the same value the
 * database uses to scope every query), never from separate UI state, so what
 * is shown is what gets written. It changes only after switchBranch() has
 * refreshed the session.
 */
export function TenantProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<TenantState>(INITIAL);
  const stateRef = useRef(state);
  stateRef.current = state;

  // Each load gets a number; if a newer one starts, the older result is dropped.
  const loadSeq = useRef(0);
  // A token pointing at an unusable branch is repaired once, not in a loop.
  const triedSelfHeal = useRef(false);

  const apply = useCallback((update: (prev: TenantState) => TenantState) => {
    setState((prev) => {
      const next = update(prev);
      return sameState(prev, next) ? prev : next;
    });
  }, []);

  const load = useCallback(async () => {
    const seq = ++loadSeq.current;
    try {
      const claims = await getSessionClaims();
      if (seq !== loadSeq.current) return;

      if (!claims) {
        apply((prev) => ({ ...INITIAL, status: "signed-out", epoch: prev.epoch }));
        return;
      }

      // A platform super-admin belongs to no organization, so there is no
      // tenant to load (and no branch to switch to).
      if (claims.isSuperAdmin && !claims.organizationId) {
        apply((prev) => ({
          status: "no-access",
          organizationName: null,
          organizationStatus: null,
          branches: [],
          activeBranchId: null,
          epoch: prev.epoch,
        }));
        return;
      }

      const [branches, organization] = await Promise.all([
        getAccessibleBranches(),
        getMyOrganization(),
      ]);
      if (seq !== loadSeq.current) return;
      const organizationName = organization.name;
      const organizationStatus = organization.status;

      if (branches.length === 0) {
        apply((prev) => ({
          status: "no-access",
          organizationName,
          organizationStatus,
          branches: [],
          activeBranchId: null,
          epoch: prev.epoch,
        }));
        return;
      }

      // A branch is usable only while it AND its organization are active; the
      // database enforces the same rule on every query.
      const usable = organizationStatus === "ACTIVE" ? branches.filter((b) => b.status === "ACTIVE") : [];
      if (usable.length === 0) {
        apply((prev) => ({
          status: "paused",
          organizationName,
          organizationStatus,
          branches,
          activeBranchId: claims.defaultBranchId,
          epoch: prev.epoch,
        }));
        return;
      }

      const activeBranchId = claims.defaultBranchId;
      if (!activeBranchId || !usable.some((b) => b.id === activeBranchId)) {
        // The token points at a branch the user can't use (access removed,
        // never set, or paused) while another one works. Move them to a usable
        // one; the session refresh that follows triggers another load.
        if (!triedSelfHeal.current) {
          triedSelfHeal.current = true;
          await switchActiveBranch(usable[0].id);
          return;
        }
        apply((prev) => ({ ...prev, status: "error" }));
        return;
      }

      triedSelfHeal.current = false;
      apply((prev) => ({
        status: "ready",
        organizationName,
        organizationStatus,
        branches,
        activeBranchId,
        epoch:
          prev.activeBranchId !== null && prev.activeBranchId !== activeBranchId
            ? prev.epoch + 1
            : prev.epoch,
      }));
    } catch {
      if (seq === loadSeq.current) {
        apply((prev) => ({ ...prev, status: "error" }));
      }
    }
  }, [apply]);

  useEffect(() => {
    let cancelled = false;

    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        triedSelfHeal.current = false;
        loadSeq.current++;
        apply((prev) => ({ ...INITIAL, status: "signed-out", epoch: prev.epoch }));
        return;
      }

      // Show "loading" straight away on sign-in so a guard never mistakes the
      // brief signed-out state for a failed login and bounces back to /login.
      if (event === "SIGNED_IN") {
        apply((prev) =>
          prev.status === "signed-out" ? { ...prev, status: "loading" } : prev
        );
      }

      // Deferred on purpose: supabase-js warns against calling other
      // supabase methods from inside this callback.
      setTimeout(() => {
        if (!cancelled) void load();
      }, 0);
    });

    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, [apply, load]);

  // Pausing or resuming a branch happens on the platform, not in this tab, so look
  // again when the tab comes back into view and once a minute while it is open. A
  // load that finds nothing changed does not re-render anything.
  useEffect(() => {
    const refresh = () => {
      const { status } = stateRef.current;
      if ((status === "ready" || status === "paused") && document.visibilityState === "visible") {
        void load();
      }
    };
    const timer = window.setInterval(refresh, 60_000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [load]);

  const switchBranch = useCallback(
    async (branchId: string) => {
      if (branchId === stateRef.current.activeBranchId) return;
      await switchActiveBranch(branchId);
      await load();
    },
    [load]
  );

  const value = useMemo<TenantContextValue>(
    () => ({
      ...state,
      activeBranch: state.branches.find((b) => b.id === state.activeBranchId) ?? null,
      switchBranch,
      reload: load,
    }),
    [state, switchBranch, load]
  );

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

export function useTenant(): TenantContextValue {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error("useTenant must be used inside <TenantProvider>");
  return ctx;
}
