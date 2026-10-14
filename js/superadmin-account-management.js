/* NEXORA Super Admin: live account directory and workspace access controls.
   Requires the admin-user-admin Supabase Edge Function with server-side secrets. */
(() => {
  "use strict";
  const $ = (selector, root = document) => root.querySelector(selector);
  const esc = value => String(value ?? "").replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
  const configKey = "nexora_supabase_public_config_v1";
  let db = null, authorized = false, loading = false, accounts = [], organizations = [], memberships = [];
  const statusText = message => { const el = $("#usersStatus"); if (el) el.textContent = message; };
  const toast = (message, type = "") => {
    const host = $("#toasts");
    if (host) { const el = document.createElement("div"); el.className = "toast " + type; el.textContent = message; host.append(el); setTimeout(() => el.remove(), 3800); }
    else statusText(message);
  };
  const pill = value => {
    const label = ({active:"Active",pending:"Pending",suspended:"Suspended",revoked:"Revoked",none:"No membership"})[value] || value || "Unknown";
    const cls = value === "active" ? "active-status" : value === "suspended" || value === "revoked" ? "suspended-status" : "pending-status";
    return '<span class="status '+cls+'">'+esc(label)+'</span>';
  };
  function getClient() {
    if (db) return db;
    if (!window.supabase?.createClient) throw new Error("Supabase JS did not load.");
    const cfg = JSON.parse(localStorage.getItem(configKey) || "null");
    if (!cfg?.url || !cfg?.key) throw new Error("Configure Supabase in Platform settings first.");
    db = window.supabase.createClient(cfg.url, cfg.key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
    return db;
  }
  async function verifyAdmin() {
    const client = getClient();
    const { data: sessionData, error: sessionError } = await client.auth.getSession();
    if (sessionError) throw sessionError;
    const user = sessionData?.session?.user;
    if (!user) { authorized = false; return false; }
    const { data, error } = await client.from("platform_admins").select("role,status").eq("user_id", user.id).maybeSingle();
    if (error) throw error;
    authorized = !!data && data.status === "active" && data.role === "platform_admin";
    return authorized;
  }
  async function privileged(action) {
    const client = getClient();
    if (!await verifyAdmin()) throw new Error("An active NEXORA platform administrator session is required.");
    const { data, error } = await client.functions.invoke("admin-user-admin", { body: action });
    if (error) throw new Error(error.message || "The privileged account service is unavailable. Deploy the admin-user-admin Edge Function and configure its server secrets.");
    if (data?.error) throw new Error(data.error);
    return data || {};
  }
  async function load() {
    if (loading) return;
    loading = true;
    statusText("Verifying administrator access and loading live Supabase accounts…");
    try {
      if (!await verifyAdmin()) {
        accounts = []; organizations = []; memberships = [];
        populateOrganizations("Sign in as an active platform administrator to load workspaces.");
        render();
        statusText("Sign in as an active platform administrator to view live accounts.");
        return;
      }
      const client = getClient();
      // Keep workspace loading independent from the Auth account directory. If the
      // Edge Function is missing/unreachable, direct reads can still populate the
      // selector under the signed-in administrator's database RLS permissions.
      let accountLoadError = "";
      try {
        const userResult = await privileged({ action: "list" });
        accounts = userResult.users || [];
      } catch (edgeError) {
        accounts = [];
        accountLoadError = "Auth account directory unavailable: " + (edgeError?.message || String(edgeError));
      }

      let workspaceLoadError = "";
      try {
        const workspaceResult = await privileged({ action: "list-workspaces" });
        organizations = workspaceResult.organizations || [];
        memberships = workspaceResult.memberships || [];
      } catch (edgeError) {
        const client = getClient();
        const [orgResult, memberResult] = await Promise.all([
          client.from("organizations").select("id,name,status,plan").order("name", { ascending: true }),
          client.from("organization_members").select("id,organization_id,user_id,role,status,created_at").order("created_at", { ascending: false })
        ]);
        if (orgResult.error || memberResult.error) {
          workspaceLoadError = [
            orgResult.error && "organizations: " + orgResult.error.message,
            memberResult.error && "memberships: " + memberResult.error.message
          ].filter(Boolean).join("; ");
          organizations = [];
          memberships = [];
        } else {
          organizations = orgResult.data || [];
          memberships = memberResult.data || [];
          workspaceLoadError = "Workspace service fallback used: " + (edgeError?.message || String(edgeError));
        }
      }

      populateOrganizations(); render();
      const summary = "Workspace access loaded · " + organizations.length + " workspaces · " + memberships.length + " company memberships.";
      const notes = [accountLoadError, workspaceLoadError].filter(Boolean).join(" · ");
      statusText(notes ? summary + " " + notes : summary);
    } catch (error) {
      authorized = false; accounts = []; organizations = []; memberships = [];
      populateOrganizations("Workspace list unavailable. Check the status message above and refresh.");
      render();
      statusText("Live account directory unavailable: " + (error?.message || String(error)));
    } finally { loading = false; }
  }
  function populateOrganizations(emptyMessage = "") {
    const select = $("#inviteOrganization");
    if (!select) return;
    const previous = select.value;
    const active = organizations.filter(org => org.status === "active");
    const emptyLabel = emptyMessage || (organizations.length ? (active.length ? "Select an active workspace…" : "No active workspaces available") : "No workspaces found");
    select.innerHTML = '<option value="">'+esc(emptyLabel)+'</option>' +
      organizations.map(org => {
        const enabled = org.status === "active";
        const label = String(org.name || "Unnamed workspace") + (enabled ? " · Active" : " · " + String(org.status || "unknown").replace(/_/g, " "));
        return '<option value="'+esc(org.id)+'"'+(enabled ? "" : " disabled")+ '>'+esc(label)+'</option>';
      }).join("");
    if ([...select.options].some(option => option.value === previous && !option.disabled)) select.value = previous;
    const hint = $("#inviteWorkspaceHint");
    if (hint) hint.textContent = active.length
      ? active.length + " active workspace" + (active.length === 1 ? "" : "s") + " available. Inactive workspaces must be activated under Companies before inviting users."
      : organizations.length
        ? "Workspaces were found, but none are active. Open Companies, activate a workspace, then refresh this list."
        : "No workspace records were returned. Create a workspace under Companies, then refresh this list.";
  }
  function render() {
    const host = $("#userRows");
    if (!host) return;
    const query = ($("#userSearch")?.value || "").trim().toLowerCase();
    const rows = accounts.flatMap(user => {
      const own = memberships.filter(member => member.user_id === user.id);
      return own.length ? own.map(member => ({...user, membership:member, organization:organizations.find(org => org.id === member.organization_id)})) : [{...user, membership:null, organization:null}];
    }).filter(row => !query || [row.email,row.id,row.organization?.name,row.membership?.role,row.membership?.status].some(value => String(value || "").toLowerCase().includes(query)));
    if (!rows.length) {
      host.innerHTML = '<tr><td colspan="6">'+(authorized ? "No matching live accounts." : "Sign in to load the live account directory.")+'</td></tr>';
      return;
    }
    host.innerHTML = rows.map(row => {
      const member = row.membership;
      const banned = !!row.banned_until && new Date(row.banned_until) > new Date();
      return '<tr><td><b>'+esc(row.email || "Account without email")+'</b><small class="user-id">'+esc(row.id)+'</small></td>' +
        '<td>'+esc(row.organization?.name || "—")+'</td><td>'+esc(member?.role || "No membership")+'</td>' +
        '<td>'+pill(member?.status || "none")+'</td><td>'+pill(banned ? "suspended" : "active")+'</td><td><div class="user-actions">' +
        (member ? '<button type="button" class="rowbtn" data-account-action="membership" data-membership="'+esc(member.id)+'" data-status="'+esc(member.status)+'">'+(member.status === "active" ? "Suspend access" : "Activate access")+'</button>' : '<span class="muted">No workspace access</span>') +
        '<button type="button" class="rowbtn" data-account-action="auth" data-user="'+esc(row.id)+'" data-status="'+(banned ? "suspended" : "active")+'">'+(banned ? "Restore account" : "Suspend account")+'</button></div></td></tr>';
    }).join("");
  }
  function wire() {
    $("#refreshUsers")?.addEventListener("click", load);
    $("#userSearch")?.addEventListener("input", render);
    $("#inviteUserForm")?.addEventListener("submit", async event => {
      event.preventDefault();
      const form = event.currentTarget;
      if (!form.reportValidity()) return;
      const button = form.querySelector('button[type="submit"]'), original = button.textContent;
      button.disabled = true; button.textContent = "Sending invite…";
      try {
        const email = $("#inviteUserEmail").value.trim().toLowerCase();
        const organizationId = $("#inviteOrganization").value, role = $("#inviteRole").value;
        if (!organizationId) throw new Error("Choose an active workspace before inviting a user.");
        await privileged({ action:"invite", email, organizationId, role, redirectTo:location.origin + location.pathname.replace(/index\.html$/, "") + "company-portal/accept-employee-invitation.html" });
        toast("Invitation sent. The new workspace membership is pending until activated.", "success");
        form.reset(); await load();
      } catch (error) { toast(error?.message || "Invitation failed.", "error"); }
      finally { button.disabled = false; button.textContent = original; }
    });
    document.addEventListener("click", async event => {
      const button = event.target.closest("[data-account-action]");
      if (!button) return;
      button.disabled = true;
      try {
        if (button.dataset.accountAction === "auth") {
          const action = button.dataset.status === "suspended" ? "unsuspend" : "suspend";
          await privileged({ action, userId:button.dataset.user });
          toast(action === "suspend" ? "User sign-in suspended." : "User sign-in restored.", "success");
        } else {
          const next = button.dataset.status === "active" ? "suspended" : "active";
          const client = getClient();
          if (!await verifyAdmin()) throw new Error("Platform administrator access is required.");
          const { error } = await client.from("organization_members").update({ status:next, updated_at:new Date().toISOString() }).eq("id", button.dataset.membership);
          if (error) throw error;
          toast("Workspace membership set to " + next + ".", "success");
        }
        await load();
      } catch (error) { toast(error?.message || "Could not update account access.", "error"); }
      finally { button.disabled = false; }
    });
    try {
      const client = getClient();
      client.auth.onAuthStateChange((event, session) => {
        if (session && ["SIGNED_IN","TOKEN_REFRESHED","INITIAL_SESSION","USER_UPDATED"].includes(event)) load();
        else if (event === "SIGNED_OUT") { authorized = false; accounts = []; memberships = []; organizations = []; render(); statusText("Signed out. Sign in as a platform administrator to load accounts."); }
      });
      load();
    } catch (error) { statusText(error?.message || "Supabase configuration required."); }
  }
  window.NEXORAAccountManagement = { render, refresh:load };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", wire, { once:true }); else wire();
})();
